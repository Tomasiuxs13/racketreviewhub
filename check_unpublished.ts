import "dotenv/config";
import { storage } from "./server/storage.js";
import { checkPublishQualityGates } from "./server/lib/qualityGates.js";

async function run() {
    const allRackets = await storage.getAllRackets();
    const unpublished = allRackets.filter(r => !r.isPublished);

    console.log(`Total unpublished rackets: ${unpublished.length}`);

    const failReasonsSummary: Record<string, number> = {};
    const exactFailuresCount: Record<string, number> = {};

    for (const racket of unpublished) {
        const qualityResult = checkPublishQualityGates(racket);

        if (qualityResult.passes) {
            failReasonsSummary["Passed quality gates but still unpublished"] = (failReasonsSummary["Passed quality gates but still unpublished"] || 0) + 1;
        } else {
            for (const reason of qualityResult.failures) {
                // Grouping similar reasons (e.g., character counts or no affiliate link)
                let category = reason;
                if (reason.startsWith("Review too short")) category = "Review too short (needs 7000+ chars)";

                exactFailuresCount[reason] = (exactFailuresCount[reason] || 0) + 1;
                failReasonsSummary[category] = (failReasonsSummary[category] || 0) + 1;
            }
        }
    }

    console.log("\n--- Failure Reasons Summary ---");
    for (const [reason, count] of Object.entries(failReasonsSummary)) {
        console.log(`- ${reason}: count ${count}`);
    }

    if (Object.keys(exactFailuresCount).length > Object.keys(failReasonsSummary).length) {
        console.log("\n--- Exact Failures count (detail) ---");
        for (const [reason, count] of Object.entries(exactFailuresCount)) {
            console.log(`- ${reason}: count ${count}`);
        }
    }

    process.exit(0);
}

run().catch(console.error);
