/**
 * Padel Market Feed Processor Service
 * 
 * Processes Padel Market affiliate product feed data and updates rackets in the database.
 */

import { storage } from "../storage.js";
import { SHAPE_VALUES } from "@shared/schema";
import { upscaleProductserveUrl } from "@shared/utils";
import {
  type PadelMarketFeedProduct,
  extractBrandModelYear,
  normalizeYear,
  parsePadelMarketPrice,
} from "./padelMarketFeedSync.js";

type ShapeValue = typeof SHAPE_VALUES[number];

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
 * Estimate racket shape from product name/description.
 * Returns a valid SHAPE_VALUES enum value.
 */
function estimateShape(product: PadelMarketFeedProduct): ShapeValue {
  const text = `${product.product_name} ${product.description || ""} ${product.product_short_description || ""}`.toLowerCase();

  if (text.includes("diamond") || text.includes("diamante")) {
    return "diamond";
  }
  if (text.includes("round") || text.includes("redondo") || text.includes("control")) {
    return "round";
  }
  if (text.includes("hybrid") || text.includes("híbrida")) {
    return "hybrid";
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
  product: PadelMarketFeedProduct,
  processedRackets: Map<string, number>
): Promise<{ action: "created" | "updated" | "unchanged" | "skipped"; error?: string }> {
  try {
    // Extract brand, model, and year from product name
    // Use brand_name from feed if available (more reliable)
    const extracted = extractBrandModelYear(product.product_name, product.brand_name);

    // Skip pickleball rackets
    const textToCheck = `${product.product_name} ${product.description || ""} ${product.product_short_description || ""}`.toLowerCase();
    if (textToCheck.includes('pickleball')) {
      return { action: "skipped", error: "Pickleball racket ignored" };
    }

    if (!extracted.brand || !extracted.model) {
      return {
        action: "skipped",
        error: `Could not extract brand/model from: ${product.product_name}`
      };
    }

    // Try to find existing racket by brand, model, and year
    let existingRacket;

    // Helper to normalize model for comparison (remove brand prefix, year suffix)
    const normalizeModelForMatching = (model: string, brand: string): string => {
      let normalized = normalizeModel(model);
      const brandLower = normalizeBrand(brand);
      // Remove brand prefix if present
      if (normalized.startsWith(brandLower + " ")) {
        normalized = normalized.substring(brandLower.length + 1);
      }
      // Remove year suffix if present (4-digit years)
      normalized = normalized.replace(/\s+20\d{2}\s*$/, "").trim();
      return normalized;
    };

    const normalizedExtractedModel = normalizeModelForMatching(extracted.model, extracted.brand);

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

    // Try variations: model with brand prefix
    if (!existingRacket) {
      const modelWithBrand = `${extracted.brand} ${extracted.model}`;
      if (extracted.year) {
        existingRacket = await storage.getRacketByBrandModelAndYear(
          extracted.brand,
          modelWithBrand,
          extracted.year
        );
      }
      if (!existingRacket) {
        existingRacket = await storage.getRacketByBrandAndModel(
          extracted.brand,
          modelWithBrand
        );
      }
    }

    // Try variations: model with year suffix
    if (!existingRacket && extracted.year) {
      const modelWithYear = `${extracted.model} ${extracted.year}`;
      existingRacket = await storage.getRacketByBrandAndModel(
        extracted.brand,
        modelWithYear
      );
    }

    // If still no match, try fuzzy model matching with all rackets of the same brand
    if (!existingRacket) {
      const allRackets = await storage.getAllRackets();
      const brandRackets = allRackets.filter(
        r => normalizeBrand(r.brand) === normalizeBrand(extracted.brand)
      );

      for (const racket of brandRackets) {
        const normalizedRacketModel = normalizeModelForMatching(racket.model, racket.brand);

        // Try exact normalized match first
        if (normalizedRacketModel === normalizedExtractedModel) {
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

        // Try fuzzy similarity match
        if (!existingRacket && isSimilar(normalizedRacketModel, normalizedExtractedModel)) {
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
    const price = parsePadelMarketPrice(product.store_price || product.search_price || "0") ?? 0;

    // Helper function to parse current price from racket
    const parseCurrentPrice = (priceStr: string | null | undefined): number => {
      if (!priceStr) return 0;
      const parsed = parseFloat(priceStr);
      return isNaN(parsed) ? 0 : parsed;
    };

    if (existingRacket) {
      // Log which feed product matched which DB racket
      console.log(`[PadelMarket-Processor] Matched: "${product.product_name}" (€${price.toFixed(2)}) → DB racket: ${existingRacket.brand} ${existingRacket.model} ${existingRacket.year}`);

      // UPDATE EXISTING RACKET
      const updateData: {
        padelMarketAffiliateLink?: string;
        padelMarketInStock: boolean;
        padelMarketFeedProductId?: string;
        padelMarketFeedLastUpdated: Date;
        currentPrice?: string;
        originalPrice?: string;
      } = {
        padelMarketInStock: true,
        padelMarketFeedProductId: feedProductId || undefined,
        padelMarketFeedLastUpdated: now,
      };

      // Check if we already processed this racket in THIS sync run
      const previousBestPriceStr = processedRackets.get(existingRacket.id);
      const isFirstTimeThisRun = previousBestPriceStr === undefined;
      const previousBestPrice = previousBestPriceStr ?? Infinity;
      const isBetterPriceThisRun = price > 0 && price < previousBestPrice;

      if (!isFirstTimeThisRun && !isBetterPriceThisRun) {
        // We already processed a cheaper/equal variant of this racket during this sync.
        // Skip updating link and price to avoid overwriting with a worse variant.
        console.log(`[PadelMarket-Processor] Skipped variant: "${product.product_name}" (€${price.toFixed(2)}) - already found better/equal variant this run.`);
        return { action: "unchanged" };
      }

      // Record this price as the best for this run
      if (price > 0) {
        processedRackets.set(existingRacket.id, price);
      }

      // Always update price to current feed price (keep it fresh and accurate)
      const currentPriceValue = parseCurrentPrice(existingRacket.currentPrice);
      if (price > 0) {
        updateData.currentPrice = price.toFixed(2);

        // Also set originalPrice from Padel Market feed (rrp_price or product_price_old) if available
        const rrpPrice = parsePadelMarketPrice(product.rrp_price);
        const oldPrice = parsePadelMarketPrice(product.product_price_old);
        const originalPriceFromFeed = rrpPrice && rrpPrice > price ? rrpPrice
          : oldPrice && oldPrice > price ? oldPrice
            : undefined;
        if (originalPriceFromFeed) {
          updateData.originalPrice = originalPriceFromFeed.toFixed(2);
        }
      }

      // Always update link to this one since we proved above it's the best seen this run
      updateData.padelMarketAffiliateLink = product.aw_deep_link;

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

      // Record price history when price changes
      if (updateData.currentPrice && existingRacket.currentPrice !== updateData.currentPrice) {
        try {
          await storage.createPriceHistoryEntry({
            racketId: existingRacket.id,
            price: updateData.currentPrice,
            source: "padel_market_feed",
          });
        } catch (e) {
          console.warn(`[PadelMarket-Processor] Failed to record price history for ${existingRacket.brand} ${existingRacket.model}`);
        }
      }

      const changes = [];
      if (updateData.padelMarketAffiliateLink) changes.push("link updated");
      if (updateData.currentPrice && existingRacket.currentPrice !== updateData.currentPrice) {
        changes.push(`price: €${currentPriceValue.toFixed(2)} → €${price.toFixed(2)}`);
      }
      if (existingRacket.padelMarketInStock !== updateData.padelMarketInStock) changes.push("stock status updated");

      if (changes.length > 0) {
        console.log(`[PadelMarket-Processor] Updated: ${existingRacket.brand} ${existingRacket.model} ${existingRacket.year} - ${changes.join(", ")}`);
      }
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
        console.log(`[PadelMarket-Processor] Matched (dup-check): "${product.product_name}" (€${price.toFixed(2)}) → DB racket: ${potentialDuplicate.brand} ${potentialDuplicate.model} ${potentialDuplicate.year}`);

        const updateData: {
          padelMarketAffiliateLink?: string;
          padelMarketInStock: boolean;
          padelMarketFeedProductId?: string;
          padelMarketFeedLastUpdated: Date;
          currentPrice?: string;
          originalPrice?: string;
        } = {
          padelMarketInStock: true,
          padelMarketFeedProductId: feedProductId || undefined,
          padelMarketFeedLastUpdated: now,
        };

        // Track that we processed this duplicate
        const previousBestPriceStr = processedRackets.get(potentialDuplicate.id);
        const isFirstTimeThisRun = previousBestPriceStr === undefined;
        const previousBestPrice = previousBestPriceStr ?? Infinity;
        const isBetterPriceThisRun = price > 0 && price < previousBestPrice;

        if (!isFirstTimeThisRun && !isBetterPriceThisRun) {
          console.log(`[PadelMarket-Processor] Skipped dup variant: "${product.product_name}" (€${price.toFixed(2)})`);
          return { action: "unchanged" };
        }

        if (price > 0) {
          processedRackets.set(potentialDuplicate.id, price);
        }

        // Always update price to current feed price
        const currentPriceValue = parseCurrentPrice(potentialDuplicate.currentPrice);
        if (price > 0) {
          updateData.currentPrice = price.toFixed(2);

          // Also set originalPrice from Padel Market feed if available
          const rrpPrice = parsePadelMarketPrice(product.rrp_price);
          const oldPrice = parsePadelMarketPrice(product.product_price_old);
          const originalPriceFromFeed = rrpPrice && rrpPrice > price ? rrpPrice
            : oldPrice && oldPrice > price ? oldPrice
              : undefined;
          if (originalPriceFromFeed) {
            updateData.originalPrice = originalPriceFromFeed.toFixed(2);
          }
        }

        // Always update link (proved best this run)
        updateData.padelMarketAffiliateLink = product.aw_deep_link;

        await storage.updateRacket(potentialDuplicate.id, updateData);

        // Record price history when price changes
        if (updateData.currentPrice && potentialDuplicate.currentPrice !== updateData.currentPrice) {
          try {
            await storage.createPriceHistoryEntry({
              racketId: potentialDuplicate.id,
              price: updateData.currentPrice,
              source: "padel_market_feed",
            });
          } catch (e) {
            console.warn(`[PadelMarket-Processor] Failed to record price history for ${potentialDuplicate.brand} ${potentialDuplicate.model}`);
          }
        }

        const duplicateChanges = [];
        if (updateData.padelMarketAffiliateLink) duplicateChanges.push("link updated");
        if (updateData.currentPrice && potentialDuplicate.currentPrice !== updateData.currentPrice) {
          duplicateChanges.push(`price: €${currentPriceValue.toFixed(2)} → €${price.toFixed(2)}`);
        }

        if (duplicateChanges.length > 0) {
          console.log(`[PadelMarket-Processor] Updated (dup-check): ${potentialDuplicate.brand} ${potentialDuplicate.model} ${potentialDuplicate.year} - ${duplicateChanges.join(", ")}`);
        }
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
        imageUrl: upscaleProductserveUrl(product.aw_image_url || product.merchant_image_url) || undefined,
        padelMarketAffiliateLink: product.aw_deep_link,
        padelMarketInStock: true,
        padelMarketFeedProductId: feedProductId || undefined,
        padelMarketFeedLastUpdated: now,
        isPublished: false, // New rackets need review before publishing
        inStock: true, // Products from feed are in stock
        color: product.colour || undefined,
      };

      const newRacket = await storage.createRacket(createData);

      // Record initial price in history
      if (price > 0) {
        try {
          await storage.createPriceHistoryEntry({
            racketId: newRacket.id,
            price: price.toFixed(2),
            source: "padel_market_feed",
          });
        } catch (e) {
          console.warn(`[PadelMarket-Processor] Failed to record initial price for ${extracted.brand} ${extracted.model}`);
        }
      }

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
        const priceA = parsePadelMarketPrice(a.store_price || a.search_price || "0") ?? 0;
        const priceB = parsePadelMarketPrice(b.store_price || b.search_price || "0") ?? 0;

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

  // Map to track the best (lowest) price we've seen for each racket ID during this sync run
  const processedRackets = new Map<string, number>();

  // Process products
  for (const product of deduplicatedProducts) {
    try {
      const { action, error } = await processProduct(product, processedRackets);
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

