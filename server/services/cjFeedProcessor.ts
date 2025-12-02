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
  skipped: number;
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
 * Process a single CJ feed product
 */
async function processProduct(
  product: CjFeedProduct,
  options: { generateRatings?: boolean; generateReviews?: boolean } = {}
): Promise<{ action: "created" | "updated" | "skipped"; error?: string }> {
  const { generateRatings = true, generateReviews = true } = options;
  
  try {
    const feedProductId = product.ID;
    const brand = product.BRAND;
    const model = extractModelFromTitle(product.TITLE, brand);
    const currentPrice = parseCjPrice(product.SALE_PRICE) || parseCjPrice(product.PRICE);
    const originalPrice = parseCjPrice(product.PRICE);
    
    if (!currentPrice) {
      return { action: "skipped", error: `No valid price found for ${product.ID}` };
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
      // Update existing racket - only update price and affiliate data
      const updateData: Partial<RacketUpdateData> = {
        currentPrice: currentPrice.toFixed(2),
        affiliateLink: product.LINK,
        feedProductId: feedProductId,
        feedLastUpdated: now,
      };

      // Update original price if different from sale price
      if (originalPrice && originalPrice !== currentPrice) {
        updateData.originalPrice = originalPrice.toFixed(2);
      }

      // Update image if we don't have one or if it's from the feed
      if (!existingRacket.imageUrl && product.IMAGE_LINK) {
        updateData.imageUrl = product.IMAGE_LINK;
      }

      await storage.updateRacket(existingRacket.id, updateData);
      console.log(`[CJ-Processor] Updated: ${brand} ${model} - Price: €${currentPrice}`);
      return { action: "updated" };
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

      const createData: RacketCreateData = {
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
      return { action: "created" };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[CJ-Processor] Error processing ${product.ID}:`, error);
    return { action: "skipped", error: errorMessage };
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
    skipped: 0,
    errors: [],
    startTime: new Date(),
  };

  console.log(`[CJ-Processor] Starting to process ${products.length} products...`);

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    
    for (const product of batch) {
      try {
        const { action, error } = await processProduct(product, { generateRatings, generateReviews });
        result.totalProcessed++;
        
        if (action === "created") {
          result.created++;
        } else if (action === "updated") {
          result.updated++;
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
    console.log(`[CJ-Processor] Progress: ${result.totalProcessed}/${products.length} (Created: ${result.created}, Updated: ${result.updated}, Skipped: ${result.skipped})`);

    // Delay between batches to avoid rate limits
    if (i + batchSize < products.length && delayBetweenBatches > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  result.endTime = new Date();
  result.duration = result.endTime.getTime() - result.startTime.getTime();
  result.success = result.errors.length === 0 || result.created > 0 || result.updated > 0;

  console.log(`[CJ-Processor] Completed in ${(result.duration / 1000).toFixed(2)}s`);
  console.log(`[CJ-Processor] Results: Created ${result.created}, Updated ${result.updated}, Skipped ${result.skipped}, Errors ${result.errors.length}`);

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

