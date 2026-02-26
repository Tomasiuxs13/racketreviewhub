import "dotenv/config";
import { storage } from "./server/storage.js";
import { db } from "./server/storage/supabaseStorage.js"; // We need direct db access to delete
import { rackets } from "./shared/schema.js";
import { eq } from "drizzle-orm";

async function run() {
    console.log("Fetching all rackets...");
    const allRackets = await storage.getAllRackets();

    // Group rackets by brand + model to find duplicates
    const groupedRackets: Record<string, typeof allRackets> = {};

    for (const racket of allRackets) {
        // Create a unique key for each racket model
        // Using toLowerCase to catch exact matches that might have different casing
        const key = `${racket.brand.toLowerCase()}|${racket.model.toLowerCase()}`;
        if (!groupedRackets[key]) {
            groupedRackets[key] = [];
        }
        groupedRackets[key].push(racket);
    }

    let totalDuplicatesRemoved = 0;

    console.log(`Found ${Object.keys(groupedRackets).length} unique racket brand/models.`);

    for (const [key, racketList] of Object.entries(groupedRackets)) {
        if (racketList.length > 1) {
            console.log(`\nFound ${racketList.length} entries for: ${racketList[0].brand} ${racketList[0].model}`);

            // Sort by isPublished (true first), then by reviewContent length (longest first), then by updatedAt (newest first)
            // This ensures we keep the best/most complete version
            racketList.sort((a, b) => {
                // 1. Prioritize published
                if (a.isPublished !== b.isPublished) {
                    return a.isPublished ? -1 : 1;
                }

                // 2. Prioritize longer review content
                const aLen = a.reviewContent?.length || 0;
                const bLen = b.reviewContent?.length || 0;
                if (aLen !== bLen) {
                    return bLen - aLen;
                }

                // 3. Prioritize newest
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            });

            const keeper = racketList[0];
            const duplicates = racketList.slice(1);

            console.log(`Keeping ID: ${keeper.id} (Published: ${keeper.isPublished}, Review length: ${keeper.reviewContent?.length || 0})`);

            for (const dup of duplicates) {
                console.log(`  Deleting duplicate ID: ${dup.id} (Published: ${dup.isPublished}, Review length: ${dup.reviewContent?.length || 0})`);
                await storage.deleteRacket(dup.id);
                totalDuplicatesRemoved++;
            }
        }
    }

    console.log(`\nDone! Removed a total of ${totalDuplicatesRemoved} duplicate rackets.`);
    process.exit(0);
}

run().catch(console.error);
