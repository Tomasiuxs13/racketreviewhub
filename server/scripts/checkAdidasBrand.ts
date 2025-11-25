import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { brands, rackets } from "@shared/schema";
import { eq, like } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

async function checkAdidasBrand() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  try {
    // Get Adidas brand
    const adidasBrand = await db
      .select()
      .from(brands)
      .where(eq(brands.slug, "adidas"))
      .limit(1);

    if (adidasBrand.length === 0) {
      console.log("✗ Adidas brand not found");
      await client.end();
      return;
    }

    const brand = adidasBrand[0];
    console.log(`✓ Found brand: "${brand.name}"`);
    console.log(`  Slug: ${brand.slug}`);
    console.log(`  ID: ${brand.id}`);
    console.log(`  Description: ${brand.description || "No description"}`);
    console.log(`  Logo URL: ${brand.logoUrl || "No logo"}`);
    console.log(`  Article Content: ${brand.articleContent ? `${brand.articleContent.length} characters` : "No content"}`);
    console.log();

    // Get Adidas rackets
    const adidasRackets = await db
      .select()
      .from(rackets)
      .where(eq(rackets.brand, brand.name))
      .limit(20);

    console.log(`Found ${adidasRackets.length} Adidas rackets:\n`);
    adidasRackets.forEach((racket, index) => {
      console.log(`${index + 1}. ${racket.brand} ${racket.model} ${racket.year || ""}`);
    });

    await client.end();
  } catch (error) {
    console.error("Error:", error);
    await client.end();
    process.exit(1);
  }
}

checkAdidasBrand().catch(console.error);

