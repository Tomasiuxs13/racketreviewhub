import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { brands } from "@shared/schema";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

async function checkBrands() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  try {
    const allBrands = await db.select().from(brands).orderBy(brands.name);

    console.log(`Total brands in database: ${allBrands.length}\n`);
    console.log("All brands:\n");

    allBrands.forEach((brand, index) => {
      console.log(`${index + 1}. "${brand.name}"`);
      console.log(`   Slug: ${brand.slug}`);
      console.log(`   ID: ${brand.id}`);
      console.log();
    });

    // Check specifically for Adidas
    const adidasBrands = allBrands.filter(b => 
      b.slug.includes("adidas") || b.name.toLowerCase().includes("adidas")
    );

    if (adidasBrands.length > 0) {
      console.log("\n✓ Found Adidas brand(s):");
      adidasBrands.forEach(brand => {
        console.log(`   - "${brand.name}" (slug: ${brand.slug})`);
      });
    } else {
      console.log("\n⚠️  No Adidas brand found in database");
      console.log("   You may need to run: npm run generate-brands");
    }

    await client.end();
  } catch (error) {
    console.error("Error checking brands:", error);
    await client.end();
    process.exit(1);
  }
}

checkBrands().catch(console.error);

