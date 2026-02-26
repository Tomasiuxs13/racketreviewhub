import "dotenv/config";
import postgres from "postgres";

async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error("DATABASE_URL not found!");
        return;
    }

    const client = postgres(databaseUrl, {
        ssl: { rejectUnauthorized: false }
    });

    try {
        const published = await client`
      SELECT id, brand, model, year, created_at, is_published, length(review_content) as review_length
      FROM rackets 
      WHERE is_published = true
      ORDER BY created_at DESC 
    `;

        const unpublished = await client`
      SELECT id, brand, model, year, created_at, is_published, length(review_content) as review_length
      FROM rackets 
      WHERE is_published = false
      ORDER BY created_at DESC 
    `;

        console.log("Total published rackets:", published.length);
        if (published.length >= 278) {
            console.log("--published --start-from 278 corresponds to:");
            console.log(published[277]);
        } else {
            console.log("Not enough published rackets for --start-from 278.");
        }

        console.log("\nTotal unpublished rackets:", unpublished.length);
        if (unpublished.length >= 278) {
            console.log("Unpublished racket at index 277 (for --start-from 278):");
            console.log(unpublished[277]);
        }

    } catch (error) {
        console.error("Error connecting to DB:", error);
    } finally {
        await client.end();
    }
}

main();
