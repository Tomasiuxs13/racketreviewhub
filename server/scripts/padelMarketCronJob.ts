#!/usr/bin/env tsx
/**
 * Padel Market Feed Sync Cron Job
 * 
 * This script is designed to be run as a scheduled job (daily at 4pm GMT).
 * It downloads the Padel Market affiliate product feed from Awin and syncs racket data.
 * 
 * Usage:
 *   npx tsx server/scripts/padelMarketCronJob.ts [options]
 * 
 * Options:
 *   --local        Use local file instead of downloading from URL
 *   --file <path>  Path to local file (gzipped or plain CSV)
 *   --dry-run      Parse feed but don't update database
 * 
 * Environment Variables:
 *   DATABASE_URL              - PostgreSQL connection string
 *   PADEL_MARKET_FEED_URL      - Awin feed URL (optional, has default)
 * 
 * Schedule:
 *   Should run daily at 4pm GMT
 */

import "dotenv/config";
import { fetchAndParsePadelMarketFeed, parsePadelMarketFeedFromFile, extractBrandModelYear } from "../services/padelMarketFeedSync.js";
import { processPadelMarketFeed } from "../services/padelMarketFeedProcessor.js";

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  local: args.includes("--local"),
  dryRun: args.includes("--dry-run"),
  noAi: args.includes("--no-ai"), // import/update without AI generation (spend controlled elsewhere)
  file: args.includes("--file") ? args[args.indexOf("--file") + 1] : undefined,
};

async function main() {
  const startTime = new Date();
  console.log("=".repeat(60));
  console.log(`Padel Market Feed Sync Job Started: ${startTime.toISOString()}`);
  console.log("=".repeat(60));
  console.log(`Options: ${JSON.stringify(options)}`);
  console.log("");

  try {
    // Fetch and parse the feed
    let feedResult;
    
    if (options.local || options.file) {
      const filePath = options.file || "data/padel-market-feed.csv.gz";
      console.log(`[Cron] Reading local file: ${filePath}`);
      feedResult = parsePadelMarketFeedFromFile(filePath);
    } else {
      console.log("[Cron] Fetching feed from Awin URL...");
      feedResult = await fetchAndParsePadelMarketFeed();
    }

    if (!feedResult.success) {
      console.error("[Cron] Failed to fetch/parse feed:", feedResult.error);
      process.exit(1);
    }

    if (!feedResult.products || feedResult.products.length === 0) {
      console.log("[Cron] No racket products found in feed");
      process.exit(0);
    }

    console.log(`[Cron] Feed Summary:`);
    console.log(`  - Total products: ${feedResult.totalProducts}`);
    console.log(`  - Rackets in stock: ${feedResult.rackets}`);
    console.log("");

    if (options.dryRun) {
      console.log("[Cron] DRY RUN - Skipping database updates");
      console.log("[Cron] Sample products:");
      feedResult.products.slice(0, 5).forEach((p, i) => {
        const extracted = extractBrandModelYear(p.product_name);
        console.log(`  ${i + 1}. ${extracted.brand} ${extracted.model} ${extracted.year || ''} - ${p.product_name}`);
        console.log(`     Price: ${p.store_price || p.search_price || 'N/A'}`);
        console.log(`     Link: ${p.aw_deep_link.substring(0, 80)}...`);
      });
      process.exit(0);
    }

    // Process the products
    console.log("[Cron] Processing feed products...");
    const result = await processPadelMarketFeed(feedResult.products, options.noAi ? { generateRatings: false, generateReviews: false } : {});

    // Log results
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    console.log("");
    console.log("=".repeat(60));
    console.log("Padel Market Feed Sync Job Completed");
    console.log("=".repeat(60));
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log(`Results:`);
    console.log(`  - Total Processed: ${result.totalProcessed}`);
    console.log(`  - Matched: ${result.matched}`);
    console.log(`  - Updated: ${result.updated}`);
    console.log(`  - Unchanged: ${result.unchanged}`);
    console.log(`  - Skipped: ${result.skipped}`);
    console.log(`  - Marked Out of Stock: ${result.markedOutOfStock}`);
    console.log(`  - Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log("");
      console.log("Errors (first 10):");
      result.errors.slice(0, 10).forEach((e, i) => {
        console.log(`  ${i + 1}. ${e}`);
      });
    }

    // Exit with appropriate code
    if (result.success) {
      console.log("");
      console.log("[Cron] Job completed successfully");
      process.exit(0);
    } else {
      console.log("");
      console.log("[Cron] Job completed with errors");
      process.exit(1);
    }
  } catch (error) {
    console.error("[Cron] Fatal error:", error);
    process.exit(1);
  }
}

main();

