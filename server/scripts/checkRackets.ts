import "dotenv/config";
import { storage } from "../storage.js";

function getRacketSlug(brand: string, model: string): string {
  const base = `${brand} ${model}`.toLowerCase();
  return base
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function checkRackets() {
  const allRackets = await storage.getAllRackets();
  
  console.log(`\nTotal rackets in database: ${allRackets.length}\n`);
  
  // Check for the rackets mentioned in guides
  const guideRackets = [
    { brand: "Babolat", model: "Contact" },
    { brand: "Head", model: "Zephyr Pro" },
    { brand: "Adidas", model: "Essnova Ctrl" },
    { brand: "Nox", model: "Equation Lady" },
    { brand: "Babolat", model: "Air Viper" },
    { brand: "Bullpadel", model: "Flow" },
    { brand: "Bullpadel", model: "Vertex 04" },
    { brand: "Babolat", model: "Technical Viper" },
    { brand: "Head", model: "Delta Motion" },
    { brand: "Head", model: "Alpha Elite" },
  ];
  
  console.log("Checking guide rackets:\n");
  for (const ref of guideRackets) {
    const expectedSlug = getRacketSlug(ref.brand, ref.model);
    const found = allRackets.find(
      r => r.brand.toLowerCase() === ref.brand.toLowerCase() &&
           r.model.toLowerCase() === ref.model.toLowerCase()
    );
    
    if (found) {
      const actualSlug = getRacketSlug(found.brand, found.model);
      console.log(`✓ ${ref.brand} ${ref.model}`);
      console.log(`  Expected slug: ${expectedSlug}`);
      console.log(`  Actual slug: ${actualSlug}`);
      console.log(`  Match: ${expectedSlug === actualSlug ? 'YES' : 'NO'}`);
    } else {
      console.log(`✗ ${ref.brand} ${ref.model} - NOT FOUND`);
      console.log(`  Expected slug: ${expectedSlug}`);
    }
    console.log();
  }
  
  console.log("\nAll rackets in database:\n");
  allRackets.forEach(r => {
    const slug = getRacketSlug(r.brand, r.model);
    console.log(`- ${r.brand} ${r.model} -> /rackets/${slug}`);
  });
}

checkRackets().catch(console.error);

