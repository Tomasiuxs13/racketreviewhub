#!/usr/bin/env tsx
/**
 * Publish All Pending Rackets with Full Content Generation
 * 
 * This script processes all pending rackets (isPublished = false) and:
 * 1. Generates ratings if missing
 * 2. Fills specification fields if missing
 * 3. Generates review content
 * 4. Generates translations
 * 5. Publishes the racket
 * 
 * Usage:
 *   npx tsx server/scripts/publishAllPendingRackets.ts [options]
 * 
 * Options:
 *   --skip-ratings       Skip rating generation
 *   --skip-specs        Skip specification field generation
 *   --skip-reviews      Skip review generation
 *   --skip-translations Skip translation generation
 *   --limit <number>    Limit number of rackets to process (default: all)
 *   --start-from <n>    Start from racket number N (1-based)
 * 
 * Environment Variables:
 *   DATABASE_URL          - PostgreSQL connection string
 *   OPENAI_API_KEY        - OpenAI API key for AI generation
 */

import "dotenv/config";
import { storage } from "../storage.js";
import {
  generateRacketReview,
  estimateRacketRatings,
  translateReviewLocales,
  REVIEW_TRANSLATION_LOCALES
} from "../lib/openai.js";
import { checkPublishQualityGates } from "../lib/qualityGates.js";
import type { Racket } from "@shared/schema";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  : null;

/**
 * Fill missing specification fields using ChatGPT
 */
async function fillSpecificationFields(racket: Racket): Promise<Partial<Racket>> {
  if (!openai) {
    console.warn("OpenAI client not initialized. Skipping specification field generation.");
    return {};
  }

  // Check which fields are missing
  const missingFields: string[] = [];
  const specFields = [
    "color",
    "balance",
    "surface",
    "hardness",
    "finish",
    "core",
    "gameLevel",
    "gameType",
    "player",
  ] as const;

  for (const field of specFields) {
    if (!racket[field] || (typeof racket[field] === "string" && !racket[field].trim())) {
      missingFields.push(field);
    }
  }

  if (missingFields.length === 0) {
    return {}; // All fields already filled
  }

  try {
    const prompt = `You are a padel racket expert. Based on the following racket information, fill in the missing specification fields.

Racket Information:
- Brand: ${racket.brand}
- Model: ${racket.model}
- Year: ${racket.year}
- Shape: ${racket.shape}
${racket.color ? `- Color: ${racket.color}` : ""}
${racket.balance ? `- Balance: ${racket.balance}` : ""}
${racket.surface ? `- Surface: ${racket.surface}` : ""}
${racket.hardness ? `- Hardness: ${racket.hardness}` : ""}
${racket.finish ? `- Finish: ${racket.finish}` : ""}
${racket.core ? `- Core: ${racket.core}` : ""}
${racket.gameLevel ? `- Game Level: ${racket.gameLevel}` : ""}
${racket.gameType ? `- Game Type: ${racket.gameType}` : ""}
${racket.player ? `- Player: ${racket.player}` : ""}
${racket.currentPrice ? `- Price: €${Number(racket.currentPrice).toFixed(2)}` : ""}

Missing fields to fill: ${missingFields.join(", ")}

For each missing field, provide a reasonable value based on:
- Brand reputation and typical specifications
- Model name and characteristics
- Shape (diamond = power-oriented, round = control-oriented, teardrop = balanced)
- Price point (higher price = premium features)

Return ONLY a JSON object with these exact keys (use null for fields that cannot be determined):
{
${missingFields.map(field => `  "${field}": <string value or null>`).join(",\n")}
}

IMPORTANT: You MUST use ONLY these exact values for the following fields:
- Balance: "Low", "Mid", "Mid-High", "High" (pick exactly one)
- Hardness: "Soft", "Medium", "Hard" (pick exactly one)
- Game Level: "Beginner", "Intermediate", "Advanced", "Professional" (pick exactly one)
- Game Type: "Power", "Control", "Balance", "All-around" (pick exactly one)
- Player: "Man", "Woman", "Both" (pick exactly one)

Other fields with suggested values:
- Surface: "Smooth", "Rough", "Rough (Topspin)", "Rough (3D Grain)"
- Finish: "Glossy", "Matte", "Rough", "Smooth"
- Core: "EVA Soft", "EVA Medium", "MultiEVA", "Power Foam", "Control Foam", "High Memory"
- Color: Describe the main color(s)`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    let content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      console.warn("Failed to get specification fields from OpenAI");
      return {};
    }

    // Clean up response - remove markdown code blocks if present
    content = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const specs = JSON.parse(content) as Partial<Record<string, string | null>>;

    // Build update object, only including non-null values
    const updateData: Partial<Racket> = {};
    for (const field of missingFields) {
      const value = specs[field];
      if (value && typeof value === "string" && value.trim()) {
        updateData[field as keyof Racket] = value.trim() as any;
      }
    }

    return updateData;
  } catch (error) {
    console.error("Error filling specification fields with OpenAI:", error);
    return {};
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  skipRatings: args.includes("--skip-ratings"),
  skipSpecs: args.includes("--skip-specs"),
  skipReviews: args.includes("--skip-reviews"),
  skipTranslations: args.includes("--skip-translations"),
  skipQualityCheck: args.includes("--skip-quality-check"),
  limit: args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1], 10) : undefined,
  startFrom: args.includes("--start-from") ? parseInt(args[args.indexOf("--start-from") + 1], 10) : undefined,
};

