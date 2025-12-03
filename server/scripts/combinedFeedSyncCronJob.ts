#!/usr/bin/env tsx
/**
 * Combined Feed Sync Cron Job
 * 
 * This script runs both CJ Feed Sync (Padel Nuestro) and Padel Market Feed Sync
 * sequentially in a single cron job execution.
 * 
 * Usage:
 *   npx tsx server/scripts/combinedFeedSyncCronJob.ts [options]
 * 
 * Options:
 *   --quick        Only update prices for CJ feed (faster, no AI generation)
 *   --local        Use local files instead of downloading
 *   --dry-run      Parse feeds but don't update database
 * 
 * Environment Variables:
 *   DATABASE_URL              - PostgreSQL connection string
 *   CJ_SFTP_HOST              - SFTP host (default: datatransfer.cj.com)
 *   CJ_SFTP_USERNAME          - SFTP username
 *   CJ_SFTP_PASSWORD          - SFTP password
 *   PADEL_MARKET_FEED_URL     - (optional, has default URL)
 *   OPENAI_API_KEY            - (optional, only needed for full CJ sync)
 */

import "dotenv/config";
import { fetchAndParseCjFeed, parseFeedFromFile } from "../services/cjFeedSync.js";
import { processCjFeed, quickPriceUpdate } from "../services/cjFeedProcessor.js";
import { fetchAndParsePadelMarketFeed, parsePadelMarketFeedFromFile } from "../services/padelMarketFeedSync.js";
import { processPadelMarketFeed } from "../services/padelMarketFeedProcessor.js";

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  quick: args.includes("--quick"),
  local: args.includes("--local"),
  dryRun: args.includes("--dry-run"),
};

interface SyncResult {
  name: string;
  success: boolean;
  duration: number;
  details?: any;
}

