import { storage } from "../storage.js";

async function main() {
  console.log("Fetching Top 30 Best Rackets...");
  // category 'overall' with limit 30
  const top30 = await storage.getBestOfRackets('overall', 30);
  
  console.log(`Found ${top30.length} rackets after applying filters.\n`);
  
  let validLinks = 0;
  
  top30.forEach((racket, index) => {
    const hasLink = racket.affiliateLink || racket.padelMarketAffiliateLink;
    if (hasLink) validLinks++;
    
    console.log(`${index + 1}. ${racket.brand} ${racket.model} (${racket.year})`);
    console.log(`   Rating: ${racket.overallRating}`);
    console.log(`   Price: €${racket.currentPrice}`);
    console.log(`   CJ Link: ${racket.affiliateLink ? 'Yes' : 'No'}, PM Link: ${racket.padelMarketAffiliateLink ? 'Yes' : 'No'}`);
    console.log(`   CJ In Stock: ${racket.inStock ? 'Yes' : 'No'}, PM In Stock: ${racket.padelMarketInStock ? 'Yes' : 'No'}`);
    console.log('---');
  });
  
  console.log(`Summary: ${validLinks} out of ${top30.length} items have affiliate links.`);
  process.exit(0);
}

main().catch(console.error);
