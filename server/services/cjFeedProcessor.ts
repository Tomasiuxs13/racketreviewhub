/**
 * CJ Feed Processor Service
 * 
 * Processes CJ affiliate product feed data and updates/creates rackets in the database.
 */

import { storage } from "../storage.js";
import { estimateRacketRatings, generateRacketReview } from "../lib/openai.js";
import { type CjFeedProduct } from "@shared/schema";
import { parseCjPrice, extractModelFromTitle } from "./cjFeedSync.js";

export interface ProcessingResult {
  success: boolean;
  totalProcessed: number;
  created: number;
  updated: number;
  unchanged: number; // Products where data was identical, no DB write needed
  skipped: number; // Products skipped due to errors or missing data
  markedOutOfStock: number; // Rackets marked out of stock (not in current feed)
  errors: string[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export interface RacketUpdateData {
  currentPrice: string;
  originalPrice?: string;
  affiliateLink: string;
  imageUrl?: string;
  feedProductId: string;
  feedLastUpdated: Date;
  inStock?: boolean;
}

export interface RacketCreateData {
  brand: string;
  model: string;
  year: number;
  shape: string;
  powerRating: number;
  controlRating: number;
  reboundRating: number;
  maneuverabilityRating: number;
  sweetSpotRating: number;
  currentPrice: string;
  originalPrice?: string;
  imageUrl?: string;
  affiliateLink: string;
  feedProductId: string;
  feedLastUpdated: Date;
  isPublished: boolean;
  color?: string;
  reviewContent?: string;
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
 * Estimate racket shape based on description and title
 */
function estimateShape(product: CjFeedProduct): "diamond" | "round" | "teardrop" {
  const text = `${product.TITLE} ${product.DESCRIPTION || ""}`.toLowerCase();
  
  // Check for shape keywords
  if (text.includes("diamond") || text.includes("diamante")) {
    return "diamond";
  }
  if (text.includes("round") || text.includes("redonda") || text.includes("control")) {
    return "round";
  }
  if (text.includes("teardrop") || text.includes("lágrima") || text.includes("hybrid") || text.includes("versatile")) {
    return "teardrop";
  }
  
  // Default to teardrop for balanced performance
  return "teardrop";
}

/**
 * Get default ratings based on brand reputation
 */
function getDefaultRatings(brand: string): {
  powerRating: number;
  controlRating: number;
  reboundRating: number;
  maneuverabilityRating: number;
  sweetSpotRating: number;
} {
  const brandLower = normalizeBrand(brand);
  
  // High-end brands
  if (["nox", "bullpadel", "head"].includes(brandLower)) {
    return {
      powerRating: 82,
      controlRating: 80,
      reboundRating: 81,
      maneuverabilityRating: 79,
      sweetSpotRating: 80,
    };
  }
  
  // Premium brands
  if (["babolat", "adidas", "wilson"].includes(brandLower)) {
    return {
      powerRating: 80,
      controlRating: 81,
      reboundRating: 79,
      maneuverabilityRating: 80,
      sweetSpotRating: 79,
    };
  }
  
  // Default
  return {
    powerRating: 75,
    controlRating: 76,
    reboundRating: 74,
    maneuverabilityRating: 75,
    sweetSpotRating: 75,
  };
}

/**
 * Normalize price string for comparison (remove trailing zeros, handle decimals)
 */
function normalizePrice(price: string | number | null | undefined): string {
  if (price === null || price === undefined) return "";
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(numPrice)) return "";
  return numPrice.toFixed(2);
}

/**
 * Check if two values are different (handles null/undefined)
 */
function hasChanged(oldValue: string | null | undefined, newValue: string | null | undefined): boolean {
  const old = oldValue ?? "";
  const newVal = newValue ?? "";
  return old !== newVal;
}

/**
 * Process a single CJ feed product
 */
async function processProduct(
  product: CjFeedProduct,
  options: { generateRatings?: boolean; generateReviews?: boolean } = {}
): Promise<{ action: "created" | "updated" | "unchanged" | "skipped"; feedProductId?: string; error?: string }> {
  const { generateRatings = true, generateReviews = true } = options;
  
  try {
    const feedProductId = product.ID;
    const brand = product.BRAND;
    const model = extractModelFromTitle(product.TITLE, brand);
    const currentPrice = parseCjPrice(product.SALE_PRICE) || parseCjPrice(product.PRICE);
    const originalPrice = parseCjPrice(product.PRICE);
    
    if (!currentPrice) {
      return { action: "skipped", feedProductId, error: `No valid price found for ${product.ID}` };
    }

    // Try to find existing racket
    let existingRacket = await storage.getRacketByFeedProductId(feedProductId);
    
    if (!existingRacket) {
      // Try matching by brand and model (multiple variations)
      // Variation 1: Direct match (brand + extracted model)
      existingRacket = await storage.getRacketByBrandAndModel(brand, model);
      
      // Variation 2: Model might include brand prefix in database
      if (!existingRacket) {
        const modelWithBrand = `${brand} ${model}`;
        existingRacket = await storage.getRacketByBrandAndModel(brand, modelWithBrand);
      }
      
      // Variation 3: Try using full TITLE as model (some databases store it this way)
      if (!existingRacket) {
        existingRacket = await storage.getRacketByBrandAndModel(brand, product.TITLE);
      }
      
      if (existingRacket) {
        console.log(`[CJ-Processor] Matched existing racket: ${existingRacket.brand} ${existingRacket.model}`);
      }
    }

    const now = new Date();

    if (existingRacket) {
      // Prepare new values for comparison
      const newCurrentPrice = currentPrice.toFixed(2);
      const newOriginalPrice = originalPrice && originalPrice !== currentPrice 
        ? originalPrice.toFixed(2) 
        : null;
      const newAffiliateLink = product.LINK;
      const newImageUrl = product.IMAGE_LINK || null;

      // Check what has actually changed
      const priceChanged = hasChanged(
        normalizePrice(existingRacket.currentPrice), 
        newCurrentPrice
      );
      const originalPriceChanged = hasChanged(
        normalizePrice(existingRacket.originalPrice),
        newOriginalPrice || ""
      );
      const linkChanged = hasChanged(existingRacket.affiliateLink, newAffiliateLink);
      const feedProductIdChanged = hasChanged(existingRacket.feedProductId, feedProductId);
      
      // Only update image if we don't have one and feed provides one
      const shouldUpdateImage = !existingRacket.imageUrl && newImageUrl;
      
      // Check if racket was out of stock and is now back in stock
      const wasOutOfStock = existingRacket.inStock === false;
      
      // Check if racket needs feed_product_id linked (important for stock tracking)
      const needsFeedIdLink = !existingRacket.feedProductId && feedProductId;

      // If nothing has changed and already in stock and has feed_product_id, skip the update entirely
      if (!priceChanged && !originalPriceChanged && !linkChanged && !feedProductIdChanged && !shouldUpdateImage && !wasOutOfStock && !needsFeedIdLink) {
        console.log(`[CJ-Processor] Unchanged: ${brand} ${model} - DB Price: €${normalizePrice(existingRacket.currentPrice)}, Feed Price: €${newCurrentPrice} (no update needed)`);
        return { action: "unchanged", feedProductId };
      }

      // Build update data only with changed fields
      const updateData: Partial<RacketUpdateData> = {
        feedLastUpdated: now,
        inStock: true, // Always mark as in stock when found in feed
      };

      // Log what's being updated
      const changes: string[] = [];
      
      if (wasOutOfStock) {
        changes.push(`marked back in stock`);
      }
      
      if (needsFeedIdLink) {
        updateData.feedProductId = feedProductId;
        changes.push(`feed product ID linked`);
      }

      if (priceChanged) {
        updateData.currentPrice = newCurrentPrice;
        changes.push(`price: €${normalizePrice(existingRacket.currentPrice)} → €${newCurrentPrice}`);
      }

      if (originalPriceChanged && newOriginalPrice) {
        updateData.originalPrice = newOriginalPrice;
        changes.push(`original price updated`);
      }

      // Only update affiliate link if it doesn't already exist (preserve manual edits)
      if (linkChanged && !existingRacket.affiliateLink && !existingRacket.titleUrl) {
        updateData.affiliateLink = newAffiliateLink;
        changes.push(`affiliate link added`);
      } else if (linkChanged && (existingRacket.affiliateLink || existingRacket.titleUrl)) {
        // Link exists, skip update to preserve manual edits
        console.log(`[CJ-Processor] Preserving existing affiliate link for ${brand} ${model} (manual edit detected)`);
      }

      if (feedProductIdChanged) {
        updateData.feedProductId = feedProductId;
        changes.push(`feed product ID linked`);
      }

      if (shouldUpdateImage) {
        updateData.imageUrl = newImageUrl!;
        changes.push(`image added`);
      }

      await storage.updateRacket(existingRacket.id, updateData);
      console.log(`[CJ-Processor] Updated: ${brand} ${model} - Changes: ${changes.join(", ")}`);
      return { action: "updated", feedProductId };
    } else {
      // Create new racket
      const shape = estimateShape(product);
      let ratings = getDefaultRatings(brand);

      // Try to estimate ratings using ChatGPT
      if (generateRatings) {
        try {
          const estimatedRatings = await estimateRacketRatings({
            brand,
            model,
            shape,
            year: new Date().getFullYear(),
          });
          if (estimatedRatings) {
            ratings = estimatedRatings;
          }
        } catch (ratingError) {
          console.warn(`[CJ-Processor] Rating estimation failed for ${brand} ${model}, using defaults`);
        }
      }

      const createData: RacketCreateData & { inStock: boolean } = {
        brand,
        model,
        year: new Date().getFullYear(),
        shape,
        ...ratings,
        currentPrice: currentPrice.toFixed(2),
        originalPrice: originalPrice && originalPrice !== currentPrice ? originalPrice.toFixed(2) : undefined,
        imageUrl: product.IMAGE_LINK,
        affiliateLink: product.LINK,
        feedProductId,
        feedLastUpdated: now,
        isPublished: false, // New rackets from feed need review
        inStock: true, // Products from feed are in stock
        color: product.COLOR !== "Unknow" ? product.COLOR : undefined,
      };

      const newRacket = await storage.createRacket(createData);

      // Generate review with ChatGPT
      if (generateReviews && newRacket) {
        try {
          const reviewResult = await generateRacketReview(newRacket);
          if (reviewResult?.reviewContent) {
            await storage.updateRacket(newRacket.id, {
              reviewContent: reviewResult.reviewContent,
            });
          }
        } catch (reviewError) {
          console.warn(`[CJ-Processor] Review generation failed for ${brand} ${model}`);
        }
      }

      console.log(`[CJ-Processor] Created: ${brand} ${model} - Price: €${currentPrice} (pending review)`);
      return { action: "created", feedProductId };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[CJ-Processor] Error processing ${product.ID}:`, error);
    return { action: "skipped", feedProductId: product.ID, error: errorMessage };
  }
}

/**
 * Process all products from CJ feed
 */
export async function processCjFeed(
  products: CjFeedProduct[],
  options: { 
    generateRatings?: boolean; 
    generateReviews?: boolean;
    batchSize?: number;
    delayBetweenBatches?: number;
  } = {}
): Promise<ProcessingResult> {
  const { 
    generateRatings = true, 
    generateReviews = true,
    batchSize = 5,
    delayBetweenBatches = 1000,
  } = options;

  const result: ProcessingResult = {
    success: false,
    totalProcessed: 0,
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

  console.log(`[CJ-Processor] Starting to process ${products.length} products...`);

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    
    for (const product of batch) {
      try {
        const { action, feedProductId, error } = await processProduct(product, { generateRatings, generateReviews });
        result.totalProcessed++;
        
        // Track successfully processed feed product IDs
        if (feedProductId && action !== "skipped") {
          processedFeedProductIds.push(feedProductId);
        }
        
        if (action === "created") {
          result.created++;
        } else if (action === "updated") {
          result.updated++;
        } else if (action === "unchanged") {
          result.unchanged++;
        } else {
          result.skipped++;
          if (error) {
            result.errors.push(`${product.ID}: ${error}`);
          }
        }
      } catch (error) {
        result.skipped++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`${product.ID}: ${errorMessage}`);
      }
    }

    // Progress logging
    console.log(`[CJ-Processor] Progress: ${result.totalProcessed}/${products.length} (Created: ${result.created}, Updated: ${result.updated}, Unchanged: ${result.unchanged}, Skipped: ${result.skipped})`);

    // Delay between batches to avoid rate limits
    if (i + batchSize < products.length && delayBetweenBatches > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  // Mark rackets not in current feed as out of stock
  if (processedFeedProductIds.length > 0) {
    try {
      const outOfStockCount = await storage.markOutOfStockExcept(processedFeedProductIds);
      result.markedOutOfStock = outOfStockCount;
      if (outOfStockCount > 0) {
        console.log(`[CJ-Processor] Marked ${outOfStockCount} rackets as out of stock (not in current feed)`);
      }
    } catch (error) {
      console.error(`[CJ-Processor] Error marking rackets out of stock:`, error);
      result.errors.push(`Failed to mark out of stock: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  result.endTime = new Date();
  result.duration = result.endTime.getTime() - result.startTime.getTime();
  result.success = result.errors.length === 0 || result.created > 0 || result.updated > 0 || result.unchanged > 0;

  console.log(`[CJ-Processor] Completed in ${(result.duration / 1000).toFixed(2)}s`);
  console.log(`[CJ-Processor] Results: Created ${result.created}, Updated ${result.updated}, Unchanged ${result.unchanged}, Skipped ${result.skipped}, Out of stock ${result.markedOutOfStock}, Errors ${result.errors.length}`);

  return result;
}

/**
 * Quick update of prices only (no AI generation, faster processing)
 */
export async function quickPriceUpdate(products: CjFeedProduct[]): Promise<ProcessingResult> {
  return processCjFeed(products, {
    generateRatings: false,
    generateReviews: false,
    batchSize: 20,
    delayBetweenBatches: 100,
  });
}

