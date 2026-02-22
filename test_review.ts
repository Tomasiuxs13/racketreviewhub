/**
 * Test script: full review pipeline for a single racket with 1-language translation.
 * Usage: npx tsx test_review.ts [slug]
 *
 * Default slug: wilson-optix-v2-power-pala
 * Override: npx tsx test_review.ts adidas-metalbone-3-3
 */

import "dotenv/config";
import { storage } from "./server/storage.js";
import {
  generateRacketReview,
  performRacketResearch,
  estimateRacketRatings,
  isOpenAIConfigured,
} from "./server/lib/openai.js";

const slug = process.argv[2] || "wilson-optix-v2-power-pala";

async function main() {
  if (!isOpenAIConfigured) {
    console.error("ERROR: OPENAI_API_KEY is not set. Aborting.");
    process.exit(1);
  }

  console.log(`\n=== Test Review Pipeline ===`);
  console.log(`Slug: ${slug}\n`);

  // 1. Fetch racket
  const racket = await storage.getRacketBySlug(slug);
  if (!racket) {
    console.error(`Racket not found for slug: "${slug}"`);
    process.exit(1);
  }

  console.log(`Found: ${racket.brand} ${racket.model} (id: ${racket.id})`);
  console.log(`Status: ${racket.status} | Price: €${racket.currentPrice}`);

  // 2. Run web research
  console.log("\n[1/4] Performing web research...");
  const research = await performRacketResearch({
    brand: racket.brand,
    model: racket.model,
    year: racket.year ?? undefined,
  });

  if (research) {
    console.log("  Research specs:", JSON.stringify(research.specs, null, 2));
    console.log("  Sentiment:", research.sentiment ?? "(none)");
    if (research.commonComplaints?.length) {
      console.log("  Complaints:", research.commonComplaints.join(" | "));
    }
  } else {
    console.warn("  No research returned.");
  }

  // Build researchBrief from research
  const researchBrief = research
    ? [
        research.sentiment,
        research.commonComplaints?.length
          ? "Common complaints: " + research.commonComplaints.join(", ")
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : null;

  // Merge research specs into racket fields for ratings
  const mergedRacket = {
    ...racket,
    balance: racket.balance || research?.specs?.balance || undefined,
    surface: racket.surface || research?.specs?.surface || undefined,
    hardness: racket.hardness || research?.specs?.hardness || undefined,
    core: racket.core || research?.specs?.core || undefined,
    gameLevel: racket.gameLevel || research?.specs?.gameLevel || undefined,
    gameType: racket.gameType || research?.specs?.gameType || undefined,
    player: racket.player || research?.specs?.player || undefined,
    researchBrief,
  };

  // 3. Estimate ratings
  console.log("\n[2/4] Estimating performance ratings...");
  const ratings = await estimateRacketRatings({
    brand: mergedRacket.brand,
    model: mergedRacket.model,
    shape: mergedRacket.shape ?? "teardrop",
    year: mergedRacket.year ?? undefined,
    balance: mergedRacket.balance ?? undefined,
    surface: mergedRacket.surface ?? undefined,
    hardness: mergedRacket.hardness ?? undefined,
    core: mergedRacket.core ?? undefined,
    gameLevel: mergedRacket.gameLevel ?? undefined,
    gameType: mergedRacket.gameType ?? undefined,
    player: mergedRacket.player ?? undefined,
    researchBrief: researchBrief ?? undefined,
  });

  if (ratings) {
    console.log(
      `  Power: ${ratings.powerRating} | Control: ${ratings.controlRating} | Rebound: ${ratings.reboundRating}`,
    );
    console.log(
      `  Maneuverability: ${ratings.maneuverabilityRating} | SweetSpot: ${ratings.sweetSpotRating} | Overall: ${ratings.overallRating}`,
    );
  } else {
    console.warn("  No ratings returned.");
  }

  // Update racket in storage with research & ratings before generating review
  const preUpdateFields: Record<string, unknown> = {};
  if (researchBrief) preUpdateFields.researchBrief = researchBrief;
  if (ratings) Object.assign(preUpdateFields, ratings);
  // Merge in any research specs that were missing
  for (const field of ["balance", "surface", "hardness", "core", "gameLevel", "gameType", "player"] as const) {
    if (!racket[field] && mergedRacket[field]) {
      preUpdateFields[field] = mergedRacket[field];
    }
  }

  if (Object.keys(preUpdateFields).length) {
    await storage.updateRacket(racket.id, preUpdateFields as Parameters<typeof storage.updateRacket>[1]);
  }

  // Reload with updated fields for review generation
  const racketForReview = { ...mergedRacket, ...(ratings ?? {}) };

  // 4. Generate review (Spanish translation only for test speed)
  console.log("\n[3/4] Generating review (EN) + translating to ES...");
  const result = await generateRacketReview(racketForReview as typeof racket, {
    targetLocales: ["es"],
  });

  if (!result) {
    console.error("  Review generation failed.");
    process.exit(1);
  }

  console.log(`  Review length: ${result.reviewContent.length} chars`);
  const sectionCount = (result.reviewContent.match(/<h2>/gi) || []).length;
  console.log(`  Sections (h2): ${sectionCount}`);

  // 5. Save review back to DB
  console.log("\n[4/4] Saving review to database...");
  await storage.updateRacket(racket.id, {
    reviewContent: result.reviewContent,
    status: "published",
    ...(ratings ?? {}),
  } as Parameters<typeof storage.updateRacket>[1]);

  console.log("\n=== Done ===");
  console.log(`Review saved. Visit: https://racketreviewhub.com/rackets/${slug}`);

  // Print first 500 chars of the review for a quick sanity check
  console.log("\n--- Review Preview (first 500 chars) ---");
  console.log(result.reviewContent.slice(0, 500));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
