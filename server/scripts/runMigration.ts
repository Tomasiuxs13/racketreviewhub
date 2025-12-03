/**
 * Run database migration to add in_stock column
 * Usage: npx tsx server/scripts/runMigration.ts
 */

import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config();

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL, {
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Running migration: add in_stock field to rackets table...");
    
    // Add the column
    await sql`
      ALTER TABLE rackets 
      ADD COLUMN IF NOT EXISTS in_stock BOOLEAN NOT NULL DEFAULT true
    `;
    console.log("✓ Added in_stock column");

    // Create index for faster filtering
    await sql`
      CREATE INDEX IF NOT EXISTS idx_rackets_in_stock ON rackets(in_stock)
    `;
    console.log("✓ Created idx_rackets_in_stock index");

    // Create composite index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_rackets_published_in_stock ON rackets(is_published, in_stock)
    `;
    console.log("✓ Created idx_rackets_published_in_stock index");

    console.log("\n✅ Migration completed successfully!");

    // Show current stats
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE in_stock = true) as in_stock,
        COUNT(*) FILTER (WHERE in_stock = false) as out_of_stock
      FROM rackets
    `;
    console.log(`\nRacket stats: ${stats[0].total} total, ${stats[0].in_stock} in stock, ${stats[0].out_of_stock} out of stock`);

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();

