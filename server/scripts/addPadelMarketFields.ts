/**
 * Run database migration to add Padel Market fields to rackets table
 * Usage: npx tsx server/scripts/addPadelMarketFields.ts
 */

import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config();

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  const isRenderDatabase = databaseUrl.includes("render.com") || databaseUrl.includes("dpg-");
  
  const sql = postgres(databaseUrl, {
    ssl: isRenderDatabase ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log("Running migration: add Padel Market fields to rackets table...");
    console.log("");
    
    // Add padel_market_affiliate_link column
    await sql`
      ALTER TABLE rackets 
      ADD COLUMN IF NOT EXISTS padel_market_affiliate_link TEXT
    `;
    console.log("✓ Added padel_market_affiliate_link column");

    // Add padel_market_in_stock column
    await sql`
      ALTER TABLE rackets 
      ADD COLUMN IF NOT EXISTS padel_market_in_stock BOOLEAN NOT NULL DEFAULT false
    `;
    console.log("✓ Added padel_market_in_stock column");

    // Add padel_market_feed_product_id column
    await sql`
      ALTER TABLE rackets 
      ADD COLUMN IF NOT EXISTS padel_market_feed_product_id TEXT
    `;
    console.log("✓ Added padel_market_feed_product_id column");

    // Add padel_market_feed_last_updated column
    await sql`
      ALTER TABLE rackets 
      ADD COLUMN IF NOT EXISTS padel_market_feed_last_updated TIMESTAMP
    `;
    console.log("✓ Added padel_market_feed_last_updated column");

    // Create index for faster filtering by Padel Market stock status
    await sql`
      CREATE INDEX IF NOT EXISTS idx_rackets_padel_market_in_stock 
      ON rackets(padel_market_in_stock)
    `;
    console.log("✓ Created idx_rackets_padel_market_in_stock index");

    // Create composite index for common query patterns
    await sql`
      CREATE INDEX IF NOT EXISTS idx_rackets_published_pm_stock 
      ON rackets(is_published, in_stock, padel_market_in_stock)
    `;
    console.log("✓ Created idx_rackets_published_pm_stock composite index");

    console.log("\n✅ Migration completed successfully!");

    // Show current stats
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE padel_market_in_stock = true) as padel_market_in_stock,
        COUNT(*) FILTER (WHERE padel_market_affiliate_link IS NOT NULL) as with_pm_link
      FROM rackets
    `;
    console.log(`\nRacket stats:`);
    console.log(`  - Total rackets: ${stats[0].total}`);
    console.log(`  - Padel Market in stock: ${stats[0].padel_market_in_stock}`);
    console.log(`  - With Padel Market link: ${stats[0].with_pm_link}`);

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();



