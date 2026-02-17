#!/usr/bin/env tsx
/**
 * Update Published Rackets - Generate Missing Reviews and Translations
 * 
 * This script finds published rackets that are missing:
 * 1. Review content
 * 2. Translations for their reviews
 * 
 * It processes them in smaller batches to avoid quota issues and provides
 * better error handling and retry logic.
 * 
 * Usage:
 *   npx tsx server/scripts/updatePublishedRackets.ts [options]
 * 
 * Options:
 *   --batch-size <number>    Number of rackets to process per batch (default: 5)
 *   --skip-reviews          Skip review generation
 *   --skip-translations     Skip translation generation
 *   --limit <number>        Limit total number of rackets to process
 *   --start-from <n>        Start from racket number N (1-based)
 * 
 * Environment Variables:
 *   DATABASE_URL          - PostgreSQL connection string
 *   OPENAI_API_KEY        - OpenAI API key for AI generation
 */

import "dotenv/config";
import { storage } from "../storage.js";
import { 
  generateRacketReview, 
  translateReviewLocales, 
  REVIEW_TRANSLATION_LOCALES 
} from "../lib/openai.js";
import { fetchTranslationsForEntity } from "../lib/i18n.js";
import type { Racket } from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { contentTranslations, rackets } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  batchSize: args.includes("--batch-size") ? parseInt(args[args.indexOf("--batch-size") + 1], 10) : 5,
  skipReviews: args.includes("--skip-reviews"),
  skipTranslations: args.includes("--skip-translations"),
  limit: args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1], 10) : undefined,
  startFrom: args.includes("--start-from") ? parseInt(args[args.indexOf("--start-from") + 1], 10) : undefined,
};

// Setup database connection for querying translations
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const isRenderDatabase = databaseUrl.includes("render.com") || databaseUrl.includes("dpg-");
const postgresClient = postgres(databaseUrl, {
  ssl: isRenderDatabase ? { rejectUnauthorized: false } : undefined,
});
const db = drizzle(postgresClient);

/**
 * Check which translations are missing for a racket
 */
async function getMissingTranslations(racketId: string): Promise<string[]> {
  const existingTranslations = await db
    .select()
    .from(contentTranslations)
    .where(
      and(
        eq(contentTranslations.entityType, "racket_review"),
        eq(contentTranslations.entityId, racketId)
      )
    );

  const existingLocales = new Set(existingTranslations.map(t => t.locale));
  const requiredLocales = REVIEW_TRANSLATION_LOCALES;
  
  return requiredLocales.filter(locale => !existingLocales.has(locale));
}

/**
 * Process a single racket - generate review and/or translations
 */
async function processRacket(
  racket: Racket,
  options: { skipReviews: boolean; skipTranslations: boolean }
): Promise<{
  reviewGenerated: boolean;
  translationsGenerated: number;
  errors: string[];
}> {
  const result = {
    reviewGenerated: false,
    translationsGenerated: 0,
    errors: [] as string[],
  };

  let reviewContent = racket.reviewContent;
  let updatedRacket = racket;

  // 1. Generate review if missing
  if (!reviewContent && !options.skipReviews) {
    try {
      console.log(`  📝 Generating review...`);
      const reviewResult = await generateRacketReview(racket, {
        skipTranslations: true, // We'll handle translations separately
      });

      if (reviewResult && reviewResult.reviewContent) {
        reviewContent = reviewResult.reviewContent;
        const updateResult = await storage.updateRacket(racket.id, {
          reviewContent: reviewContent,
        });
        
        if (updateResult) {
          updatedRacket = updateResult;
          result.reviewGenerated = true;
          console.log(`  ✓ Review generated (${reviewContent.length} chars)`);
        } else {
          result.errors.push("Failed to save review to database");
        }
      } else {
        result.errors.push("Failed to generate review");
      }

      // Delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      
      // Check for quota errors first
      if (
        error?.code === "insufficient_quota" || 
        error?.status === 429 ||
        error?.error?.code === "insufficient_quota" ||
        (errorMsg && errorMsg.includes("quota"))
      ) {
        throw new Error("QUOTA_EXCEEDED");
      }
      
      result.errors.push(`Review generation failed: ${errorMsg}`);
    }
  }

  // 2. Generate missing translations if review exists
  if (reviewContent && !options.skipTranslations) {
    try {
      const missingLocales = await getMissingTranslations(racket.id);
      
      if (missingLocales.length > 0) {
        console.log(`  🌐 Generating translations for ${missingLocales.length} missing locale(s): ${missingLocales.join(", ")}`);
        
        // Process translations one locale at a time to avoid quota issues
        for (const locale of missingLocales) {
          try {
            await translateReviewLocales(updatedRacket, [locale], reviewContent);
            result.translationsGenerated++;
            console.log(`  ✓ Translation generated for: ${locale}`);
            
            // Delay between translations
            await new Promise((resolve) => setTimeout(resolve, 1500));
          } catch (error: any) {
            const errorMsg = error?.message || String(error);
            
            // Check for quota errors first
            if (
              error?.code === "insufficient_quota" || 
              error?.status === 429 ||
              error?.error?.code === "insufficient_quota" ||
              (errorMsg && errorMsg.includes("quota"))
            ) {
              throw new Error("QUOTA_EXCEEDED");
            }
            
            result.errors.push(`Translation failed for ${locale}: ${errorMsg}`);
          }
        }
      } else {
        console.log(`  ✓ All translations already exist`);
      }
    } catch (error: any) {
      if (error?.message === "QUOTA_EXCEEDED") {
        throw error;
      }
      
      // Check for quota errors
      const errorMsg = error?.message || String(error);
      if (
        error?.code === "insufficient_quota" || 
        error?.status === 429 ||
        error?.error?.code === "insufficient_quota" ||
        (errorMsg && errorMsg.includes("quota"))
      ) {
        throw new Error("QUOTA_EXCEEDED");
      }
      
      result.errors.push(`Translation generation failed: ${errorMsg}`);
    }
  }

  return result;
}

