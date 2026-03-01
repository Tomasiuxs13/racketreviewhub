import "dotenv/config";
import postgres from "postgres";

async function run() {
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL not found");
        return;
    }

    const sql = postgres(process.env.DATABASE_URL, {
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("Adding audio_summary_url column to rackets table...");
        await sql`ALTER TABLE rackets ADD COLUMN IF NOT EXISTS audio_summary_url TEXT;`;
        console.log("✓ Column added successfully!");
    } catch (error) {
        console.error("Failed to add column:", error);
    } finally {
        await sql.end();
    }
}

run().catch(console.error);
