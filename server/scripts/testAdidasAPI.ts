import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { brands, rackets } from "@shared/schema";
import { eq } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

async function testAdidasAPI() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  try {
    // Simulate the API call: get brand by slug
    const brand = await db
      .select()
      .from(brands)
      .where(eq(brands.slug, "adidas"))
      .limit(1);

    if (brand.length === 0) {
      console.log("✗ Brand not found");
      await client.end();
      return;
    }

    console.log(`✓ Brand found: "${brand[0].name}" (slug: ${brand[0].slug})`);
    console.log();

    // Simulate the rackets API call: get rackets by brand name
    const racketsByBrand = await db
      .select()
      .from(rackets)
      .where(eq(rackets.brand, brand[0].name))
      .limit(10);

    console.log(`✓ Found ${racketsByBrand.length} rackets for brand "${brand[0].name}"`);
    console.log();
    console.log("First 5 rackets:");
    racketsByBrand.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.brand} ${r.model}`);
    });

    await client.end();
  } catch (error) {
    console.error("Error:", error);
    await client.end();
    process.exit(1);
  }
}

testAdidasAPI().catch(console.error);

