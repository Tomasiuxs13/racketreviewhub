import "dotenv/config";
import { storage } from "../storage.js";

async function checkResume() {
    const allRackets = await storage.getAllRackets();
    const unpublished = allRackets.filter(r => !r.isPublished);

    let firstMissingIndex = -1;
    for (let i = 0; i < unpublished.length; i++) {
        if (!unpublished[i].reviewContent || unpublished[i].reviewContent.length < 100) {
            firstMissingIndex = i;
            break;
        }
    }

    if (firstMissingIndex !== -1) {
        console.log(`RESUME_UNPUBLISHED_INDEX=${firstMissingIndex + 1}`);
        console.log(`RESUME_UNPUBLISHED_RACKET=${unpublished[firstMissingIndex].brand} ${unpublished[firstMissingIndex].model}`);
    } else {
        console.log(`RESUME_UNPUBLISHED_INDEX=FINISHED`);
    }

    let firstMissingAllIndex = -1;
    for (let i = 0; i < allRackets.length; i++) {
        if (!allRackets[i].reviewContent || allRackets[i].reviewContent.length < 100) {
            firstMissingAllIndex = i;
            break;
        }
    }

    if (firstMissingAllIndex !== -1) {
        console.log(`RESUME_ALL_INDEX=${firstMissingAllIndex + 1}`);
        console.log(`RESUME_ALL_RACKET=${allRackets[firstMissingAllIndex].brand} ${allRackets[firstMissingAllIndex].model}`);
    }
}

checkResume().catch(console.error);