async function publishAllPendingRackets() {
  if (!process.env.OPENAI_API_KEY && (!options.skipRatings || !options.skipSpecs || !options.skipReviews || !options.skipTranslations)) {
    console.error("❌ ERROR: OPENAI_API_KEY not set. Cannot generate content.");
    console.error("   Please set OPENAI_API_KEY in your .env file.");
    console.error("   Or use --skip-ratings, --skip-specs, --skip-reviews, --skip-translations to skip AI generation.");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("❌ ERROR: DATABASE_URL not set. Cannot access database.");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("Publish All Pending Rackets with Full Content Generation");
  console.log("=".repeat(60));
  console.log(`Options: ${JSON.stringify(options)}`);
  console.log("");

  console.log("Fetching pending rackets...");
  const pendingRackets = await storage.getPendingRackets();

  console.log(`Found ${pendingRackets.length} pending rackets\n`);

  if (pendingRackets.length === 0) {
    console.log("No pending rackets to process.");
    return;
  }

  // Apply limit if specified
  let racketsToProcess = pendingRackets;
  if (options.limit) {
    racketsToProcess = racketsToProcess.slice(0, options.limit);
    console.log(`Processing limited to ${racketsToProcess.length} rackets\n`);
  }

  // Apply start-from if specified
  if (options.startFrom) {
    const startIndex = options.startFrom - 1; // Convert to 0-based
    racketsToProcess = racketsToProcess.slice(startIndex);
    console.log(`Starting from racket ${options.startFrom}\n`);
  }

  let publishedCount = 0;
  let ratingsGeneratedCount = 0;
  let specsFilledCount = 0;
  let reviewGeneratedCount = 0;
  let translationGeneratedCount = 0;
  let skippedCount = 0;
  let qualityGateFailedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < racketsToProcess.length; i++) {
    const racket = racketsToProcess[i];
    const progress = `[${i + 1}/${racketsToProcess.length}]`;

    try {
      console.log(`${progress} 🔄 Processing ${racket.brand} ${racket.model} ${racket.year}...`);

      let updatedRacket = racket;
      const updateData: Partial<Racket> = {};

      // 1. Generate ratings for all pending rackets (they default to 75, so always regenerate)
      if (!options.skipRatings) {
        console.log(`  📊 Generating ratings...`);
        const estimatedRatings = await estimateRacketRatings({
          brand: racket.brand,
          model: racket.model,
          shape: racket.shape,
          year: racket.year,
          balance: racket.balance || undefined,
          surface: racket.surface || undefined,
          hardness: racket.hardness || undefined,
          core: racket.core || undefined,
          gameLevel: racket.gameLevel || undefined,
          gameType: racket.gameType || undefined,
          player: racket.player || undefined,
        });

        if (estimatedRatings) {
          updateData.powerRating = estimatedRatings.powerRating;
          updateData.controlRating = estimatedRatings.controlRating;
          updateData.reboundRating = estimatedRatings.reboundRating;
          updateData.maneuverabilityRating = estimatedRatings.maneuverabilityRating;
          updateData.sweetSpotRating = estimatedRatings.sweetSpotRating;
          updateData.overallRating = estimatedRatings.overallRating; // Use generated overallRating from ChatGPT

          ratingsGeneratedCount++;
          console.log(`  ✓ Ratings generated:`);
          console.log(`     Power: ${estimatedRatings.powerRating}`);
          console.log(`     Control: ${estimatedRatings.controlRating}`);
          console.log(`     Rebound: ${estimatedRatings.reboundRating}`);
          console.log(`     Maneuverability: ${estimatedRatings.maneuverabilityRating}`);
          console.log(`     Sweet Spot: ${estimatedRatings.sweetSpotRating}`);
          console.log(`     Overall: ${estimatedRatings.overallRating}`);
        } else {
          console.warn(`  ⚠️  Failed to generate ratings, using existing values`);
        }

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // 2. Fill specification fields if missing
      if (!options.skipSpecs) {
        const missingSpecs = !racket.color || !racket.balance || !racket.surface ||
          !racket.hardness || !racket.finish || !racket.core ||
          !racket.gameLevel || !racket.gameType || !racket.player;

        if (missingSpecs) {
          console.log(`  📋 Filling specification fields...`);
          const specData = await fillSpecificationFields(racket);

          if (Object.keys(specData).length > 0) {
            Object.assign(updateData, specData);
            specsFilledCount++;
            console.log(`  ✓ Filled ${Object.keys(specData).length} specification fields: ${Object.keys(specData).join(", ")}`);
          } else {
            console.warn(`  ⚠️  No specification fields could be generated`);
          }

          // Small delay to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Update racket with ratings and specs if generated (before review generation)
      if (Object.keys(updateData).length > 0) {
        const tempUpdated = await storage.updateRacket(racket.id, updateData);
        if (!tempUpdated) {
          console.error(`${progress} ❌ Failed to update racket with ratings/specifications`);
          errorCount++;
          continue;
        }
        updatedRacket = tempUpdated;
        // Keep ratings in updateData for final publish (don't clear them)
        // Only clear non-rating, non-spec fields that we'll regenerate
        const ratingsAndSpecs = [
          'powerRating', 'controlRating', 'reboundRating',
          'maneuverabilityRating', 'sweetSpotRating', 'overallRating',
          'color', 'balance', 'surface', 'hardness', 'finish',
          'core', 'gameLevel', 'gameType', 'player'
        ];
        // Remove only fields that are not ratings or specs
        Object.keys(updateData).forEach(key => {
          if (!ratingsAndSpecs.includes(key)) {
            delete updateData[key as keyof Racket];
          }
        });
      } else {
        updatedRacket = racket;
      }

      // 3. Generate review if missing
      let reviewContent = updatedRacket.reviewContent;
      if (!reviewContent && !options.skipReviews) {
        console.log(`  📝 Generating review...`);
        const reviewResult = await generateRacketReview(updatedRacket, {
          skipTranslations: options.skipTranslations, // Skip translations during review gen if flag is set
        });

        if (reviewResult && reviewResult.reviewContent) {
          reviewContent = reviewResult.reviewContent;
          updateData.reviewContent = reviewContent;
          reviewGeneratedCount++;
          console.log(`  ✓ Review generated (${reviewContent.length} chars)`);
        } else {
          console.warn(`  ⚠️  Failed to generate review, continuing without it`);
        }

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // 4. Generate translations if not skipped
      if (!options.skipTranslations && reviewContent) {
        console.log(`  🌐 Generating translations...`);
        try {
          const locales = REVIEW_TRANSLATION_LOCALES;
          if (locales.length > 0) {
            await translateReviewLocales(updatedRacket, locales, reviewContent);
            translationGeneratedCount++;
            console.log(`  ✓ Translations generated for: ${locales.join(", ")}`);
          }
        } catch (translationError) {
          console.warn(`  ⚠️  Translation generation failed:`, translationError);
          // Continue anyway
        }

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // 5. Quality gate check before publishing
      if (!options.skipQualityCheck) {
        // Build a merged view of the racket with pending updates for quality check
        const racketForCheck = { ...updatedRacket, ...updateData, reviewContent: reviewContent || updatedRacket.reviewContent } as Racket;
        const qualityResult = checkPublishQualityGates(racketForCheck);
        if (!qualityResult.passes) {
          console.warn(`${progress} ⚠️  Quality gate FAILED for ${racket.brand} ${racket.model} ${racket.year}:`);
          qualityResult.failures.forEach(f => console.warn(`     - ${f}`));
          console.warn(`     Skipping publish. Use --skip-quality-check to override.`);
          // Still save generated content (ratings, specs, review) but don't publish
          if (Object.keys(updateData).length > 0) {
            await storage.updateRacket(racket.id, updateData);
          }
          qualityGateFailedCount++;
          continue;
        }
      }

      // 6. Publish the racket
      updateData.isPublished = true;

      const finalRacket = await storage.updateRacket(racket.id, updateData);

      if (!finalRacket) {
        console.error(`${progress} ❌ Failed to publish racket ${racket.brand} ${racket.model}`);
        errorCount++;
        continue;
      }

      publishedCount++;
      console.log(`${progress} ✓ Published ${racket.brand} ${racket.model} ${racket.year}`);

      // Add delay between rackets to avoid overwhelming the API
      if (i < racketsToProcess.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error: any) {
      // Check if it's an API key error
      if (error?.code === "invalid_api_key" || error?.status === 401) {
        console.error(`\n${progress} ❌ API KEY ERROR: Invalid or expired OpenAI API key`);
        console.error(`   Please check your OPENAI_API_KEY in .env file`);
        console.error(`   Error: ${error?.message || error?.error?.message || "Invalid API key"}`);
        console.error(`\n   Script stopped at racket ${i + 1}. To resume, run:`);
        console.error(`   npx tsx server/scripts/publishAllPendingRackets.ts --start-from ${i + 1}\n`);
        errorCount++;
        break; // Stop on API key errors
      } else {
        console.error(`${progress} ❌ Error processing ${racket.brand} ${racket.model}:`, error?.message || error);
        errorCount++;
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Summary:");
  console.log(`  ✓ Published: ${publishedCount}`);
  console.log(`  📊 Ratings generated: ${ratingsGeneratedCount}`);
  console.log(`  📋 Specifications filled: ${specsFilledCount}`);
  console.log(`  📝 Reviews generated: ${reviewGeneratedCount}`);
  console.log(`  🌐 Translations generated: ${translationGeneratedCount}`);
  console.log(`  ⚠️  Quality gate failed: ${qualityGateFailedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  Total processed: ${racketsToProcess.length}`);
  console.log("=".repeat(60));
}

publishAllPendingRackets().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

