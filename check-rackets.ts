import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { rackets } from "./shared/schema.js";
import { or, ilike } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: "./.env" });

const client = postgres(process.env.DATABASE_URL as string, {
    ssl: { rejectUnauthorized: false }
});
const db = drizzle(client);

async function main() {
    const results = await db.select({
        id: rackets.id,
        brand: rackets.brand,
        model: rackets.model,
        year: rackets.year,
        inStock: rackets.inStock,
        padelMarketInStock: rackets.padelMarketInStock,
        feedProductId: rackets.feedProductId,
        padelMarketFeedProductId: rackets.padelMarketFeedProductId,
        currentPrice: rackets.currentPrice,
        originalPrice: rackets.originalPrice,
        isPublished: rackets.isPublished,
        affiliateLink: rackets.affiliateLink,
        padelMarketAffiliateLink: rackets.padelMarketAffiliateLink
    }).from(rackets)
        .where(or(
            ilike(rackets.model, '%Vertex 03 Comfort%'),
            ilike(rackets.model, '%AT10 Genius 18K Alum%')
        ));

    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
}
main().catch(console.error);
