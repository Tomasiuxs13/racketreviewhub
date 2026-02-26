import "dotenv/config";
import { storage } from "../storage.js";
import fs from "fs";
import path from "path";

async function run() {
    const allRackets = await storage.getAllRackets();
    const publishedRackets = allRackets.filter(r => r.isPublished);

    // Check how many were updated within the last 3 days
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const unregeneratedIndices: number[] = [];

    for (let i = 0; i < publishedRackets.length; i++) {
        const r = publishedRackets[i];
        const updatedAt = new Date(r.updatedAt || r.createdAt || 0);

        if (updatedAt < threeDaysAgo) {
            unregeneratedIndices.push(i + 1); // 1-based index
        }
    }

    if (unregeneratedIndices.length > 0) {
        const scriptPath = path.join(process.cwd(), "server/scripts/runMissedRegenerations.sh");
        let scriptContent = "#!/bin/bash\n\n";
        scriptContent += "echo \"Starting to regenerate ${unregeneratedIndices.length} missed rackets...\"\n\n";

        for (const idx of unregeneratedIndices) {
            scriptContent += `npx tsx server/scripts/regenerateAllReviews.ts --published --start-from ${idx} --limit 1\n`;
            scriptContent += `echo "Finished index ${idx}. Sleeping for 5 seconds..."\n`;
            scriptContent += `sleep 5\n\n`;
        }

        scriptContent += "echo \"All missed rackets have been processed!\"\n";

        fs.writeFileSync(scriptPath, scriptContent);
        fs.chmodSync(scriptPath, "755");
        console.log(`Generated shell script with ${unregeneratedIndices.length} commands at: ${scriptPath}`);
    } else {
        console.log("No missed rackets found!");
    }

    process.exit(0);
}

run().catch(console.error);
