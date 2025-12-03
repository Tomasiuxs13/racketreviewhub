/**
 * Padel Market Awin Feed Sync Service
 * 
 * Handles downloading and parsing the Padel Market affiliate product feed from Awin.
 */

import { parse } from "csv-parse/sync";
import { gunzipSync } from "zlib";
import { z } from "zod";

// Awin feed URL
const PADEL_MARKET_FEED_URL = process.env.PADEL_MARKET_FEED_URL || 
  "https://productdata.awin.com/datafeed/download/apikey/5aba492dc708d8e060aa88b777d91835/language/en/cid/97,98,142,144,146,129,595,539,147,149,613,626,135,163,159,161,170,137,171,548,174,183,178,179,175,172,623,139,614,189,194,141,205,198,206,203,208,199,204,201,61,62,72,73,71,74,75,76,77,63,80,64,83,84,85,65,86,88,90,89,91,67,94,33,53,52,603,66,128,130,133,212,209,210,211,68,69,213,220,70,224,225,226,227,228,229,4,5,537,15,14,6,22,24,25,7,30,29,32,619,8,35,618,42,43,9,50,634,230,538,235,241,242,521,576,577,579,281,283,285,286,282,290,287,288,627,173,193,637,177,196,379,648,181,645,384,387,646,598,611,391,393,647,395,631,602,570,600,405,187,411,412,414,415,416,417,649,418,419,420,99,100,101,107,110,111,113,114,115,116,118,121,122,127,581,624,123,594,125,421,605,604,599,422,433,434,436,532,428,474,475,476,477,423,608,437,438,441,444,445,446,424,451,448,453,449,452,450,425,455,457,459,460,456,458,426,616,463,464,465,466,427,625,597,473,469,617,470,429,430,481,615,483,484,485,488,529,596,431,432,489,490,361,633,362,367,369,363,372,374,377,375,536,535,364,380,381,365,383,390,402,404,406,407,540,542,544,546,547,246,247,252,559,255,248,256,258,259,632,260,261,262,557,249,266,267,268,269,612,251,277,250,272,271,561,560,347,348,354,350,351,349,357,358,360,586,588,328,629,333,336,338,493,635,495,507,563,564,566,567,569,568/fid/98176/rid/0/hasEnhancedFeeds/0/columns/aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,description,merchant_category,search_price,merchant_name,merchant_id,category_name,category_id,aw_image_url,currency,store_price,delivery_cost,merchant_deep_link,language,last_updated,display_price,data_feed_id,rrp_price,saving,savings_percent,base_price,base_price_amount,base_price_text,product_price_old,commission_group,merchant_product_category_path,merchant_product_second_category,merchant_product_third_category,brand_name,brand_id,colour,product_short_description,specifications,condition,product_model,model_number,dimensions,keywords,promotional_text,product_type,in_stock/format/csv/delimiter/%2C/compression/gzip/adultcontent/1/";

// Padel Market feed product schema
export const padelMarketFeedProductSchema = z.object({
  aw_deep_link: z.string().url(),
  product_name: z.string().min(1),
  aw_product_id: z.string().optional(),
  merchant_product_id: z.string().optional(),
  merchant_image_url: z.string().url().optional(),
  description: z.string().optional(),
  merchant_category: z.string().optional(),
  search_price: z.string().optional(),
  merchant_name: z.string().optional(),
  merchant_id: z.string().optional(),
  category_name: z.string().optional(),
  category_id: z.string().optional(),
  aw_image_url: z.string().url().optional(),
  currency: z.string().optional(),
  store_price: z.string().optional(),
  delivery_cost: z.string().optional(),
  merchant_deep_link: z.string().url().optional(),
  language: z.string().optional(),
  last_updated: z.string().optional(),
  display_price: z.string().optional(),
  data_feed_id: z.string().optional(),
  rrp_price: z.string().optional(),
  saving: z.string().optional(),
  savings_percent: z.string().optional(),
  base_price: z.string().optional(),
  base_price_amount: z.string().optional(),
  base_price_text: z.string().optional(),
  product_price_old: z.string().optional(),
  commission_group: z.string().optional(),
  merchant_product_category_path: z.string().optional(),
  merchant_product_second_category: z.string().optional(),
  merchant_product_third_category: z.string().optional(),
  brand_name: z.string().optional(),
  brand_id: z.string().optional(),
  colour: z.string().optional(),
  product_short_description: z.string().optional(),
  specifications: z.string().optional(),
  condition: z.string().optional(),
  product_model: z.string().optional(),
  model_number: z.string().optional(),
  dimensions: z.string().optional(),
  keywords: z.string().optional(),
  promotional_text: z.string().optional(),
  product_type: z.string(),
  in_stock: z.string().optional(),
});

