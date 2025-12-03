#!/usr/bin/env tsx
/**
 * Test script to inspect Padel Market feed data
 */

import "dotenv/config";
import { fetchAndParsePadelMarketFeed, extractBrandModelYear } from "../services/padelMarketFeedSync.js";

async function main() {
  console.log("Testing Padel Market Feed...\n");
  
  const result = await fetchAndParsePadelMarketFeed();
  
  if (!result.success || !result.products) {
    console.error("Failed to fetch feed:", result.error);
    process.exit(1);
  }

  console.log(`\n=== Feed Summary ===`);
  console.log(`Total products: ${result.totalProducts}`);
  console.log(`Rackets in stock: ${result.rackets}`);
  console.log(`\n=== Sample Products with Extracted Data ===\n`);

  // Show first 15 products with extraction details
  result.products.slice(0, 15).forEach((p, i) => {
    const extracted = extractBrandModelYear(p.product_name);
    console.log(`${i + 1}. Product Name: ${p.product_name}`);
    console.log(`   Extracted: Brand="${extracted.brand}", Model="${extracted.model}", Year=${extracted.year || 'N/A'}`);
    console.log(`   Feed Brand: ${p.brand_name || 'N/A'}`);
    console.log(`   Price: ${p.store_price || p.search_price || 'N/A'}`);
    console.log(`   In Stock: ${p.in_stock}`);
    console.log(`   Link: ${p.aw_deep_link.substring(0, 80)}...`);
    console.log('');
  });

  // Show some statistics
  console.log(`\n=== Extraction Statistics ===`);
  const extractions = result.products.map(p => extractBrandModelYear(p.product_name));
  const withYear = extractions.filter(e => e.year).length;
  const withBrand = extractions.filter(e => e.brand).length;
  const withModel = extractions.filter(e => e.model).length;
  
  console.log(`Products with extracted year: ${withYear}/${extractions.length}`);
  console.log(`Products with extracted brand: ${withBrand}/${extractions.length}`);
  console.log(`Products with extracted model: ${withModel}/${extractions.length}`);

  // Show some examples of problematic extractions
  console.log(`\n=== Examples of Extractions ===`);
  const examples = result.products.slice(0, 20).map(p => ({
    original: p.product_name,
    extracted: extractBrandModelYear(p.product_name),
    feedBrand: p.brand_name,
  }));

  examples.forEach((ex, i) => {
    console.log(`\n${i + 1}. "${ex.original}"`);
    console.log(`   → Brand: "${ex.extracted.brand}" (feed: "${ex.feedBrand || 'N/A'}")`);
    console.log(`   → Model: "${ex.extracted.model}"`);
    console.log(`   → Year: ${ex.extracted.year || 'N/A'}`);
  });
}

main().catch(console.error);

