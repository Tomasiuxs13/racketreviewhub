import "dotenv/config";
import { storage } from "../storage.js";

const targets = [
  { brand: "Enebe", model: "Response Alu 2025" },
  { brand: "Vibor-A", model: "Black Mamba Élite 3k 2.0 2025" },
  { brand: "Vibor-A", model: "Black Mamba Radical 12k 2.0 2025" },
];

for (const t of targets) {
  const racket = await storage.getRacketByBrandAndModel(t.brand, t.model);
  if (racket) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`RACKET: ${racket.brand} ${racket.model} (${racket.year})`);
    console.log(`Ratings: power=${racket.powerRating} control=${racket.controlRating} rebound=${racket.reboundRating} maneuverability=${racket.maneuverabilityRating} sweetSpot=${racket.sweetSpotRating} overall=${racket.overallRating}`);
    console.log(`Review length: ${racket.reviewContent?.length ?? 0} chars`);
    console.log(`${"=".repeat(80)}`);
    console.log(racket.reviewContent ?? "(no review)");
  } else {
    console.log(`NOT FOUND: ${t.brand} ${t.model}`);
  }
}
process.exit(0);