/**
 * Process rackets in batches
 */
async function processBatch(
  rackets: Racket[],
  batchNumber: number,
  totalBatches: number
): Promise<{
  processed: number;
  reviewsGenerated: number;
  translationsGenerated: number;
  errors: number;
  quotaExceeded: boolean;
}> {
  const stats = {
    processed: 0,
    reviewsGenerated: 0,
    translationsGenerated: 0,
    errors: 0,
    quotaExceeded: false,
  };

  console.log(`\n📦 Processing Batch ${batchNumber}/${totalBatches} (${rackets.length} rackets)`);
  console.log("=".repeat(60));

  for (let i = 0; i < rackets.length; i++) {
    const racket = rackets[i];
    const progress = `[${i + 1}/${rackets.length}]`;
    
    try {
      console.log(`\n${progress} 🔄 Processing ${racket.brand} ${racket.model} ${racket.year}...`);
      
      const result = await processRacket(racket, {
        skipReviews: options.skipReviews,
        skipTranslations: options.skipTranslations,
      });

      stats.processed++;
      if (result.reviewGenerated) {
        stats.reviewsGenerated++;
      }
      stats.translationsGenerated += result.translationsGenerated;
      
      if (result.errors.length > 0) {
        stats.errors++;
        console.warn(`  ⚠️  Errors: ${result.errors.join("; ")}`);
      }

      // Delay between rackets
      if (i < rackets.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error: any) {
      if (error?.message === "QUOTA_EXCEEDED") {
        console.error(`\n${progress} ❌ QUOTA EXCEEDED: OpenAI API quota limit reached`);
        console.error(`   Please check your OpenAI account billing and quota limits.`);
        console.error(`   Script stopped at batch ${batchNumber}, racket ${i + 1}`);
        stats.quotaExceeded = true;
        break;
      } else {
        stats.errors++;
        console.error(`${progress} ❌ Error processing ${racket.brand} ${racket.model}:`, error?.message || error);
      }
    }
  }

  return stats;
}

async function updatePublishedRackets() {
  if (!process.env.OPENAI_API_KEY && (!options.skipReviews || !options.skipTranslations)) {
    console.error("❌ ERROR: OPENAI_API_KEY not set. Cannot generate content.");
    console.error("   Please set OPENAI_API_KEY in your .env file.");
    console.error("   Or use --skip-reviews and --skip-translations to skip AI generation.");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("❌ ERROR: DATABASE_URL not set. Cannot access database.");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("Update Published Rackets - Generate Missing Reviews & Translations");
  console.log("=".repeat(60));
  console.log(`Options:`);
  console.log(`  Batch size: ${options.batchSize}`);
  console.log(`  Skip reviews: ${options.skipReviews}`);
  console.log(`  Skip translations: ${options.skipTranslations}`);
  console.log(`  Limit: ${options.limit || "none"}`);
  console.log(`  Start from: ${options.startFrom || "beginning"}`);
  console.log("");

  // Find published rackets missing reviews or translations
  console.log("🔍 Finding published rackets missing reviews or translations...");
  
  const allPublishedRackets = await storage.getPublishedRackets();
  console.log(`Found ${allPublishedRackets.length} total published rackets`);

  // Filter rackets that need updates
  const racketsNeedingUpdates: Array<{ racket: Racket; needsReview: boolean; needsTranslations: boolean }> = [];

  for (const racket of allPublishedRackets) {
    const needsReview = !options.skipReviews && !racket.reviewContent;
    const needsTranslations = !options.skipTranslations && racket.reviewContent;
    
    if (needsReview || needsTranslations) {
      let missingTranslations: string[] = [];
      if (needsTranslations) {
        missingTranslations = await getMissingTranslations(racket.id);
      }
      
      if (needsReview || missingTranslations.length > 0) {
        racketsNeedingUpdates.push({
          racket,
          needsReview,
          needsTranslations: missingTranslations.length > 0,
        });
      }
    }
  }

  const missingReviews = racketsNeedingUpdates.filter(r => r.needsReview).length;
  const missingTranslations = racketsNeedingUpdates.filter(r => r.needsTranslations).length;
  
  console.log(`\n📊 Found ${racketsNeedingUpdates.length} rackets needing updates:`);
  console.log(`   - Missing reviews: ${missingReviews}`);
  console.log(`   - Missing translations: ${missingTranslations}`);
  
  if (missingReviews > 0) {
    console.log(`\n   Rackets missing reviews:`);
    racketsNeedingUpdates
      .filter(r => r.needsReview)
      .slice(0, 10)
      .forEach(r => console.log(`     • ${r.racket.brand} ${r.racket.model} ${r.racket.year}`));
    if (missingReviews > 10) {
      console.log(`     ... and ${missingReviews - 10} more`);
    }
  }

  if (racketsNeedingUpdates.length === 0) {
    console.log("\n✅ All published rackets have reviews and translations!");
    return;
  }

  // Apply limit and start-from filters
  let racketsToProcess = racketsNeedingUpdates.map(r => r.racket);
  if (options.startFrom) {
    const startIndex = options.startFrom - 1;
    racketsToProcess = racketsToProcess.slice(startIndex);
    console.log(`\nStarting from racket ${options.startFrom}`);
  }
  
  if (options.limit) {
    racketsToProcess = racketsToProcess.slice(0, options.limit);
    console.log(`Limited to ${racketsToProcess.length} rackets`);
  }

  // Split into batches
  const batches: Racket[][] = [];
  for (let i = 0; i < racketsToProcess.length; i += options.batchSize) {
    batches.push(racketsToProcess.slice(i, i + options.batchSize));
  }

  console.log(`\n📦 Processing ${racketsToProcess.length} rackets in ${batches.length} batches of ${options.batchSize}`);

  // Process batches
  const totalStats = {
    processed: 0,
    reviewsGenerated: 0,
    translationsGenerated: 0,
    errors: 0,
  };

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchStats = await processBatch(batch, i + 1, batches.length);

    totalStats.processed += batchStats.processed;
    totalStats.reviewsGenerated += batchStats.reviewsGenerated;
    totalStats.translationsGenerated += batchStats.translationsGenerated;
    totalStats.errors += batchStats.errors;

    if (batchStats.quotaExceeded) {
      const nextStartIndex = (i + 1) * options.batchSize + (options.startFrom ? options.startFrom - 1 : 0);
      console.error("\n⚠️  Stopping due to quota limit. Please wait and try again later.");
      console.error(`\n   To resume from where you left off, run:`);
      console.error(`   npx tsx server/scripts/updatePublishedRackets.ts --start-from ${nextStartIndex + 1} --batch-size ${options.batchSize}`);
      break;
    }

    // Longer delay between batches
    if (i < batches.length - 1) {
      console.log(`\n⏸️  Waiting 5 seconds before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("Summary:");
  console.log(`  ✓ Processed: ${totalStats.processed}`);
  console.log(`  📝 Reviews generated: ${totalStats.reviewsGenerated}`);
  console.log(`  🌐 Translations generated: ${totalStats.translationsGenerated}`);
  console.log(`  ❌ Errors: ${totalStats.errors}`);
  console.log(`  Total rackets: ${racketsToProcess.length}`);
  console.log("=".repeat(60));

  // Close database connection
  await postgresClient.end();
}

updatePublishedRackets().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

