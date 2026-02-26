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
        const result = await client`
      SELECT id, brand, model, year, updated_at, is_published, length(review_content) as review_length
      FROM rackets 
      ORDER BY updated_at DESC 
      LIMIT 1
    `;
        console.log("Last updated racket:");
        console.log(result[0]);
    } catch (error) {
        console.error("Error connecting to DB:", error);
    } finally {
        await client.end();
    }
}

main();
