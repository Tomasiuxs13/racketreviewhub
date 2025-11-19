import "dotenv/config";
import { storage } from "../storage.js";
import {
  REVIEW_TRANSLATION_LOCALES,
  isOpenAIConfigured,
  translateReviewLocales,
} from "../lib/openai.js";

type Locale = string;

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const localesArg = getArgValue("--locales");
const startAfter = getArgValue("--start-after");
const limitArg = getArgValue("--limit");
const limit = limitArg ? Number(limitArg) : undefined;

const locales: Locale[] = localesArg
  ? localesArg
      .split(",")
      .map((locale) => locale.trim().toLowerCase())
      .filter((locale) => locale && locale !== "en")
  : REVIEW_TRANSLATION_LOCALES;

function getArgValue(flag: string) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

async function main() {
  if (!isDryRun && !isOpenAIConfigured) {
    throw new Error("OPENAI_API_KEY is required to translate reviews.");
  }

  if (!locales.length) {
    console.warn("[reviews] No target locales provided. Nothing to do.");
    return;
  }

  const rackets = await storage.getAllRackets();
  let queue = rackets.filter((racket) => Boolean(racket.reviewContent));

  if (startAfter) {
    const startIndex = queue.findIndex((racket) => racket.id === startAfter);
    if (startIndex >= 0) {
      queue = queue.slice(startIndex + 1);
    }
  }

  if (limit && Number.isFinite(limit) && limit > 0) {
    queue = queue.slice(0, limit);
  }

  console.log(
    `[reviews] Processing ${queue.length} racket(s) for locales: ${locales.join(", ")}`,
  );

  const startTime = Date.now();
  let processed = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const racket of queue) {
    processed++;
    const progress = ((processed / queue.length) * 100).toFixed(1);
    console.log(
      `[reviews] [${progress}%] (${processed}/${queue.length}) ${racket.brand} ${racket.model} - ${racket.id}`,
    );

    if (isDryRun) {
      continue;
    }

    try {
      const translations = await translateReviewLocales(racket, locales);
      const translatedLocales = Object.keys(translations);
      if (translatedLocales.length > 0) {
        successCount++;
        console.log(
          `[reviews] ✓ Stored ${translatedLocales.length} locale(s): ${translatedLocales.join(", ")}`,
        );
      } else {
        console.log("[reviews] ⚠ No translations stored (may already exist)");
      }
    } catch (error) {
      errorCount++;
      console.error(`[reviews] ✗ Failed to translate review for ${racket.brand} ${racket.model}:`, error instanceof Error ? error.message : error);
      // Continue processing other rackets
    }

    // Log progress every 10 items
    if (processed % 10 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const avgTime = (Date.now() - startTime) / processed;
      const remaining = ((queue.length - processed) * avgTime / 1000).toFixed(0);
      console.log(
        `[reviews] Progress: ${processed}/${queue.length} | Success: ${successCount} | Errors: ${errorCount} | Elapsed: ${elapsed}s | Est. remaining: ${remaining}s`,
      );
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log("\n[reviews] ========================================");
  console.log(`[reviews] Translation complete!`);
  console.log(`[reviews] Total processed: ${processed}`);
  console.log(`[reviews] Successful: ${successCount}`);
  console.log(`[reviews] Errors: ${errorCount}`);
  console.log(`[reviews] Total time: ${totalTime}s`);
  console.log(`[reviews] ========================================\n`);
}

main().catch((error) => {
  console.error("[reviews] Script failed:", error);
  process.exitCode = 1;
});


