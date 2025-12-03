/**
 * Padel Market Feed Processor Service
 * 
 * Processes Padel Market affiliate product feed data and updates rackets in the database.
 */

import { storage } from "../storage.js";
import { 
  type PadelMarketFeedProduct,
  extractBrandModelYear,
  normalizeYear,
  parsePadelMarketPrice,
} from "./padelMarketFeedSync.js";

export interface ProcessingResult {
  success: boolean;
  totalProcessed: number;
  matched: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  markedOutOfStock: number;
  errors: string[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

/**
 * Normalize brand name for matching
 */
function normalizeBrand(brand: string): string {
  return brand.trim().toLowerCase();
}

/**
 * Normalize model name for matching
 */
function normalizeModel(model: string): string {
  return model.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Check if two strings are similar (for fuzzy matching)
 */
function isSimilar(str1: string, str2: string, threshold: number = 0.8): boolean {
  const s1 = normalizeModel(str1);
  const s2 = normalizeModel(str2);
  
  // Exact match
  if (s1 === s2) return true;
  
  // One contains the other (for cases like "PEARL Cloud" vs "PEARL")
  if (s1.includes(s2) || s2.includes(s1)) {
    return true;
  }
  
  // Calculate simple similarity (word overlap)
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  const similarity = intersection.size / union.size;
  
  return similarity >= threshold;
}

/**
 * Estimate racket shape from product name/description
 */
function estimateShape(product: PadelMarketFeedProduct): "diamond" | "round" | "teardrop" {
  const text = `${product.product_name} ${product.description || ""} ${product.product_short_description || ""}`.toLowerCase();
  
  // Check for shape keywords
  if (text.includes("diamond") || text.includes("diamante")) {
    return "diamond";
  }
  if (text.includes("round") || text.includes("redondo") || text.includes("control")) {
    return "round";
  }
  if (text.includes("teardrop") || text.includes("lágrima") || text.includes("drop")) {
    return "teardrop";
  }
  
  // Default to teardrop (most common)
  return "teardrop";
}

/**
 * Get default ratings for a brand
 */
function getDefaultRatings(brand: string): {
  powerRating: number;
  controlRating: number;
  reboundRating: number;
  maneuverabilityRating: number;
  sweetSpotRating: number;
} {
  // Default balanced ratings
  return {
    powerRating: 75,
    controlRating: 75,
    reboundRating: 75,
    maneuverabilityRating: 75,
    sweetSpotRating: 75,
  };
}

/**
 * Process a single Padel Market feed product
 */
async function processProduct(
  product: PadelMarketFeedProduct
): Promise<{ action: "created" | "updated" | "unchanged" | "skipped"; error?: string }> {
  try {
    // Extract brand, model, and year from product name
    // Use brand_name from feed if available (more reliable)
    const extracted = extractBrandModelYear(product.product_name, product.brand_name);
    
    if (!extracted.brand || !extracted.model) {
      return { 
        action: "skipped", 
        error: `Could not extract brand/model from: ${product.product_name}` 
      };
    }
    
    // Try to find existing racket by brand, model, and year
    let existingRacket;
    
    if (extracted.year) {
      // First try exact match with year
      existingRacket = await storage.getRacketByBrandModelAndYear(
        extracted.brand,
        extracted.model,
        extracted.year
      );
    }
    
    // If no exact match, try without year (brand + model only)
    if (!existingRacket) {
      existingRacket = await storage.getRacketByBrandAndModel(
        extracted.brand,
        extracted.model
      );
      
      // If found by brand+model but year doesn't match, check if years are close
      if (existingRacket && extracted.year && existingRacket.year !== extracted.year) {
        // Check if years are close (within 1 year difference)
        if (Math.abs(existingRacket.year - extracted.year) > 1) {
          // Years are too different, don't match - will create new racket
          existingRacket = undefined;
        }
      }
    }
    
    // If still no match, try fuzzy model matching with all rackets of the same brand
    if (!existingRacket) {
      const allRackets = await storage.getAllRackets();
      const brandRackets = allRackets.filter(
        r => normalizeBrand(r.brand) === normalizeBrand(extracted.brand)
      );
      
      for (const racket of brandRackets) {
        if (isSimilar(racket.model, extracted.model)) {
          // Check year compatibility
          if (extracted.year) {
            if (Math.abs(racket.year - extracted.year) <= 1) {
              existingRacket = racket;
              break;
            }
          } else {
            existingRacket = racket;
            break;
          }
        }
      }
    }
    
    const now = new Date();
    const feedProductId = product.aw_product_id || product.merchant_product_id || "";
    const price = parsePadelMarketPrice(product.store_price || product.search_price || "0");
    
    if (existingRacket) {
      // UPDATE EXISTING RACKET: Only update affiliate link and price (never delete)
      // Preserve existing affiliate link if it was manually set
      const updateData: {
        padelMarketAffiliateLink?: string;
        padelMarketInStock: boolean;
        padelMarketFeedProductId?: string;
        padelMarketFeedLastUpdated: Date;
        currentPrice?: string;
      } = {
        padelMarketInStock: true,
        padelMarketFeedProductId: feedProductId || undefined,
        padelMarketFeedLastUpdated: now,
        // Update price if available
        currentPrice: price > 0 ? price.toFixed(2) : undefined,
      };
      
      // Only update affiliate link if it doesn't already exist (preserve manual edits)
      if (!existingRacket.padelMarketAffiliateLink) {
        updateData.padelMarketAffiliateLink = product.aw_deep_link;
      } else {
        console.log(`[PadelMarket-Processor] Preserving existing Padel Market affiliate link for ${existingRacket.brand} ${existingRacket.model} ${existingRacket.year} (manual edit detected)`);
      }
      
      // Check if anything actually changed
      const hasChanged = 
        (updateData.padelMarketAffiliateLink && existingRacket.padelMarketAffiliateLink !== updateData.padelMarketAffiliateLink) ||
        existingRacket.padelMarketInStock !== updateData.padelMarketInStock ||
        existingRacket.padelMarketFeedProductId !== updateData.padelMarketFeedProductId ||
        (updateData.currentPrice && existingRacket.currentPrice !== updateData.currentPrice);
      
      if (!hasChanged) {
        return { action: "unchanged" };
      }
      
      // Update the racket (only Padel Market fields and price - never delete or modify other fields)
      await storage.updateRacket(existingRacket.id, updateData);
      
      const changes = [];
      if (updateData.padelMarketAffiliateLink) changes.push("link added");
      if (updateData.currentPrice && existingRacket.currentPrice !== updateData.currentPrice) changes.push(`price: €${price.toFixed(2)}`);
      if (existingRacket.padelMarketInStock !== updateData.padelMarketInStock) changes.push("stock status updated");
      
      console.log(`[PadelMarket-Processor] Updated: ${existingRacket.brand} ${existingRacket.model} ${existingRacket.year} - ${changes.join(", ")}`);
      return { action: "updated" };
    } else {
      // CREATE NEW RACKET: Check for duplicates first
      // Double-check we're not creating a duplicate by checking all rackets again
      const allRackets = await storage.getAllRackets();
      const potentialDuplicate = allRackets.find(
        r => normalizeBrand(r.brand) === normalizeBrand(extracted.brand) &&
             normalizeModel(r.model) === normalizeModel(extracted.model) &&
             (extracted.year ? Math.abs(r.year - extracted.year) <= 1 : true)
      );
      
      if (potentialDuplicate) {
        // Found a potential duplicate, update it instead
        const updateData: {
          padelMarketAffiliateLink?: string;
          padelMarketInStock: boolean;
          padelMarketFeedProductId?: string;
          padelMarketFeedLastUpdated: Date;
          currentPrice?: string;
        } = {
          padelMarketAffiliateLink: product.aw_deep_link,
          padelMarketInStock: true,
          padelMarketFeedProductId: feedProductId || undefined,
          padelMarketFeedLastUpdated: now,
          currentPrice: price > 0 ? price.toFixed(2) : undefined,
        };
        
        await storage.updateRacket(potentialDuplicate.id, updateData);
        console.log(`[PadelMarket-Processor] Updated (duplicate check): ${potentialDuplicate.brand} ${potentialDuplicate.model} ${potentialDuplicate.year}`);
        return { action: "updated" };
      }
      
      // No duplicate found, create new racket
      const shape = estimateShape(product);
      const ratings = getDefaultRatings(extracted.brand);
      const year = extracted.year || new Date().getFullYear();
      
      const createData = {
        brand: extracted.brand,
        model: extracted.model,
        year: year,
        shape: shape,
        ...ratings,
        currentPrice: price > 0 ? price.toFixed(2) : "0.00",
        imageUrl: product.aw_image_url || product.merchant_image_url || undefined,
        padelMarketAffiliateLink: product.aw_deep_link,
        padelMarketInStock: true,
        padelMarketFeedProductId: feedProductId || undefined,
        padelMarketFeedLastUpdated: now,
        isPublished: false, // New rackets need review before publishing
        inStock: true, // Products from feed are in stock
        color: product.colour || undefined,
      };
      
      const newRacket = await storage.createRacket(createData);
      
      console.log(`[PadelMarket-Processor] Created: ${extracted.brand} ${extracted.model} ${year} - Price: €${price.toFixed(2)} (pending review, isPublished=false)`);
      return { action: "created" };
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[PadelMarket-Processor] Error processing product ${product.product_name}:`, error);
    return { 
      action: "skipped", 
      error: errorMessage 
    };
  }
}

/**
 * Deduplicate products by brand+model+year, keeping the best one from each group
 * Best = lowest price, or if prices are similar, prefer non-special editions
 */
function deduplicateProducts(products: PadelMarketFeedProduct[]): PadelMarketFeedProduct[] {
  const productMap = new Map<string, PadelMarketFeedProduct[]>();
  
  // Group products by brand+model+year
  for (const product of products) {
    const extracted = extractBrandModelYear(product.product_name, product.brand_name);
    if (!extracted.brand || !extracted.model) continue;
    
    const key = `${extracted.brand.toUpperCase()}|${extracted.model.toUpperCase()}|${extracted.year ?? 'N/A'}`;
    
    if (!productMap.has(key)) {
      productMap.set(key, []);
    }
    productMap.get(key)!.push(product);
  }
  
  // For each group, pick the best product
  const deduplicated: PadelMarketFeedProduct[] = [];
  
  for (const [key, group] of productMap.entries()) {
    if (group.length === 1) {
      // No duplicates, keep as is
      deduplicated.push(group[0]);
    } else {
      // Multiple products with same brand+model+year
      // Pick the one with lowest price
      // If prices are similar, prefer the one without "EXCLUSIVE", "EDITION", "SPECIAL" in name
      const sorted = group.sort((a, b) => {
        const priceA = parsePadelMarketPrice(a.store_price || a.search_price || "0");
        const priceB = parsePadelMarketPrice(b.store_price || b.search_price || "0");
        
        // First sort by price (lowest first)
        if (priceA !== priceB) {
          return priceA - priceB;
        }
        
        // If prices are equal, prefer non-special editions
        const aIsSpecial = /(EXCLUSIVE|EDITION|SPECIAL|LIMITED)/i.test(a.product_name);
        const bIsSpecial = /(EXCLUSIVE|EDITION|SPECIAL|LIMITED)/i.test(b.product_name);
        
        if (aIsSpecial && !bIsSpecial) return 1;
        if (!aIsSpecial && bIsSpecial) return -1;
        
        // If both or neither are special, keep original order
        return 0;
      });
      
      deduplicated.push(sorted[0]);
      
      // Log the deduplication
      if (group.length > 1) {
        console.log(`[PadelMarket-Processor] Deduplicated ${group.length} products for ${key.split('|')[0]} ${key.split('|')[1]} ${key.split('|')[2]}`);
        console.log(`  Selected: "${sorted[0].product_name}" (Price: ${sorted[0].store_price || sorted[0].search_price || 'N/A'})`);
        if (group.length > 1) {
          console.log(`  Skipped ${group.length - 1} duplicate(s)`);
        }
      }
    }
  }
  
  return deduplicated;
}

/**
 * Process Padel Market feed products and update rackets
 */
export async function processPadelMarketFeed(
  products: PadelMarketFeedProduct[]
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    success: false,
    totalProcessed: 0,
    matched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    markedOutOfStock: 0,
    errors: [],
    startTime: new Date(),
  };

  // Track all feed product IDs that were successfully processed
  const processedFeedProductIds: string[] = [];

  // Deduplicate products before processing
  console.log(`[PadelMarket-Processor] Deduplicating ${products.length} products...`);
  const deduplicatedProducts = deduplicateProducts(products);
  const duplicatesRemoved = products.length - deduplicatedProducts.length;
  if (duplicatesRemoved > 0) {
    console.log(`[PadelMarket-Processor] Removed ${duplicatesRemoved} duplicate product(s)`);
  }

  console.log(`[PadelMarket-Processor] Starting to process ${deduplicatedProducts.length} products...`);

  // Process products
  for (const product of deduplicatedProducts) {
    try {
      const { action, error } = await processProduct(product);
      result.totalProcessed++;
      
      // Track successfully processed feed product IDs
      const feedProductId = product.aw_product_id || product.merchant_product_id;
      if (feedProductId && action !== "skipped") {
        processedFeedProductIds.push(feedProductId);
      }
      
      if (action === "created") {
        result.created++;
      } else if (action === "updated") {
        result.matched++;
        result.updated++;
      } else if (action === "unchanged") {
        result.matched++;
        result.unchanged++;
      } else {
        result.skipped++;
        if (error) {
          result.errors.push(`${product.product_name}: ${error}`);
        }
      }
    } catch (error) {
      result.skipped++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      result.errors.push(`${product.product_name}: ${errorMessage}`);
    }
  }

  // Mark rackets as out of stock in Padel Market if they're not in the current feed
  // We'll mark all rackets that have padelMarketFeedProductId but it's not in the current feed
  try {
    const allRackets = await storage.getAllRackets();
    const racketsWithPadelMarket = allRackets.filter(
      r => r.padelMarketFeedProductId && r.padelMarketInStock
    );
    
    let markedOutOfStock = 0;
    for (const racket of racketsWithPadelMarket) {
      if (racket.padelMarketFeedProductId && !processedFeedProductIds.includes(racket.padelMarketFeedProductId)) {
        await storage.updateRacket(racket.id, {
          padelMarketInStock: false,
          padelMarketFeedLastUpdated: new Date(),
        });
        markedOutOfStock++;
      }
    }
    
    result.markedOutOfStock = markedOutOfStock;
    if (markedOutOfStock > 0) {
      console.log(`[PadelMarket-Processor] Marked ${markedOutOfStock} rackets as out of stock in Padel Market`);
    }
  } catch (error) {
    console.error(`[PadelMarket-Processor] Error marking rackets out of stock:`, error);
    result.errors.push(`Failed to mark out of stock: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  result.endTime = new Date();
  result.duration = result.endTime.getTime() - result.startTime.getTime();
  result.success = result.errors.length === 0 || result.matched > 0;

  console.log(`[PadelMarket-Processor] Completed in ${(result.duration / 1000).toFixed(2)}s`);
  console.log(`[PadelMarket-Processor] Results: Created ${result.created}, Matched ${result.matched}, Updated ${result.updated}, Unchanged ${result.unchanged}, Skipped ${result.skipped}, Out of stock ${result.markedOutOfStock}, Errors ${result.errors.length}`);

  return result;
}

