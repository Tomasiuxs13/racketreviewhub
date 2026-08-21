#!/usr/bin/env tsx
/**
 * CJ Feed Sync Cron Job
 * 
 * This script is designed to be run as a scheduled job by Render.com.
 * It downloads the CJ affiliate product feed and syncs racket data.
 * 
 * Usage:
 *   npx tsx server/scripts/cjCronJob.ts [options]
 * 
 * Options:
 *   --quick        Only update prices (faster, no AI generation)
 *   --local        Use local file instead of SFTP
 *   --file <path>  Path to local file (default: data/PadelNuestro_*.txt)
 *   --dry-run      Parse feed but don't update database
 * 
 * Environment Variables:
 *   DATABASE_URL          - PostgreSQL connection string
 *   CJ_SFTP_HOST          - SFTP host (default: datatransfer.cj.com)
 *   CJ_SFTP_USERNAME      - SFTP username
 *   CJ_SFTP_PASSWORD      - SFTP password
 *   CJ_FEED_FILENAME      - Feed filename on SFTP server
 *   OPENAI_API_KEY        - OpenAI API key for ratings/reviews
 */

import "dotenv/config";
import { fetchAndParseCjFeed, parseFeedFromFile } from "../services/cjFeedSync.js";
import { processCjFeed, quickPriceUpdate } from "../services/cjFeedProcessor.js";

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  quick: args.includes("--quick"),
  local: args.includes("--local"),
  dryRun: args.includes("--dry-run"),
  noAi: args.includes("--no-ai"), // import/update products without AI generation (spend controlled elsewhere)
  file: args.includes("--file") ? args[args.indexOf("--file") + 1] : undefined,
};

async function main() {
  const startTime = new Date();
  console.log("=".repeat(60));
  console.log(`CJ Feed Sync Job Started: ${startTime.toISOString()}`);
  console.log("=".repeat(60));
  console.log(`Options: ${JSON.stringify(options)}`);
  console.log("");

  try {
    // Fetch and parse the feed
    let feedResult;
    
    if (options.local || options.file) {
      const filePath = options.file || "data/PadelNuestro_EU-Padel_Nuestro_Product_Feed_INTERNATIONAL_-shopping.txt";
      console.log(`[Cron] Reading local file: ${filePath}`);
      feedResult = parseFeedFromFile(filePath);
    } else {
      console.log("[Cron] Fetching feed from CJ SFTP...");
      feedResult = await fetchAndParseCjFeed();
    }

    if (!feedResult.success) {
      console.error("[Cron] Failed to fetch/parse feed:", feedResult.error);
      process.exit(1);
    }

    if (!feedResult.products || feedResult.products.length === 0) {
      console.log("[Cron] No padel racket products found in feed");
      process.exit(0);
    }

    console.log(`[Cron] Feed Summary:`);
    console.log(`  - Total products: ${feedResult.totalProducts}`);
    console.log(`  - Padel rackets: ${feedResult.padelRackets}`);
    console.log("");

    if (options.dryRun) {
      console.log("[Cron] DRY RUN - Skipping database updates");
      console.log("[Cron] Sample products:");
      feedResult.products.slice(0, 3).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.BRAND} - ${p.TITLE}`);
        console.log(`     Price: ${p.SALE_PRICE || p.PRICE}`);
        console.log(`     Link: ${p.LINK.substring(0, 80)}...`);
      });
      process.exit(0);
    }

    // Process the products
    let result;
    if (options.quick) {
      console.log("[Cron] Running quick price update (no AI generation)...");
      result = await quickPriceUpdate(feedResult.products);
    } else {
      console.log(options.noAi
        ? "[Cron] Running full sync WITHOUT AI generation (--no-ai)..."
        : "[Cron] Running full sync with AI generation...");
      result = await processCjFeed(feedResult.products, {
        generateRatings: !options.noAi,
        generateReviews: !options.noAi,
        batchSize: 5,
        delayBetweenBatches: 2000, // Slower for cron job to avoid rate limits
      });
    }

    // Log results
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    console.log("");
    console.log("=".repeat(60));
    console.log("CJ Feed Sync Job Completed");
    console.log("=".repeat(60));
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log(`Results:`);
    console.log(`  - Total Processed: ${result.totalProcessed}`);
    console.log(`  - Created: ${result.created}`);
    console.log(`  - Updated: ${result.updated}`);
    console.log(`  - Unchanged: ${result.unchanged}`);
    console.log(`  - Skipped: ${result.skipped}`);
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

