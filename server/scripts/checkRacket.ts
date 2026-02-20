import "dotenv/config";
import { storage } from "../storage.js";

// Find a few rackets that only have padelMarket images (no CJ/Padel Nuestro)
const all = await storage.getAllRackets();
const pmOnly = all.filter(r => !r.affiliateLink && r.padelMarketAffiliateLink && r.imageUrl);
console.log(`Found ${pmOnly.length} Padel Market-only rackets with images`);
pmOnly.slice(0, 5).forEach(r => console.log(` - ${r.brand} ${r.model}: ${r.imageUrl}`));

// Also show a CJ racket for comparison
const cjRacket = all.find(r => r.affiliateLink && r.imageUrl);
if (cjRacket) console.log(`\nCJ example: ${cjRacket.brand} ${cjRacket.model}: ${cjRacket.imageUrl}`);
process.exit(0);
