import "dotenv/config";
import { storage } from "../storage.js";
import { performRacketResearch, estimateRacketRatings, generateRacketReview } from "../lib/openai.js";
import { checkPublishQualityGates } from "../lib/qualityGates.js";
import type { Racket } from "@shared/schema";

// Helper to build URL-friendly slugs for rackets
function getRacketSlug(racket: Pick<Racket, "brand" | "model">): string {
    const brandLower = racket.brand.toLowerCase();
    const modelLower = racket.model.toLowerCase();
    const modelStartsWithBrand = modelLower.startsWith(brandLower);
    const base = modelStartsWithBrand ? modelLower : `${brandLower} ${modelLower}`;
    return base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

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

function parseIntArg(flag: string): number | undefined {
    const idx = process.argv.indexOf(flag);
    if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
    const val = parseInt(process.argv[idx + 1], 10);
    return isNaN(val) ? undefined : val;
}

async function run() {
    console.log("Starting Bulk Racket Regeneration (Research -> Rate -> Review)...");

    const processPublished = process.argv.includes("--published");
    const processAll = process.argv.includes("--all");
    const startFrom = parseIntArg("--start-from") ?? 1; // 1-based
    const limit = parseIntArg("--limit");

    const modeLabel = processAll ? "ALL (published + unpublished)" : processPublished ? "PUBLISHED" : "UNPUBLISHED";
    console.log(`Targeting: ${modeLabel} rackets.`);

    // Get all rackets that exist
    const allRackets = await storage.getAllRackets();

    // Filter by publish status
    let rackets = processAll
        ? allRackets
        : allRackets.filter(r => r.isPublished === processPublished);

    const totalMatched = rackets.length;
    const inStockCount = rackets.filter(r => r.inStock).length;
    const outOfStockCount = rackets.filter(r => !r.inStock).length;
    console.log(`Found ${totalMatched} rackets (${inStockCount} in stock, ${outOfStockCount} out of stock).`);

    // Apply --start-from (1-based index)
    if (startFrom > 1) {
        rackets = rackets.slice(startFrom - 1);
        console.log(`Skipping first ${startFrom - 1} rackets (--start-from ${startFrom}).`);
    }

    // Apply --limit
    if (limit !== undefined) {
        rackets = rackets.slice(0, limit);
        console.log(`Limiting to ${limit} rackets (--limit ${limit}).`);
    }

    console.log(`Processing ${rackets.length} of ${totalMatched} rackets (${modeLabel}).`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < rackets.length; i++) {
        const absoluteIndex = (startFrom - 1) + i; // 0-based position in the full list
        const racket = rackets[i];
        console.log(`\n--- [${i + 1}/${rackets.length}] (#${absoluteIndex + 1} overall) Processing: ${racket.brand} ${racket.model} ---`);

        try {
            // Step 1: Online Research
            console.log("-> Searching web for specs & sentiment (Perplexity)...");
            const research = await withRetry(() => performRacketResearch({
                brand: racket.brand,
                model: racket.model,
                year: racket.year
            }));

            let researchBriefText = null;
            let researchKeywords: string[] = [];

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

                // Capture keywords for the review generation step
                if (research.keywords?.length) {
                    researchKeywords = research.keywords;
                    console.log(`   Found ${researchKeywords.length} SEO keywords from research.`);
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
                // Find 2 comparable rackets using scoring
                const priceNum = Number(perfectlyUpdatedRacket.currentPrice) || 0;
                // Exclude pickleball/non-padel rackets from competitor pool
                const PICKLEBALL_KEYWORDS = ["pickleball", "pickle ball"];
                const scored = allRackets
                    .filter(r => r.id !== perfectlyUpdatedRacket.id)
                    .filter(r => !PICKLEBALL_KEYWORDS.some(kw => r.model.toLowerCase().includes(kw) || r.brand.toLowerCase().includes(kw)))
                    .map(r => {
                        let score = 0;
                        if (r.shape === perfectlyUpdatedRacket.shape) score += 3;
                        if (r.gameLevel && r.gameLevel === perfectlyUpdatedRacket.gameLevel) score += 2;
                        if (r.gameType && r.gameType === perfectlyUpdatedRacket.gameType) score += 2;
                        if (r.brand !== perfectlyUpdatedRacket.brand) score += 1; // diversity bonus
                        const priceDiff = Math.abs((Number(r.currentPrice) || 0) - priceNum);
                        if (priceDiff > 100) score -= 2;
                        else if (priceDiff > 50) score -= 1;
                        return { racket: r, score };
                    })
                    .filter(s => s.score > 0)
                    .sort((a, b) => b.score - a.score);
                // Fetch recent guides for internal linking
                const recentGuides = await storage.getRecentGuides(3);
                const internalLinks = recentGuides.map(
                    guide => `<a href="/guides/${guide.slug}">${guide.title}</a>`
                );

                const competitors = scored.slice(0, 2).map(s =>
                    `<a href="/rackets/${getRacketSlug(s.racket)}">${s.racket.brand} ${s.racket.model}</a>`
                );

                if (competitors.length > 0) {
                    console.log(`   Found competitors for comparison: ${scored.slice(0, 2).map(s => `${s.racket.brand} ${s.racket.model}`).join(", ")}`);
                }
                if (internalLinks.length > 0) {
                    console.log(`   Found ${internalLinks.length} internal links to guides.`);
                }

                console.log("   (Waiting for OpenRouter LLM Review Generation & Translations...)");
                const reviewResult = await withRetry(() => generateRacketReview(perfectlyUpdatedRacket, {
                    competitors,
                    internalLinks,
                    keywords: researchKeywords,
                    targetLocales: ["es", "pt", "it", "fr"]
                }));

                if (reviewResult?.reviewContent) {
                    console.log(`   Review length: ${reviewResult.reviewContent.length} chars`);

                    // Save review content together with ratings to keep them in sync
                    const reviewUpdate: Record<string, any> = {
                        reviewContent: reviewResult.reviewContent,
                    };
                    if (estimatedRatings) {
                        reviewUpdate.powerRating = estimatedRatings.powerRating;
                        reviewUpdate.controlRating = estimatedRatings.controlRating;
                        reviewUpdate.reboundRating = estimatedRatings.reboundRating;
                        reviewUpdate.maneuverabilityRating = estimatedRatings.maneuverabilityRating;
                        reviewUpdate.sweetSpotRating = estimatedRatings.sweetSpotRating;
                        reviewUpdate.overallRating = estimatedRatings.overallRating;
                    }

                    const savedRacket = await storage.updateRacket(racket.id, reviewUpdate);
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
            console.log(`   To resume from this racket, run with: --start-from ${absoluteIndex + 1}`);
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