export type PadelMarketFeedProduct = z.infer<typeof padelMarketFeedProductSchema>;

export interface ParsedFeedResult {
  success: boolean;
  products?: PadelMarketFeedProduct[];
  totalProducts?: number;
  rackets?: number;
  error?: string;
}

/**
 * Download the gzipped CSV feed from Awin URL
 */
export async function downloadPadelMarketFeed(): Promise<{ success: boolean; data?: Buffer; error?: string }> {
  try {
    console.log("[PadelMarket-Feed] Downloading feed from Awin...");
    const response = await fetch(PADEL_MARKET_FEED_URL);
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log(`[PadelMarket-Feed] Downloaded ${buffer.length} bytes (gzipped)`);
    
    return {
      success: true,
      data: buffer,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown download error";
    console.error("[PadelMarket-Feed] Error downloading feed:", error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Decompress gzipped data and return as string
 */
function decompressGzip(buffer: Buffer): string {
  try {
    const decompressed = gunzipSync(buffer);
    return decompressed.toString("utf-8");
  } catch (error) {
    throw new Error(`Failed to decompress gzip: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Parse price from Awin feed format (e.g., "109.95", "€109.95")
 */
export function parsePadelMarketPrice(priceStr: string | undefined): number | undefined {
  if (!priceStr) return undefined;
  
  // Remove currency symbols and whitespace
  const cleaned = priceStr.replace(/[€£$,\s]/g, "").trim();
  const price = parseFloat(cleaned);
  
  return isNaN(price) ? undefined : price;
}

/**
 * Normalize year: "22" -> 2022, "2025" -> 2025
 * If year < 50, assume 20XX, else 19XX
 */
export function normalizeYear(yearStr: string | number | undefined): number | undefined {
  if (!yearStr) return undefined;
  
  const year = typeof yearStr === "string" ? parseInt(yearStr, 10) : yearStr;
  if (isNaN(year)) return undefined;
  
  // If 2-digit year, normalize to 4-digit
  if (year < 100) {
    // If year < 50, assume 20XX, else 19XX
    return year < 50 ? 2000 + year : 1900 + year;
  }
  
  return year;
}

/**
 * Extract brand, model, and year from product name
 * Examples:
 * - "BULLPADEL VERTEX Junior Boy 22 (Racket)" -> brand: "BULLPADEL", model: "VERTEX", year: 2022
 * - "BULLPADEL PEARL Cloud 2025 BEA GONZALEZ (Racket)" -> brand: "BULLPADEL", model: "PEARL Cloud", year: 2025
 */
export interface ExtractedProductInfo {
  brand: string;
  model: string;
  year: number | undefined;
}

export function extractBrandModelYear(productName: string): ExtractedProductInfo {
  // Remove "(Racket)" suffix and trim
  let cleaned = productName.replace(/\s*\(Racket\)\s*$/i, "").trim();
  
  // Extract year (4-digit or 2-digit)
  const yearMatch = cleaned.match(/\b(20\d{2}|\d{2})\b/);
  let year: number | undefined;
  let yearStr: string | undefined;
  
  if (yearMatch) {
    yearStr = yearMatch[1];
    year = normalizeYear(yearStr);
    // Remove year from cleaned string
    cleaned = cleaned.replace(/\b(20\d{2}|\d{2})\b/, "").trim();
  }
  
  // Split into words
  const words = cleaned.split(/\s+/);
  
  if (words.length === 0) {
    return { brand: "", model: "", year: undefined };
  }
  
  // First word is typically the brand
  const brand = words[0].toUpperCase();
  
  // Rest is the model, but we need to clean it up
  // Remove common player names and variations (Junior, Boy, Girl, etc.)
  const modelWords = words.slice(1).filter(word => {
    const upper = word.toUpperCase();
    // Skip common variations
    return !["JUNIOR", "BOY", "GIRL", "WOMAN", "MAN", "PRO", "PLAYER"].includes(upper) &&
           !/^[A-Z]{2,3}$/.test(upper); // Skip 2-3 letter acronyms that might be player initials
  });
  
  // Also try to remove player names (typically all caps or mixed case names)
  // This is a heuristic - player names are often after the model
  let model = modelWords.join(" ");
  
  // If we have a year, try to find where the model ends and player name begins
  // Common pattern: MODEL YEAR PLAYER_NAME
  if (yearStr && modelWords.length > 2) {
    // Look for all-caps words that might be player names
    const allCapsWords = modelWords.filter(w => /^[A-Z]+$/.test(w) && w.length > 3);
    if (allCapsWords.length > 0) {
      // Find the index of the first all-caps word
      const firstAllCapsIndex = modelWords.findIndex(w => allCapsWords.includes(w));
      if (firstAllCapsIndex > 0) {
        model = modelWords.slice(0, firstAllCapsIndex).join(" ");
      }
    }
  }
  
  // Fallback: if model is empty, use remaining words
  if (!model || model.trim() === "") {
    model = words.slice(1).join(" ");
  }
  
  return {
    brand: brand.trim(),
    model: model.trim(),
    year: year,
  };
}

/**
 * Parse the CSV feed data and extract racket products
 */
export function parsePadelMarketFeedData(csvData: string): ParsedFeedResult {
  try {
    console.log("[PadelMarket-Feed] Parsing CSV data...");
    
    // Parse CSV with proper handling of quoted fields
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    console.log(`[PadelMarket-Feed] Parsed ${records.length} total records`);

    // Filter for racket products that are in stock
    const rackets: PadelMarketFeedProduct[] = [];
    let validationErrors = 0;

    for (const record of records) {
      // Check if this is a racket and in stock
      const productType = (record.product_type || "").toLowerCase();
      const inStock = (record.in_stock || "").toLowerCase();
      
      if (productType !== "rackets" && productType !== "racket") {
        continue;
      }
      
      if (inStock !== "true" && inStock !== "1" && inStock !== "yes" && inStock !== "y") {
        continue;
      }

      try {
        // Validate the record against our schema
        const validated = padelMarketFeedProductSchema.parse(record);
        rackets.push(validated);
      } catch (validationError) {
        validationErrors++;
        if (validationErrors <= 5) {
          console.warn(`[PadelMarket-Feed] Validation error for product ${record.product_name}:`, validationError);
        }
      }
    }

    console.log(`[PadelMarket-Feed] Found ${rackets.length} racket products in stock (${validationErrors} validation errors)`);

    return {
      success: true,
      products: rackets,
      totalProducts: records.length,
      rackets: rackets.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown parsing error";
    console.error("[PadelMarket-Feed] Error parsing feed data:", error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Main function to download and parse the Padel Market feed
 */
export async function fetchAndParsePadelMarketFeed(): Promise<ParsedFeedResult> {
  // Download the feed
  const downloadResult = await downloadPadelMarketFeed();
  
  if (!downloadResult.success || !downloadResult.data) {
    return {
      success: false,
      error: downloadResult.error || "Failed to download feed",
    };
  }

  // Decompress gzipped data
  let csvData: string;
  try {
    csvData = decompressGzip(downloadResult.data);
    console.log(`[PadelMarket-Feed] Decompressed to ${csvData.length} characters`);
  } catch (error) {
    return {
      success: false,
      error: `Failed to decompress feed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }

  // Parse the feed data
  return parsePadelMarketFeedData(csvData);
}

/**
 * Parse feed from local file (for testing or manual import)
 */
export function parsePadelMarketFeedFromFile(filePath: string): ParsedFeedResult {
  const fs = require("fs");
  
  try {
    const fileData = fs.readFileSync(filePath);
    
    // Check if it's gzipped (magic bytes: 1f 8b)
    let csvData: string;
    if (fileData[0] === 0x1f && fileData[1] === 0x8b) {
      csvData = decompressGzip(fileData);
    } else {
      csvData = fileData.toString("utf-8");
    }
    
    return parsePadelMarketFeedData(csvData);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown file error";
    return {
      success: false,
      error: `Failed to read file: ${errorMessage}`,
    };
  }
}

