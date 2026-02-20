import "dotenv/config";
import { storage } from "../storage.js";
import { performRacketResearch, estimateRacketRatings, generateRacketReview } from "../lib/openai.js";
import { checkPublishQualityGates } from "../lib/qualityGates.js";

const DELAY_BETWEEN_RACKETS_MS = 5000; // 5 seconds between rackets

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(operation: () => Promise<T | null>, maxRetries = 3, baseDelayMs = 5000): Promise<T | null> {
    let retries = 0;
    while (true) {
        try {
            const result = await operation();
            if (result !== null) return result;
        } catch (error) {
            console.error("   Operation threw an error:", error);
        }

        retries++;
        if (retries > maxRetries) {
            return null; // Exhausted retries
        }
        const delayMs = baseDelayMs * Math.pow(2, retries - 1);
        console.log(`   [Retry ${retries}/${maxRetries}] API call failed or returned null, waiting ${delayMs}ms...`);
        await delay(delayMs);
    }
}

async function run() {
    console.log("Starting Bulk Racket Regeneration (Research -> Rate -> Review)...");

    // Get all rackets that exist
    const allRackets = await storage.getAllRackets();

    // Target specific racket by model name
    const TARGET_MODEL = "HEAD GRAVITY PRO 2024";
    const TARGET_BRAND = "Head";
    const targetRacket = await storage.getRacketByBrandAndModel(TARGET_BRAND, TARGET_MODEL);
    if (!targetRacket) {
        console.error(`Racket "${TARGET_BRAND} ${TARGET_MODEL}" not found.`);
        process.exit(1);
    }
    const rackets = [targetRacket];

    console.log(`Found ${rackets.length} total rackets to process for this test run.`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < rackets.length; i++) {
        const racket = rackets[i];
        console.log(`\n--- [${i + 1}/${rackets.length}] Processing: ${racket.brand} ${racket.model} ---`);

        try {
            // Step 0: Ensure we start from scratch by wiping the current properties
            console.log("-> Wiping existing review/ratings to run entirely from scratch...");
            await storage.updateRacket(racket.id, {
                // Wipe ratings
                powerRating: 0,
                controlRating: 0,
                reboundRating: 0,
                maneuverabilityRating: 0,
                sweetSpotRating: 0,
                // Wipe textuals
                researchBrief: null,
                reviewContent: null,
                isPublished: false,
            });

            // Step 1: Online Research
            console.log("-> Searching web for specs & sentiment (Perplexity)...");
            const research = await withRetry(() => performRacketResearch({
                brand: racket.brand,
                model: racket.model,
                year: racket.year
            }));

            let researchBriefText = null;

            if (research) {
                console.log("   Found research data. Updating DB with discovered specs...");

                const updates: any = {};

                // Update specs only if we don't have them yet and Perplexity found them
                if (research.specs) {
                    if (!racket.balance && research.specs.balance) updates.balance = research.specs.balance;
                    if (!racket.surface && research.specs.surface) updates.surface = research.specs.surface;
                    if (!racket.hardness && research.specs.hardness) updates.hardness = research.specs.hardness;
                    if (!racket.core && research.specs.core) updates.core = research.specs.core;
                    if (!racket.gameLevel && research.specs.gameLevel) updates.gameLevel = research.specs.gameLevel;
                    if (!racket.gameType && research.specs.gameType) updates.gameType = research.specs.gameType;
                    if (!racket.player && research.specs.player) updates.player = research.specs.player;
                }

                // Store the brief
                if (research.sentiment) {
                    let brief = research.sentiment;
                    if (research.commonComplaints && research.commonComplaints.length > 0) {
                        brief += "\n\nCommon Complaints: " + research.commonComplaints.join("; ");
                    }
                    researchBriefText = brief;
                    updates.researchBrief = brief;
                }

                if (Object.keys(updates).length > 0) {
                    await storage.updateRacket(racket.id, updates);
                }
            } else {
                console.log("   No research data found. Plodding along with existing specs.");
            }

            // Step 2: Estimate Ratings
            console.log("-> Generating grounded ratings...");

            // We pass the updated state logically since we just pushed it to DB
            const updatedRacketForRatings = {
                ...racket,
                researchBrief: researchBriefText || racket.researchBrief,
            };

            const estimatedRatings = await withRetry(() => estimateRacketRatings({
                brand: updatedRacketForRatings.brand,
                model: updatedRacketForRatings.model,
                shape: updatedRacketForRatings.shape,
                year: updatedRacketForRatings.year,
                balance: updatedRacketForRatings.balance || undefined,
                surface: updatedRacketForRatings.surface || undefined,
                hardness: updatedRacketForRatings.hardness || undefined,
                core: updatedRacketForRatings.core || undefined,
                gameLevel: updatedRacketForRatings.gameLevel || undefined,
                gameType: updatedRacketForRatings.gameType || undefined,
                player: updatedRacketForRatings.player || undefined,
                researchBrief: updatedRacketForRatings.researchBrief
            }));

            if (estimatedRatings) {
                console.log(`   Ratings Updated! Overall: ${estimatedRatings.overallRating}/100`);
                await storage.updateRacket(racket.id, estimatedRatings);
            }

            // Step 3: Write Review
            console.log("-> Writing expert HTML review...");

            // Re-fetch to get absolute latest state
            const perfectlyUpdatedRacket = await storage.getRacket(racket.id);

            if (perfectlyUpdatedRacket) {
                // Find 2-3 comparable rackets
                const priceNum = Number(perfectlyUpdatedRacket.currentPrice) || 0;
                const competitors = allRackets
                    .filter(r =>
                        r.id !== perfectlyUpdatedRacket.id &&
                        r.shape === perfectlyUpdatedRacket.shape &&
                        Math.abs((Number(r.currentPrice) || 0) - priceNum) < 50
                    )
                    .slice(0, 2)
                    .map(r => `${r.brand} ${r.model}`);

                if (competitors.length > 0) {
                    console.log(`   Found competitors for comparison: ${competitors.join(", ")}`);
                }

                console.log("   (Waiting for OpenRouter LLM Review Generation & Translations...)");
                const reviewResult = await withRetry(() => generateRacketReview(perfectlyUpdatedRacket, {
                    competitors,
                    targetLocales: ["es"] // Only test Spanish translation to save time
                }));

                if (reviewResult?.reviewContent) {
                    console.log(`   Review length: ${reviewResult.reviewContent.length} chars`);
                    const savedRacket = await storage.updateRacket(racket.id, {
                        reviewContent: reviewResult.reviewContent,
                    });
                    console.log(`   Save result - isPublished: ${savedRacket?.isPublished}, reviewContent length: ${savedRacket?.reviewContent?.length ?? 0}`);
                    console.log("   Review generated & saved!");

                    // Check if it passes gates to publish
                    const finalRacketState = await storage.getRacket(racket.id);
                    if (finalRacketState) {
                        const qualityResult = checkPublishQualityGates(finalRacketState);
                        if (qualityResult.passes && !finalRacketState.isPublished) {
                            await storage.updateRacket(racket.id, { isPublished: true });
                            console.log(`   Auto-published! (passed quality gates)`);
                        }
                    }

                    successCount++;
                } else {
                    console.log("   Failed to write review.");
                    failCount++;
                }
            }

        } catch (e) {
            console.error("   Error during pipeline:", e);
            failCount++;
        }

        if (i < rackets.length - 1) {
            console.log(`Sleeping for ${DELAY_BETWEEN_RACKETS_MS / 1000}s to prevent rate limits...`);
            await delay(DELAY_BETWEEN_RACKETS_MS);
        }
    }

    console.log("\n==================================");
    console.log(`Done! Success: ${successCount} | Failed: ${failCount}`);
    process.exit(0);
}

run().catch(console.error);
