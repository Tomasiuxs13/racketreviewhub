import "dotenv/config";
import { storage } from "../storage.js";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(import.meta.url.replace("file://", ""), "..");

function getRacketSlug(brand: string, model: string): string {
  const base = `${brand} ${model}`.toLowerCase();
  return base
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fixGuideRacketReferences() {
  const allRackets = await storage.getAllRackets();
  
  // Find suitable replacements for guide rackets
  const replacements = new Map<string, { brand: string; model: string; slug: string } | null>();
  
  // For beginners guide - need round rackets with high control
  const beginnerRackets = allRackets
    .filter(r => r.shape?.toLowerCase() === "round" && r.controlRating >= 70)
    .sort((a, b) => b.controlRating - a.controlRating)
    .slice(0, 10);
  
  // For shapes guide - need examples of each shape
  const roundExamples = allRackets
    .filter(r => r.shape?.toLowerCase() === "round")
    .sort((a, b) => b.controlRating - a.controlRating)
    .slice(0, 5);
  
  const teardropExamples = allRackets
    .filter(r => r.shape?.toLowerCase() === "teardrop")
    .sort((a, b) => (b.powerRating + b.controlRating) - (a.powerRating + a.controlRating))
    .slice(0, 5);
  
  const diamondExamples = allRackets
    .filter(r => r.shape?.toLowerCase() === "diamond")
    .sort((a, b) => b.powerRating - a.powerRating)
    .slice(0, 5);
  
  console.log("\nFound suitable rackets:");
  console.log(`Round examples: ${roundExamples.length}`);
  console.log(`Teardrop examples: ${teardropExamples.length}`);
  console.log(`Diamond examples: ${diamondExamples.length}`);
  console.log(`Beginner-friendly: ${beginnerRackets.length}\n`);
  
  // Map old references to new ones
  const guideRackets = [
    // Beginners guide
    { old: { brand: "Babolat", model: "Contact" }, new: beginnerRackets[0] },
    { old: { brand: "Head", model: "Zephyr Pro" }, new: beginnerRackets[1] },
    { old: { brand: "Adidas", model: "Essnova Ctrl" }, new: beginnerRackets[2] },
    { old: { brand: "Nox", model: "Equation Lady" }, new: beginnerRackets[3] },
    
    // Shapes guide - round
    { old: { brand: "Babolat", model: "Contact" }, new: roundExamples[0] },
    { old: { brand: "Head", model: "Zephyr Pro" }, new: roundExamples[1] },
    { old: { brand: "Adidas", model: "Essnova Ctrl" }, new: roundExamples[2] },
    
    // Shapes guide - teardrop
    { old: { brand: "Babolat", model: "Air Viper" }, new: teardropExamples[0] },
    { old: { brand: "Bullpadel", model: "Flow" }, new: teardropExamples[1] },
    { old: { brand: "Head", model: "Delta Motion" }, new: teardropExamples[2] },
    
    // Shapes guide - diamond
    { old: { brand: "Bullpadel", model: "Vertex 04" }, new: diamondExamples[0] },
    { old: { brand: "Babolat", model: "Technical Viper" }, new: diamondExamples[1] },
    { old: { brand: "Head", model: "Alpha Elite" }, new: diamondExamples[2] },
  ];
  
  // Build replacement map
  for (const { old, new: newRacket } of guideRackets) {
    if (newRacket) {
      const oldSlug = getRacketSlug(old.brand, old.model);
      const newSlug = getRacketSlug(newRacket.brand, newRacket.model);
      replacements.set(oldSlug, {
        brand: newRacket.brand,
        model: newRacket.model,
        slug: newSlug,
      });
      console.log(`Replacing: ${old.brand} ${old.model} -> ${newRacket.brand} ${newRacket.model}`);
    }
  }
  
  // Update guide files
  const guideFiles = [
    "server/data/guide-beginners-2025.md",
    "server/data/guide-shapes-comparison-2025.md",
  ];
  
  for (const filePath of guideFiles) {
    console.log(`\nProcessing ${filePath}...`);
    let content = readFileSync(filePath, "utf-8");
    let changed = false;
    
    // Replace racket references in links
    for (const [oldSlug, newRacket] of replacements.entries()) {
      if (!newRacket) continue;
      
      const oldUrl = `/rackets/${oldSlug}`;
      const newUrl = `/rackets/${newRacket.slug}`;
      
      // Replace in markdown links
      const linkPattern = new RegExp(`\\[([^\\]]+)\\]\\(${oldUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`, "g");
      if (content.match(linkPattern)) {
        content = content.replace(linkPattern, `[$1](${newUrl})`);
        changed = true;
        console.log(`  Replaced link: ${oldUrl} -> ${newUrl}`);
      }
      
      // Also replace racket names in text if they appear
      const namePattern = new RegExp(`\\b${oldSlug.split("-").join("\\s+")}\\b`, "gi");
      // This is more complex, so we'll focus on links for now
    }
    
    if (changed) {
      writeFileSync(filePath, content, "utf-8");
      console.log(`✓ Updated ${filePath}`);
    } else {
      console.log(`  No changes needed`);
    }
  }
  
  console.log("\nDone!");
}

fixGuideRacketReferences().catch(console.error);


