import "dotenv/config";
import { storage } from "../storage.js";

async function checkStatus() {
    console.log("Fetching all rackets...");
    const allRackets = await storage.getAllRackets();

    console.log("First 20 rackets in the list:");
    allRackets.slice(0, 20).forEach((r, i) => {
        console.log(`${i + 1}. ${r.brand} ${r.model} (Published: ${r.isPublished}, Review: ${!!r.reviewContent})`);
    });

    const unpublishedRackets = allRackets.filter(r => !r.isPublished);
    console.log("\nFirst 20 UNPUBLISHED rackets:");
    unpublishedRackets.slice(0, 20).forEach((r, i) => {
        console.log(`${i + 1}. ${r.brand} ${r.model} (Review: ${!!r.reviewContent})`);
    });

    let firstWithoutReviewUnpublished = unpublishedRackets.findIndex(r => !r.reviewContent || r.reviewContent.length < 100);
    console.log(`\nFirst unpublished without review: index ${firstWithoutReviewUnpublished + 1}`);
}

checkStatus().catch(console.error);
