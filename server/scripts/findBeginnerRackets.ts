import "dotenv/config";
import { storage } from "../storage.js";

function getRacketSlug(brand: string, model: string): string {
  const base = `${brand} ${model}`.toLowerCase();
  return base
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function findBeginnerRackets() {
  const allRackets = await storage.getAllRackets();
  
  // Find round rackets with high control (beginner-friendly)
  const beginnerRackets = allRackets
    .filter(r => {
      const shape = r.shape?.toLowerCase();
      return shape === "round" && 
             r.controlRating >= 70 && 
             r.maneuverabilityRating >= 75 &&
             r.sweetSpotRating >= 75;
    })
    .sort((a, b) => {
      // Sort by control rating first, then by overall rating
      if (b.controlRating !== a.controlRating) {
        return b.controlRating - a.controlRating;
      }
      return b.overallRating - a.overallRating;
    })
    .slice(0, 10);
  
  console.log(`\nFound ${beginnerRackets.length} beginner-friendly rackets:\n`);
  
  beginnerRackets.forEach((r, index) => {
    const slug = getRacketSlug(r.brand, r.model);
    console.log(`${index + 1}. ${r.brand} ${r.model}`);
    console.log(`   Slug: /rackets/${slug}`);
    console.log(`   Shape: ${r.shape}, Control: ${r.controlRating}, Maneuverability: ${r.maneuverabilityRating}, Sweet Spot: ${r.sweetSpotRating}`);
    console.log(`   Price: €${r.currentPrice}`);
    console.log();
  });
  
  // Return top 4 for the guide
  return beginnerRackets.slice(0, 4);
}

findBeginnerRackets().catch(console.error);

