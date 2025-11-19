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

  let processed = 0;
  for (const racket of queue) {
    processed++;
    console.log(
      `[reviews] (${processed}/${queue.length}) ${racket.brand} ${racket.model} - ${racket.id}`,
    );

    if (isDryRun) {
      continue;
    }

    try {
      const translations = await translateReviewLocales(racket, locales);
      const translatedLocales = Object.keys(translations);
      console.log(
        translatedLocales.length
          ? `[reviews] ✓ Stored locales: ${translatedLocales.join(", ")}`
          : "[reviews] ⚠ No translations stored",
      );
    } catch (error) {
      console.error("[reviews] Failed to translate review:", error);
    }
  }
}

main().catch((error) => {
  console.error("[reviews] Script failed:", error);
  process.exitCode = 1;
});