async function runCjSync(): Promise<SyncResult> {
  const startTime = new Date();
  console.log("=".repeat(60));
  console.log("CJ Feed Sync (Padel Nuestro) - Starting");
  console.log("=".repeat(60));
  console.log(`Options: ${JSON.stringify({ quick: options.quick, local: options.local, dryRun: options.dryRun })}`);
  console.log("");

  try {
    // Fetch and parse the CJ feed
    let feedResult;
    
    if (options.local) {
      const filePath = "data/PadelNuestro_EU-Padel_Nuestro_Product_Feed_INTERNATIONAL_-shopping.txt";
      console.log(`[CJ] Reading local file: ${filePath}`);
      feedResult = parseFeedFromFile(filePath);
    } else {
      console.log("[CJ] Fetching feed from CJ SFTP...");
      feedResult = await fetchAndParseCjFeed();
    }

    if (!feedResult.success) {
      throw new Error(`Failed to fetch/parse CJ feed: ${feedResult.error}`);
    }

    if (!feedResult.products || feedResult.products.length === 0) {
      console.log("[CJ] No padel racket products found in feed");
      const duration = (new Date().getTime() - startTime.getTime()) / 1000;
      return {
        name: "CJ Feed Sync",
        success: true,
        duration,
        details: { message: "No products found" }
      };
    }

    console.log(`[CJ] Feed Summary:`);
    console.log(`  - Total products: ${feedResult.totalProducts}`);
    console.log(`  - Padel rackets: ${feedResult.padelRackets}`);
    console.log("");

    if (options.dryRun) {
      console.log("[CJ] DRY RUN - Skipping database updates");
      const duration = (new Date().getTime() - startTime.getTime()) / 1000;
      return {
        name: "CJ Feed Sync",
        success: true,
        duration,
        details: { dryRun: true, products: feedResult.padelRackets }
      };
    }

    // Process the products
    let result;
    if (options.quick) {
      console.log("[CJ] Running quick price update...");
      result = await quickPriceUpdate(feedResult.products);
    } else {
      console.log("[CJ] Processing feed products...");
      result = await processCjFeed(feedResult.products);
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    console.log("");
    console.log("[CJ] Completed in " + duration.toFixed(2) + " seconds");
    console.log(`[CJ] Results: Matched ${result.matched}, Updated ${result.updated}, Created ${result.created || 0}, Unchanged ${result.unchanged}, Skipped ${result.skipped}`);

    return {
      name: "CJ Feed Sync",
      success: result.success,
      duration,
      details: result
    };
  } catch (error) {
    const duration = (new Date().getTime() - startTime.getTime()) / 1000;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[CJ] Error:", errorMessage);
    return {
      name: "CJ Feed Sync",
      success: false,
      duration,
      details: { error: errorMessage }
    };
  }
}

async function runPadelMarketSync(): Promise<SyncResult> {
  const startTime = new Date();
  console.log("");
  console.log("=".repeat(60));
  console.log("Padel Market Feed Sync - Starting");
  console.log("=".repeat(60));
  console.log(`Options: ${JSON.stringify({ local: options.local, dryRun: options.dryRun })}`);
  console.log("");

  try {
    // Fetch and parse the Padel Market feed
    let feedResult;
    
    if (options.local) {
      const filePath = "data/padel-market-feed.csv.gz";
      console.log(`[PadelMarket] Reading local file: ${filePath}`);
      feedResult = parsePadelMarketFeedFromFile(filePath);
    } else {
      console.log("[PadelMarket] Fetching feed from Awin URL...");
      feedResult = await fetchAndParsePadelMarketFeed();
    }

    if (!feedResult.success) {
      throw new Error(`Failed to fetch/parse Padel Market feed: ${feedResult.error}`);
    }

    if (!feedResult.products || feedResult.products.length === 0) {
      console.log("[PadelMarket] No racket products found in feed");
      const duration = (new Date().getTime() - startTime.getTime()) / 1000;
      return {
        name: "Padel Market Feed Sync",
        success: true,
        duration,
        details: { message: "No products found" }
      };
    }

    console.log(`[PadelMarket] Feed Summary:`);
    console.log(`  - Total products: ${feedResult.totalProducts}`);
    console.log(`  - Rackets in stock: ${feedResult.rackets}`);
    console.log("");

    if (options.dryRun) {
      console.log("[PadelMarket] DRY RUN - Skipping database updates");
      const duration = (new Date().getTime() - startTime.getTime()) / 1000;
      return {
        name: "Padel Market Feed Sync",
        success: true,
        duration,
        details: { dryRun: true, products: feedResult.rackets }
      };
    }

    // Process the products
    console.log("[PadelMarket] Processing feed products...");
    const result = await processPadelMarketFeed(feedResult.products);

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    console.log("");
    console.log("[PadelMarket] Completed in " + duration.toFixed(2) + " seconds");
    console.log(`[PadelMarket] Results: Created ${result.created}, Matched ${result.matched}, Updated ${result.updated}, Unchanged ${result.unchanged}, Skipped ${result.skipped}, Out of stock ${result.markedOutOfStock}`);

    return {
      name: "Padel Market Feed Sync",
      success: result.success,
      duration,
      details: result
    };
  } catch (error) {
    const duration = (new Date().getTime() - startTime.getTime()) / 1000;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[PadelMarket] Error:", errorMessage);
    return {
      name: "Padel Market Feed Sync",
      success: false,
      duration,
      details: { error: errorMessage }
    };
  }
}

async function main() {
  const overallStartTime = new Date();
  console.log("=".repeat(60));
  console.log(`Combined Feed Sync Job Started: ${overallStartTime.toISOString()}`);
  console.log("=".repeat(60));
  console.log("This job will run:");
  console.log("  1. CJ Feed Sync (Padel Nuestro)");
  console.log("  2. Padel Market Feed Sync");
  console.log("");

  const results: SyncResult[] = [];

  // Run CJ Feed Sync first
  const cjResult = await runCjSync();
  results.push(cjResult);

  // Run Padel Market Feed Sync second
  const pmResult = await runPadelMarketSync();
  results.push(pmResult);

  // Summary
  const overallEndTime = new Date();
  const overallDuration = (overallEndTime.getTime() - overallStartTime.getTime()) / 1000;

  console.log("");
  console.log("=".repeat(60));
  console.log("Combined Feed Sync Job Completed");
  console.log("=".repeat(60));
  console.log(`Total Duration: ${overallDuration.toFixed(2)} seconds`);
  console.log("");
  console.log("Summary:");
  results.forEach((result, index) => {
    const status = result.success ? "✓" : "✗";
    console.log(`  ${index + 1}. ${status} ${result.name}: ${result.duration.toFixed(2)}s`);
    if (!result.success && result.details?.error) {
      console.log(`     Error: ${result.details.error}`);
    }
  });

  // Exit with appropriate code
  const allSuccessful = results.every(r => r.success);
  if (allSuccessful) {
    console.log("");
    console.log("[Combined] All syncs completed successfully");
    process.exit(0);
  } else {
    console.log("");
    console.log("[Combined] Some syncs completed with errors");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[Combined] Fatal error:", error);
  process.exit(1);
});

