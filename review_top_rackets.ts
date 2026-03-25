import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { rackets } from "./shared/schema";
import { desc } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
}

async function reviewTop100() {
    const client = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
    const db = drizzle(client);

    try {
        const top100 = await db.select()
            .from(rackets)
            .orderBy(desc(rackets.overallRating))
            .limit(100);

        console.log(`Found ${top100.length} rackets in top 100.`);

        let withAffiliate = 0;
        let averagePrice = 0;
        let priceCount = 0;

        const ratingDistribution: Record<number, number> = {};

        for (const r of top100) {
            if (r.affiliateLink || r.padelMarketAffiliateLink) withAffiliate++;
            if (r.currentPrice && Number(r.currentPrice) > 0) {
                averagePrice += Number(r.currentPrice);
                priceCount++;
            }
            const rating = Math.round(r.overallRating);
            ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
        }

        if (priceCount > 0) averagePrice = averagePrice / priceCount;

        console.log("--- TOP 100 RACKETS SUMMARY ---");
        console.log(`With Affiliate Links: ${withAffiliate}/100`);
        console.log(`Average Price: €${averagePrice.toFixed(2)}`);
        console.log("Rating Distribution:");
        Object.entries(ratingDistribution).sort((a, b) => Number(b[0]) - Number(a[0])).forEach(([rating, count]) => {
            console.log(`   Rating ${rating}: ${count} rackets`);
        });

        console.log("\n--- TOP 30 RACKETS (SAMPLE) ---");
        for (let i = 0; i < Math.min(30, top100.length); i++) {
            const r = top100[i];
            console.log(`${i + 1}. [${r.overallRating}] ${r.brand} ${r.model} (${r.year}) - €${r.currentPrice} - Affil: ${!!(r.affiliateLink || r.padelMarketAffiliateLink)} [Stock: ${r.inStock} / PM: ${r.padelMarketInStock}]`);
        }

        await client.end();
    } catch (err) {
        console.error(err);
        await client.end();
    }
}

reviewTop100().catch(console.error);
