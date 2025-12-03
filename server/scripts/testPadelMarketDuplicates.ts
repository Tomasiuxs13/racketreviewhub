#!/usr/bin/env tsx
/**
 * Test script to find duplicate products in Padel Market feed
 * (same brand, model, year combination)
 */

import "dotenv/config";
import { fetchAndParsePadelMarketFeed, extractBrandModelYear } from "../services/padelMarketFeedSync.js";

interface ProductKey {
  brand: string;
  model: string;
  year: number | undefined;
}

function getProductKey(product: { product_name: string; brand_name?: string }): ProductKey {
  const extracted = extractBrandModelYear(product.product_name, product.brand_name);
  return {
    brand: extracted.brand.toUpperCase().trim(),
    model: extracted.model.toUpperCase().trim(),
    year: extracted.year,
  };
}

function keyToString(key: ProductKey): string {
  return `${key.brand} | ${key.model} | ${key.year ?? 'N/A'}`;
}

async function main() {
  console.log("Testing for duplicates in Padel Market Feed...\n");
  
  const result = await fetchAndParsePadelMarketFeed();
  
  if (!result.success || !result.products) {
    console.error("Failed to fetch feed:", result.error);
    process.exit(1);
  }

  console.log(`Total racket products: ${result.products.length}\n`);

  // Group products by brand, model, year
  const productMap = new Map<string, typeof result.products>();
  
  for (const product of result.products) {
    const key = getProductKey(product);
    const keyStr = keyToString(key);
    
    if (!productMap.has(keyStr)) {
      productMap.set(keyStr, []);
    }
    productMap.get(keyStr)!.push(product);
  }

  // Find duplicates
  const duplicates: Array<{ key: ProductKey; products: typeof result.products }> = [];
  
  for (const [keyStr, products] of productMap.entries()) {
    if (products.length > 1) {
      const key = getProductKey(products[0]);
      duplicates.push({ key, products });
    }
  }

  console.log(`=== Duplicate Analysis ===\n`);
  console.log(`Unique product keys: ${productMap.size}`);
  console.log(`Products with duplicates: ${duplicates.length}\n`);

  if (duplicates.length > 0) {
    console.log(`=== Found ${duplicates.length} duplicate groups ===\n`);
    
    duplicates.forEach((dup, index) => {
      console.log(`${index + 1}. ${keyToString(dup.key)}`);
      console.log(`   Count: ${dup.products.length} products\n`);
      
      dup.products.forEach((p, i) => {
        console.log(`   ${i + 1}. "${p.product_name}"`);
        console.log(`      Price: ${p.store_price || p.search_price || 'N/A'}`);
        console.log(`      Link: ${p.aw_deep_link.substring(0, 80)}...`);
        console.log(`      Product ID: ${p.aw_product_id || p.merchant_product_id || 'N/A'}`);
        console.log('');
      });
      console.log('');
    });

    // Summary statistics
    const totalDuplicateProducts = duplicates.reduce((sum, dup) => sum + dup.products.length, 0);
    const uniqueDuplicates = duplicates.length;
    console.log(`\n=== Summary ===`);
    console.log(`Total duplicate groups: ${uniqueDuplicates}`);
    console.log(`Total products in duplicate groups: ${totalDuplicateProducts}`);
    console.log(`Products that would need deduplication: ${totalDuplicateProducts - uniqueDuplicates}`);
  } else {
    console.log("✓ No duplicates found! All products have unique brand+model+year combinations.\n");
  }

  // Also check for products with same brand+model but different years
  console.log(`\n=== Products with Same Brand+Model but Different Years ===\n`);
  const brandModelMap = new Map<string, Array<{ year: number | undefined; product: typeof result.products[0] }>>();
  
  for (const product of result.products) {
    const key = getProductKey(product);
    const brandModelKey = `${key.brand} | ${key.model}`;
    
    if (!brandModelMap.has(brandModelKey)) {
      brandModelMap.set(brandModelKey, []);
    }
    brandModelMap.get(brandModelKey)!.push({ year: key.year, product });
  }

  const sameBrandModel = Array.from(brandModelMap.entries())
    .filter(([_, products]) => {
      const years = products.map(p => p.year).filter((y, i, arr) => arr.indexOf(y) === i);
      return years.length > 1;
    })
    .slice(0, 10); // Show first 10 examples

  if (sameBrandModel.length > 0) {
    console.log(`Found ${sameBrandModel.length} brand+model combinations with multiple years:\n`);
    sameBrandModel.forEach(([key, products], index) => {
      const years = products.map(p => p.year).filter((y, i, arr) => arr.indexOf(y) === i);
      console.log(`${index + 1}. ${key}`);
      console.log(`   Years: ${years.map(y => y ?? 'N/A').join(', ')}`);
      console.log(`   Products: ${products.length}\n`);
    });
  } else {
    console.log("No products with same brand+model but different years found.\n");
  }
}

main().catch(console.error);

