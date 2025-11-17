import "dotenv/config";
import type { InsertBrand, Racket } from "@shared/schema";

// Dynamic import of storage so it picks SupabaseStorage vs MemStorage correctly
let storage: Awaited<typeof import("../storage.js").storage>;

// Specific non-brand values that may appear in the racket "brand" field
const NON_BRAND_VALUES = new Set([
  "Black, Grey",
  "Blue",
  "Overgrips, Padel Racket Protectors",
  "Overgrips, Padel Racket Protectors, Shockout Antivibrator",
  "Red",
]);

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildBrandDescription(brandName: string): string {
  return `Discover the best padel rackets from ${brandName}, from powerful attacking frames to easy-to-play control models for every level of player.`;
}

function buildBrandArticle(brandName: string, rackets: Racket[]): string {
  const top = [...rackets]
    .sort((a, b) => b.overallRating - a.overallRating)
    .slice(0, 10);

  const intro = `<p>${brandName} is one of the key names in modern padel. Below you’ll find our curated selection of their best rackets based on performance, playability, and value for money.</p>`;

  if (top.length === 0) {
    return intro;
  }

  const listItems = top
    .map((racket) => {
      const title = `${racket.brand} ${racket.model} ${racket.year ?? ""}`.trim();
      return `<li><strong>${title}</strong> – overall rating ${racket.overallRating}/100, ideal for players looking for a balance of power and control.</li>`;
    })
    .join("\n");

  const listSection = `<h2>Top ${top.length} ${brandName} padel rackets</h2>
<ol>
${listItems}
</ol>`;

  const outro = `<p>Click any racket above to read the full, in-depth review with detailed ratings, specifications, and our expert verdict.</p>`;

  return [intro, listSection, outro].join("\n");
}

async function generateBrandsFromRackets() {
  const storageModule = await import("../storage.js");
  storage = storageModule.storage;

  if (!process.env.DATABASE_URL) {
    console.warn("⚠️  DATABASE_URL not set. Using in-memory storage – brands will be lost on restart.\n");
  } else {
    console.log("✓ Using SupabaseStorage (persistent storage)\n");
  }

  const rackets = await storage.getAllRackets();
  if (!rackets || rackets.length === 0) {
    console.log("No rackets found. Upload rackets first via /admin before generating brands.");
    return;
  }

  const existingBrands = await storage.getAllBrands();
  const existingNames = new Set(existingBrands.map((b) => b.name.toLowerCase()));

  // Group rackets by brand name
  const racketsByBrand = new Map<string, Racket[]>();
  for (const racket of rackets) {
    const brandName = racket.brand?.trim();
    if (!brandName) continue;
    if (NON_BRAND_VALUES.has(brandName)) continue;
    const key = brandName;
    if (!racketsByBrand.has(key)) {
      racketsByBrand.set(key, []);
    }
    racketsByBrand.get(key)!.push(racket);
  }

  let createdCount = 0;

  for (const [brandName, brandRackets] of Array.from(racketsByBrand.entries())) {
    if (existingNames.has(brandName.toLowerCase())) {
      console.log(`Brand "${brandName}" already exists, skipping.`);
      continue;
    }

    const slug = generateSlug(brandName);
    const description = buildBrandDescription(brandName);
    const articleContent = buildBrandArticle(brandName, brandRackets);

    const brandData: InsertBrand = {
      name: brandName,
      slug,
      description,
      logoUrl: null,
      articleContent,
    };

    await storage.createBrand(brandData);
    createdCount++;
    console.log(`✓ Created brand "${brandName}" with slug "${slug}" and ${brandRackets.length} associated rackets.`);
  }

  if (createdCount === 0) {
    console.log("No new brands were created. All racket brands already have brand records.");
  } else {
    console.log(`\nDone. Created ${createdCount} new brand(s).`);
  }
}

generateBrandsFromRackets().catch((err) => {
  console.error("Error generating brands from rackets:", err);
});


