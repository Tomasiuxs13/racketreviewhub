import "dotenv/config";
import { storage } from "../storage.js";

function getRacketSlug(brand: string, model: string): string {
  const base = `${brand} ${model}`.toLowerCase();
  return base
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getRacketImages() {
  const allRackets = await storage.getAllRackets();
  
  const racketsToFind = [
    { brand: "Adidas", model: "ADIDAS CROSS IT LIGHT 3.4 2025" },
    { brand: "Starvie", model: "STARVIE BRAVA 2025" },
    { brand: "Starvie", model: "STARVIE VESTA 2024" },
    { brand: "Nox", model: "NOX ML10 PRO CUP ROUGH SURFACE EDITION BY MIGUEL LAMPERTI" },
  ];
  
  console.log("\nFinding rackets and their image URLs:\n");
  
  for (const target of racketsToFind) {
    const racket = allRackets.find(
      r => r.brand.toLowerCase() === target.brand.toLowerCase() &&
           r.model.toLowerCase() === target.model.toLowerCase()
    );
    
    if (racket) {
      const slug = getRacketSlug(racket.brand, racket.model);
      console.log(`### ${racket.brand} ${racket.model}`);
      console.log(`![${racket.brand} ${racket.model}](${racket.imageUrl || 'no-image'})`);
      console.log(`Slug: /rackets/${slug}`);
      console.log(`Image URL: ${racket.imageUrl || 'No image available'}`);
      console.log();
    } else {
      console.log(`✗ Not found: ${target.brand} ${target.model}\n`);
    }
  }
}

getRacketImages().catch(console.error);

