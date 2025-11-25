import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { brands } from "@shared/schema";
import { eq } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

async function checkAdidasArticleContent() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  try {
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
    console.log(`Brand: "${brand.name}"`);
    console.log(`Has articleContent: ${!!brand.articleContent}`);
    console.log(`articleContent length: ${brand.articleContent?.length || 0}`);
    console.log(`articleContent trimmed length: ${brand.articleContent?.trim().length || 0}`);
    console.log();
    
    if (brand.articleContent) {
      console.log("First 500 characters of articleContent:");
      console.log("---");
      console.log(brand.articleContent.substring(0, 500));
      console.log("---");
      console.log();
      console.log("Last 200 characters:");
      console.log("---");
      console.log(brand.articleContent.substring(brand.articleContent.length - 200));
      console.log("---");
    } else {
      console.log("⚠️  No articleContent found");
    }

    await client.end();
  } catch (error) {
    console.error("Error:", error);
    await client.end();
    process.exit(1);
  }
}

checkAdidasArticleContent().catch(console.error);

