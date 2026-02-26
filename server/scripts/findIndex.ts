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
        const unpublished = await client`
      SELECT id, brand, model
      FROM rackets 
      WHERE is_published = false
      ORDER BY created_at DESC 
    `;

        const index = unpublished.findIndex(r => r.id === 'dbdad058-03d5-457d-9ebe-c282eb97eb19');
        console.log("Index of Drop Shot Canyon Pro in unpublished list:", index);
        console.log("Equivalent --start-from number:", index + 1);

        const published = await client`
      SELECT id, brand, model
      FROM rackets 
      WHERE is_published = true
      ORDER BY created_at DESC 
    `;

        // what is the index of the first published racket that has a review length < 100?
        const publishedWithReview = await client`
      SELECT id, brand, model, length(review_content) as review_length
      FROM rackets 
      WHERE is_published = true
      ORDER BY created_at DESC 
    `;
        const indexPublished = publishedWithReview.findIndex(r => !r.review_length || r.review_length < 100);
        console.log("Index of first published racket without review:", indexPublished);
        console.log("Equivalent --start-from number:", indexPublished + 1);

        // What if we didn't filter by published?
        const all = await client`
      SELECT id, brand, model
      FROM rackets 
      ORDER BY created_at DESC 
    `;
        const indexAll = all.findIndex(r => r.id === 'dbdad058-03d5-457d-9ebe-c282eb97eb19');
        console.log("Index of Drop Shot in ALL list:", indexAll);

    } catch (error) {
        console.error("Error connecting to DB:", error);
    } finally {
        await client.end();
    }
}

main();
