import "dotenv/config";
import { storage } from "../storage.js";
import { isOpenAIConfigured, translateTextBatch } from "../lib/openai.js";
import { upsertTranslation } from "../lib/i18n.js";
import type { Brand } from "@shared/schema";

type Locale = string;

const DEFAULT_LOCALES: Locale[] = ["es", "pt", "it", "fr"];

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
  : DEFAULT_LOCALES;

function getArgValue(flag: string) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

async function translateBrand(brand: Brand, targetLocale: string): Promise<boolean> {
  const fields: Record<string, string> = {};
  
  // Translate description (usually small)
  if (brand.description && brand.description.trim().length > 0) {
    try {
      const descItems = [{
        key: "description",
        text: brand.description,
        context: "Brand description - keep it concise and informative",
      }];
      const descTranslations = await translateTextBatch(descItems, targetLocale);
      if (descTranslations.description) {
        fields.description = descTranslations.description;
      }
    } catch (error) {
      console.error(`Failed to translate description:`, error);
    }
  }

  // Translate articleContent separately in chunks if it's large
  if (brand.articleContent && brand.articleContent.trim().length > 0) {
    try {
      const contentChunks = chunkContent(brand.articleContent, 3000); // Split into ~3000 char chunks
      const translatedChunks: string[] = [];

      for (let i = 0; i < contentChunks.length; i++) {
        const chunk = contentChunks[i];
        const chunkItems = [{
          key: `articleContent_chunk_${i}`,
          text: chunk,
          context: i === 0 
            ? "First part of full HTML brand article content - preserve all HTML tags and structure"
            : `Continuation part ${i + 1} of full HTML brand article content - preserve all HTML tags and structure`,
        }];

        const chunkTranslations = await translateTextBatch(chunkItems, targetLocale);
        const translatedChunk = chunkTranslations[`articleContent_chunk_${i}`];
        if (translatedChunk) {
          translatedChunks.push(translatedChunk);
        } else {
          // Fallback to original if translation fails
          translatedChunks.push(chunk);
        }
      }

      if (translatedChunks.length > 0) {
        fields.articleContent = translatedChunks.join("\n");
      }
    } catch (error) {
      console.error(`Failed to translate articleContent:`, error);
    }
  }

  if (Object.keys(fields).length > 0) {
    await upsertTranslation("brand", brand.id, targetLocale, fields);
    return true;
  }

  return false;
}

function chunkContent(content: string, maxChunkSize: number): string[] {
  if (content.length <= maxChunkSize) {
    return [content];
  }

  const chunks: string[] = [];
  let currentChunk = "";
  
  // Split by HTML tags to avoid breaking them
  const parts = content.split(/(<[^>]+>)/);
  
  for (const part of parts) {
    if (currentChunk.length + part.length <= maxChunkSize) {
      currentChunk += part;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = part;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

async function main() {
  if (!isDryRun && !isOpenAIConfigured) {
    throw new Error("OPENAI_API_KEY is required to translate brands.");
  }

  if (!locales.length) {
    console.warn("[brands] No target locales provided. Nothing to do.");
    return;
  }

  const brands = await storage.getAllBrands();
  let queue = brands.filter((brand) => Boolean(brand.description || brand.articleContent));

  if (startAfter) {
    const startIndex = queue.findIndex((brand) => brand.id === startAfter);
    if (startIndex >= 0) {
      queue = queue.slice(startIndex + 1);
    }
  }

  if (limit && Number.isFinite(limit) && limit > 0) {
    queue = queue.slice(0, limit);
  }

  console.log(
    `[brands] Processing ${queue.length} brand(s) for locales: ${locales.join(", ")}`,
  );

  const startTime = Date.now();
  let processed = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const brand of queue) {
    processed++;
    const progress = ((processed / queue.length) * 100).toFixed(1);
    console.log(
      `[brands] [${progress}%] (${processed}/${queue.length}) ${brand.name} - ${brand.id}`,
    );

    if (isDryRun) {
      continue;
    }

    for (const locale of locales) {
      try {
        const translated = await translateBrand(brand, locale);
        if (translated) {
          successCount++;
          console.log(`[brands] ✓ Stored translation for locale: ${locale}`);
        } else {
          console.log(`[brands] ⚠ No translation stored for locale: ${locale} (may already exist or empty content)`);
        }
      } catch (error) {
        errorCount++;
        console.error(`[brands] ✗ Failed to translate brand "${brand.name}" for locale ${locale}:`, error instanceof Error ? error.message : error);
      }
    }

    // Log progress every 5 items
    if (processed % 5 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const avgTime = (Date.now() - startTime) / processed;
      const remaining = ((queue.length - processed) * avgTime / 1000).toFixed(0);
      console.log(
        `[brands] Progress: ${processed}/${queue.length} | Success: ${successCount} | Errors: ${errorCount} | Elapsed: ${elapsed}s | Est. remaining: ${remaining}s`,
      );
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log("\n[brands] ========================================");
  console.log(`[brands] Translation complete!`);
  console.log(`[brands] Total processed: ${processed}`);
  console.log(`[brands] Successful translations: ${successCount}`);
  console.log(`[brands] Errors: ${errorCount}`);
  console.log(`[brands] Total time: ${totalTime}s`);
  console.log(`[brands] ========================================\n`);
}

main().catch((error) => {
  console.error("[brands] Script failed:", error);
  process.exitCode = 1;
});

