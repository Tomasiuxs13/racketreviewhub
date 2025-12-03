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
 * Process a single Padel Market feed product
 */
async function processProduct(
  product: PadelMarketFeedProduct
): Promise<{ action: "updated" | "unchanged" | "skipped"; error?: string }> {
  try {
    // Extract brand, model, and year from product name
    const extracted = extractBrandModelYear(product.product_name);
    
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
      
      // If found by brand+model but year doesn't match, try fuzzy model matching
      if (existingRacket && extracted.year && existingRacket.year !== extracted.year) {
        // Check if years are close (within 1 year difference)
        if (Math.abs(existingRacket.year - extracted.year) > 1) {
          // Years are too different, skip this match
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
    
    if (!existingRacket) {
      return { 
        action: "skipped", 
        error: `No matching racket found for: ${extracted.brand} ${extracted.model} ${extracted.year || ''}` 
      };
    }
    
    const now = new Date();
    const feedProductId = product.aw_product_id || product.merchant_product_id || "";
    
    // Prepare update data
    const updateData: {
      padelMarketAffiliateLink?: string;
      padelMarketInStock: boolean;
      padelMarketFeedProductId?: string;
      padelMarketFeedLastUpdated: Date;
    } = {
      padelMarketAffiliateLink: product.aw_deep_link,
      padelMarketInStock: true,
      padelMarketFeedProductId: feedProductId || undefined,
      padelMarketFeedLastUpdated: now,
    };
    
    // Check if anything actually changed
    const hasChanged = 
      existingRacket.padelMarketAffiliateLink !== updateData.padelMarketAffiliateLink ||
      existingRacket.padelMarketInStock !== updateData.padelMarketInStock ||
      existingRacket.padelMarketFeedProductId !== updateData.padelMarketFeedProductId;
    
    if (!hasChanged) {
      return { action: "unchanged" };
    }
    
    // Update the racket
    await storage.updateRacket(existingRacket.id, updateData);
    
    console.log(`[PadelMarket-Processor] Updated: ${existingRacket.brand} ${existingRacket.model} ${existingRacket.year} - Link: ${product.aw_deep_link.substring(0, 50)}...`);
    return { action: "updated" };
    
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
 * Process Padel Market feed products and update rackets
 */
export async function processPadelMarketFeed(
  products: PadelMarketFeedProduct[]
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    success: false,
    totalProcessed: 0,
    matched: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    markedOutOfStock: 0,
    errors: [],
    startTime: new Date(),
  };

  // Track all feed product IDs that were successfully processed
  const processedFeedProductIds: string[] = [];

  console.log(`[PadelMarket-Processor] Starting to process ${products.length} products...`);

  // Process products
  for (const product of products) {
    try {
      const { action, error } = await processProduct(product);
      result.totalProcessed++;
      
      // Track successfully processed feed product IDs
      const feedProductId = product.aw_product_id || product.merchant_product_id;
      if (feedProductId && action !== "skipped") {
        processedFeedProductIds.push(feedProductId);
      }
      
      if (action === "updated") {
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
  console.log(`[PadelMarket-Processor] Results: Matched ${result.matched}, Updated ${result.updated}, Unchanged ${result.unchanged}, Skipped ${result.skipped}, Out of stock ${result.markedOutOfStock}, Errors ${result.errors.length}`);

  return result;
}

