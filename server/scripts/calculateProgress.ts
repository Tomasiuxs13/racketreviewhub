import "dotenv/config";
import { storage } from "../storage.js";

async function run() {
    const allRackets = await storage.getAllRackets();
    const publishedRackets = allRackets.filter(r => r.isPublished);
    const targetRackets = publishedRackets.slice(277);

    let latestIndex = -1;
    let maxTime = 0;

    // Also track the highest index that was recently updated (e.g. within last 2 days)
    // Actually, any update today.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let highestUpdatedIndexToday = -1;

    for (let i = 0; i < targetRackets.length; i++) {
        const r = targetRackets[i];
        const t = new Date(r.updatedAt || 0).getTime();

        if (t > maxTime) {
            maxTime = t;
            latestIndex = i + 278; // 1-based index in publishedRackets
        }

        if (t > today.getTime()) {
            highestUpdatedIndexToday = i + 278;
        }
    }

    console.log(`Latest updated racket is at index: ${latestIndex}`);
    console.log(`Highest index updated today is: ${highestUpdatedIndexToday}`);

    const latestRacket = targetRackets[latestIndex - 278];
    console.log(`That racket is: ${latestRacket.brand} ${latestRacket.model} (Updated At: ${new Date(latestRacket.updatedAt!).toISOString()})`);

    process.exit(0);
}

run().catch(console.error);
