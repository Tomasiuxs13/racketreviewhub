import { storage } from "../storage.js";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Generate a slug from brand and model (same logic as client/src/lib/utils.ts)
 */
function getRacketSlug(brand: string, model: string): string {
  const base = `${brand} ${model}`.toLowerCase();
  return base
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Find a racket by brand and model (case-insensitive, flexible matching)
 */
function findRacket(
  allRackets: Array<{ brand: string; model: string }>,
  targetBrand: string,
  targetModel: string
): { brand: string; model: string } | null {
  const normalizedTargetBrand = targetBrand.toLowerCase().trim();
  const normalizedTargetModel = targetModel.toLowerCase().trim();

  // Try exact match first
  let match = allRackets.find(
    (r) =>
      r.brand.toLowerCase().trim() === normalizedTargetBrand &&
      r.model.toLowerCase().trim() === normalizedTargetModel
  );

  if (match) return match;

  // Try partial match on model (e.g., "Contact" matches "Babolat Contact")
  match = allRackets.find(
    (r) =>
      r.brand.toLowerCase().trim() === normalizedTargetBrand &&
      r.model.toLowerCase().trim().includes(normalizedTargetModel)
  );

  if (match) return match;

  // Try reverse partial match
  match = allRackets.find(
    (r) =>
      r.brand.toLowerCase().trim() === normalizedTargetBrand &&
      normalizedTargetModel.includes(r.model.toLowerCase().trim())
  );

  return match || null;
}

interface RacketReference {
  placeholder: string;
  brand: string;
  model: string;
}

// Map of placeholder IDs to brand/model pairs from the guides
const racketReferences: RacketReference[] = [
  { placeholder: "[BABOLAT-CONTACT-ID]", brand: "Babolat", model: "Contact" },
  { placeholder: "[HEAD-ZEPHYR-PRO-ID]", brand: "Head", model: "Zephyr Pro" },
  { placeholder: "[ADIDAS-ESSNOVA-CTRL-ID]", brand: "Adidas", model: "Essnova Ctrl" },
  { placeholder: "[NOX-EQUATION-LADY-ID]", brand: "Nox", model: "Equation Lady" },
  { placeholder: "[BABOLAT-AIR-VIPER-ID]", brand: "Babolat", model: "Air Viper" },
  { placeholder: "[BULLPADEL-FLOW-ID]", brand: "Bullpadel", model: "Flow" },
  { placeholder: "[BULLPADEL-VERTEX-04-ID]", brand: "Bullpadel", model: "Vertex 04" },
  { placeholder: "[BABOLAT-TECHNICAL-VIPER-ID]", brand: "Babolat", model: "Technical Viper" },
  { placeholder: "[HEAD-DELTA-MOTION-ID]", brand: "Head", model: "Delta Motion" },
  { placeholder: "[HEAD-ALPHA-ELITE-ID]", brand: "Head", model: "Alpha Elite" },
];

async function fixGuideLinks() {
  console.log("Loading rackets from database...");
  const allRackets = await storage.getAllRackets();
  console.log(`Found ${allRackets.length} rackets in database`);

  // Build mapping of placeholder -> slug
  const replacements = new Map<string, string>();

  for (const ref of racketReferences) {
    const racket = findRacket(allRackets, ref.brand, ref.model);
    if (racket) {
      const slug = getRacketSlug(racket.brand, racket.model);
      const url = `/rackets/${slug}`;
      replacements.set(ref.placeholder, url);
      console.log(`✓ Found: ${ref.brand} ${ref.model} -> ${url}`);
    } else {
      console.warn(`✗ Not found: ${ref.brand} ${ref.model}`);
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

    for (const [placeholder, url] of replacements.entries()) {
      // Replace placeholder in links like [/rackets/[PLACEHOLDER-ID]]
      const linkPattern = new RegExp(
        `(\\(/rackets/\\s*)${placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s*\\))`,
        "g"
      );
      if (content.match(linkPattern)) {
        content = content.replace(linkPattern, `$1${url.replace("/rackets/", "")}$2`);
        changed = true;
        console.log(`  Replaced link with ${placeholder} -> ${url}`);
      }
      
      // Also replace standalone placeholder (for any other uses)
      const standalonePattern = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      if (content.includes(placeholder) && !content.match(linkPattern)) {
        content = content.replace(standalonePattern, url);
        changed = true;
        console.log(`  Replaced standalone ${placeholder} -> ${url}`);
      }
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

fixGuideLinks().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

