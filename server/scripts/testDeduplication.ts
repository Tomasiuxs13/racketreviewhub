#!/usr/bin/env tsx
/**
 * Test script to verify deduplication works correctly
 */

import "dotenv/config";
import { fetchAndParsePadelMarketFeed } from "../services/padelMarketFeedSync.js";
import { processPadelMarketFeed } from "../services/padelMarketFeedProcessor.js";

async function main() {
  console.log("Testing deduplication with actual processing...\n");
  
  const result = await fetchAndParsePadelMarketFeed();
  
  if (!result.success || !result.products) {
    console.error("Failed to fetch feed:", result.error);
    process.exit(1);
  }

  console.log(`Original products: ${result.products.length}`);
  console.log(`Processing with deduplication...\n`);
  
  const processResult = await processPadelMarketFeed(result.products);
  
  console.log('\n=== Processing Results ===');
  console.log(`Total processed: ${processResult.totalProcessed}`);
  console.log(`Matched: ${processResult.matched}`);
  console.log(`Updated: ${processResult.updated}`);
  console.log(`Unchanged: ${processResult.unchanged}`);
  console.log(`Skipped: ${processResult.skipped}`);
  console.log(`Marked out of stock: ${processResult.markedOutOfStock}`);
  console.log(`Errors: ${processResult.errors.length}`);
  
  if (processResult.errors.length > 0 && processResult.errors.length <= 10) {
    console.log('\n=== Errors ===');
    processResult.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
  }
  
  const duplicatesRemoved = result.products.length - processResult.totalProcessed;
  if (duplicatesRemoved > 0) {
    console.log(`\n✓ Successfully removed ${duplicatesRemoved} duplicate product(s)`);
  }
}

main().catch(console.error);

