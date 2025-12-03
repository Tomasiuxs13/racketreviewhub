#!/usr/bin/env tsx
/**
 * Check which rackets have both Padel Nuestro and Padel Market affiliate links
 */

import "dotenv/config";
import { storage } from "../storage.js";

async function main() {
  console.log("Checking rackets with both affiliate links...\n");

  const allRackets = await storage.getAllRackets();

  // Filter rackets that have both links
  const racketsWithBothLinks = allRackets.filter(racket => {
    const hasPadelNuestro = racket.inStock && (racket.affiliateLink || racket.titleUrl);
    const hasPadelMarket = racket.padelMarketInStock && racket.padelMarketAffiliateLink;
    return hasPadelNuestro && hasPadelMarket;
  });

  console.log(`Total rackets: ${allRackets.length}`);
  console.log(`Rackets with both links: ${racketsWithBothLinks.length}\n`);

  if (racketsWithBothLinks.length > 0) {
    console.log("Rackets with both Padel Nuestro and Padel Market links:\n");
    racketsWithBothLinks.forEach((racket, index) => {
      console.log(`${index + 1}. ${racket.brand} ${racket.model} ${racket.year}`);
      console.log(`   Padel Nuestro: ${racket.affiliateLink || racket.titleUrl || 'N/A'}`);
      console.log(`   Padel Market: ${racket.padelMarketAffiliateLink || 'N/A'}`);
      console.log(`   Price: €${Number(racket.currentPrice).toFixed(2)}`);
      console.log(`   Published: ${racket.isPublished ? 'Yes' : 'No'}`);
      console.log(`   URL: /rackets/${racket.brand.toLowerCase()}-${racket.model.toLowerCase().replace(/\s+/g, '-')}-${racket.year}`);
      console.log("");
    });
  } else {
    console.log("No rackets found with both affiliate links.");
  }

  // Also show statistics
  const withPadelNuestro = allRackets.filter(r => r.inStock && (r.affiliateLink || r.titleUrl)).length;
  const withPadelMarket = allRackets.filter(r => r.padelMarketInStock && r.padelMarketAffiliateLink).length;
  const withNeither = allRackets.filter(r => 
    !(r.inStock && (r.affiliateLink || r.titleUrl)) && 
    !(r.padelMarketInStock && r.padelMarketAffiliateLink)
  ).length;

  console.log("\n=== Statistics ===");
  console.log(`Rackets with Padel Nuestro link only: ${withPadelNuestro - racketsWithBothLinks.length}`);
  console.log(`Rackets with Padel Market link only: ${withPadelMarket - racketsWithBothLinks.length}`);
  console.log(`Rackets with both links: ${racketsWithBothLinks.length}`);
  console.log(`Rackets with neither link: ${withNeither}`);
}

main().catch(console.error);

