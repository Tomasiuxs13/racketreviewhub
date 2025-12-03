#!/usr/bin/env tsx
/**
 * Bulk Publish Rackets Script
 * 
 * This script finds rackets that are in stock but unpublished, generates reviews
 * and translations if needed, and publishes them.
 * 
 * Usage:
 *   npx tsx server/scripts/bulkPublishRackets.ts [options]
 * 
 * Options:
 *   --skip-reviews     Skip review generation (only publish existing rackets)
 *   --skip-translations Skip translation generation
 *   --limit <number>   Limit number of rackets to process (default: all)
 *   --start-from <n>   Start from racket number N (1-based)
 * 
 * Environment Variables:
 *   DATABASE_URL          - PostgreSQL connection string
 *   OPENAI_API_KEY        - OpenAI API key for reviews/translations
 */

import "dotenv/config";
import { storage } from "../storage.js";
import { generateRacketReview, translateReviewLocales, REVIEW_TRANSLATION_LOCALES } from "../lib/openai.js";
import type { Racket } from "@shared/schema";

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  skipReviews: args.includes("--skip-reviews"),
  skipTranslations: args.includes("--skip-translations"),
  limit: args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1], 10) : undefined,
  startFrom: args.includes("--start-from") ? parseInt(args[args.indexOf("--start-from") + 1], 10) : undefined,
};

async function bulkPublishRackets() {
  if (!process.env.OPENAI_API_KEY && (!options.skipReviews || !options.skipTranslations)) {
    console.error("❌ ERROR: OPENAI_API_KEY not set. Cannot generate reviews/translations.");
    console.error("   Please set OPENAI_API_KEY in your .env file.");
    console.error("   Or use --skip-reviews and --skip-translations to skip AI generation.");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("❌ ERROR: DATABASE_URL not set. Cannot access database.");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("Bulk Publish Rackets");
  console.log("=".repeat(60));
  console.log(`Options: ${JSON.stringify(options)}`);
  console.log("");

  console.log("Fetching in-stock unpublished rackets...");
  const allRackets = await storage.getAllRackets();
  
  // Filter for in-stock but unpublished rackets
  const unpublishedRackets = allRackets.filter(
    (r) => r.inStock === true && r.isPublished === false
  );

  console.log(`Found ${unpublishedRackets.length} in-stock unpublished rackets\n`);

  if (unpublishedRackets.length === 0) {
    console.log("No rackets to publish. All in-stock rackets are already published.");
    return;
  }

  // Apply limit if specified
  let racketsToProcess = unpublishedRackets;
  if (options.limit) {
    racketsToProcess = racketsToProcess.slice(0, options.limit);
    console.log(`Processing limited to ${racketsToProcess.length} rackets\n`);
  }

  // Apply start-from if specified
  if (options.startFrom) {
    const startIndex = options.startFrom - 1; // Convert to 0-based
    racketsToProcess = racketsToProcess.slice(startIndex);
    console.log(`Starting from racket ${options.startFrom}\n`);
  }

  let publishedCount = 0;
  let reviewGeneratedCount = 0;
  let translationGeneratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < racketsToProcess.length; i++) {
    const racket = racketsToProcess[i];
    const progress = `[${i + 1}/${racketsToProcess.length}]`;

    try {
      console.log(`${progress} 🔄 Processing ${racket.brand} ${racket.model}...`);

      let needsReview = !racket.reviewContent;
      let reviewContent = racket.reviewContent;

      // Generate review if missing and not skipped
      if (needsReview && !options.skipReviews) {
        console.log(`  📝 Generating review...`);
        const reviewResult = await generateRacketReview(racket, {
          skipTranslations: options.skipTranslations, // Skip translations during review gen if flag is set
        });

        if (reviewResult && reviewResult.reviewContent) {
          reviewContent = reviewResult.reviewContent;
          reviewGeneratedCount++;
          console.log(`  ✓ Review generated (${reviewContent.length} chars)`);
        } else {
          console.warn(`  ⚠️  Failed to generate review, continuing without it`);
        }

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Generate translations if not skipped
      if (!options.skipTranslations && reviewContent) {
        console.log(`  🌐 Generating translations...`);
        try {
          const locales = REVIEW_TRANSLATION_LOCALES;
          if (locales.length > 0) {
            await translateReviewLocales(racket, locales, reviewContent);
            translationGeneratedCount++;
            console.log(`  ✓ Translations generated for: ${locales.join(", ")}`);
          }
        } catch (translationError) {
          console.warn(`  ⚠️  Translation generation failed:`, translationError);
          // Continue anyway
        }

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Update racket with review (if generated) and publish
      const updateData: Partial<Racket> = {
        isPublished: true,
      };

      if (reviewContent && reviewContent !== racket.reviewContent) {
        updateData.reviewContent = reviewContent;
      }

      const updatedRacket = await storage.updateRacket(racket.id, updateData);

      if (!updatedRacket) {
        console.error(`${progress} ❌ Failed to update racket ${racket.brand} ${racket.model}`);
        errorCount++;
        continue;
      }

      publishedCount++;
      console.log(`${progress} ✓ Published ${racket.brand} ${racket.model}`);

      // Add delay between rackets to avoid overwhelming the API
      if (i < racketsToProcess.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error: any) {
      // Check if it's an API key error
      if (error?.code === "invalid_api_key" || error?.status === 401) {
        console.error(`\n${progress} ❌ API KEY ERROR: Invalid or expired OpenAI API key`);
        console.error(`   Please check your OPENAI_API_KEY in .env file`);
        console.error(`   Error: ${error?.message || error?.error?.message || "Invalid API key"}`);
        console.error(`\n   Script stopped at racket ${i + 1}. To resume, run:`);
        console.error(`   npx tsx server/scripts/bulkPublishRackets.ts --start-from ${i + 1}\n`);
        errorCount++;
        break; // Stop on API key errors
      } else {
        console.error(`${progress} ❌ Error processing ${racket.brand} ${racket.model}:`, error?.message || error);
        errorCount++;
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Summary:");
  console.log(`  ✓ Published: ${publishedCount}`);
  console.log(`  📝 Reviews generated: ${reviewGeneratedCount}`);
  console.log(`  🌐 Translations generated: ${translationGeneratedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  Total processed: ${racketsToProcess.length}`);
  console.log("=".repeat(60));
}

bulkPublishRackets().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

