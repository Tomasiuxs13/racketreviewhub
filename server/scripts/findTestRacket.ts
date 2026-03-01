import "dotenv/config";
import { storage } from "../storage.js";

async function run() {
    const rackets = await storage.getAllRackets();
    if (rackets.length === 0) {
        console.log("No rackets found.");
        process.exit(0);
    }
    const racket = rackets[0];
    console.log(`TEST_RACKET_ID=${racket.id}`);
    console.log(`TEST_RACKET_NAME=${racket.brand} ${racket.model}`);
    process.exit(0);
}

run().catch(console.error);
