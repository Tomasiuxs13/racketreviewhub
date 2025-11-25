import "dotenv/config";
import { storage } from "../storage.js";
import { isOpenAIConfigured, translateTextBatch } from "../lib/openai.js";
import { upsertTranslation } from "../lib/i18n.js";
import type { BlogPost } from "@shared/schema";

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

async function translateBlogPost(post: BlogPost, targetLocale: string): Promise<boolean> {
  const fields: Record<string, string> = {};
  
  // Translate title and excerpt together (small)
  const smallItems = [
    {
      key: "title",
      text: post.title,
      context: "Blog post title - keep it engaging and SEO-friendly",
    },
    {
      key: "excerpt",
      text: post.excerpt,
      context: "Short description/excerpt for the blog post",
    },
  ].filter((item) => item.text && item.text.trim().length > 0);

  if (smallItems.length > 0) {
    try {
      const smallTranslations = await translateTextBatch(smallItems, targetLocale);
      if (smallTranslations.title) fields.title = smallTranslations.title;
      if (smallTranslations.excerpt) fields.excerpt = smallTranslations.excerpt;
    } catch (error) {
      console.error(`Failed to translate title/excerpt:`, error);
    }
  }

  // Translate content separately in chunks if it's large
  if (post.content && post.content.trim().length > 0) {
    try {
      const contentChunks = chunkContent(post.content, 3000); // Split into ~3000 char chunks
      const translatedChunks: string[] = [];

      for (let i = 0; i < contentChunks.length; i++) {
        const chunk = contentChunks[i];
        const chunkItems = [{
          key: `content_chunk_${i}`,
          text: chunk,
          context: i === 0 
            ? "First part of full HTML blog post content - preserve all HTML tags and structure"
            : `Continuation part ${i + 1} of full HTML blog post content - preserve all HTML tags and structure`,
        }];

        const chunkTranslations = await translateTextBatch(chunkItems, targetLocale);
        const translatedChunk = chunkTranslations[`content_chunk_${i}`];
        if (translatedChunk) {
          translatedChunks.push(translatedChunk);
        } else {
          // Fallback to original if translation fails
          translatedChunks.push(chunk);
        }
      }

      if (translatedChunks.length > 0) {
        fields.content = translatedChunks.join("\n");
      }
    } catch (error) {
      console.error(`Failed to translate content:`, error);
    }
  }

  if (Object.keys(fields).length > 0) {
    await upsertTranslation("blog_post", post.id, targetLocale, fields);
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
    throw new Error("OPENAI_API_KEY is required to translate blog posts.");
  }

  if (!locales.length) {
    console.warn("[blog] No target locales provided. Nothing to do.");
    return;
  }

  const posts = await storage.getAllBlogPosts();
  let queue = posts.filter((post) => Boolean(post.title && post.content));

  if (startAfter) {
    const startIndex = queue.findIndex((post) => post.id === startAfter);
    if (startIndex >= 0) {
      queue = queue.slice(startIndex + 1);
    }
  }

  if (limit && Number.isFinite(limit) && limit > 0) {
    queue = queue.slice(0, limit);
  }

  console.log(
    `[blog] Processing ${queue.length} blog post(s) for locales: ${locales.join(", ")}`,
  );

  const startTime = Date.now();
  let processed = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const post of queue) {
    processed++;
    const progress = ((processed / queue.length) * 100).toFixed(1);
    console.log(
      `[blog] [${progress}%] (${processed}/${queue.length}) ${post.title} - ${post.id}`,
    );

    if (isDryRun) {
      continue;
    }

    for (const locale of locales) {
      try {
        const translated = await translateBlogPost(post, locale);
        if (translated) {
          successCount++;
          console.log(`[blog] ✓ Stored translation for locale: ${locale}`);
        } else {
          console.log(`[blog] ⚠ No translation stored for locale: ${locale} (may already exist or empty content)`);
        }
      } catch (error) {
        errorCount++;
        console.error(`[blog] ✗ Failed to translate blog post "${post.title}" for locale ${locale}:`, error instanceof Error ? error.message : error);
      }
    }

    // Log progress every 5 items
    if (processed % 5 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const avgTime = (Date.now() - startTime) / processed;
      const remaining = ((queue.length - processed) * avgTime / 1000).toFixed(0);
      console.log(
        `[blog] Progress: ${processed}/${queue.length} | Success: ${successCount} | Errors: ${errorCount} | Elapsed: ${elapsed}s | Est. remaining: ${remaining}s`,
      );
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log("\n[blog] ========================================");
  console.log(`[blog] Translation complete!`);
  console.log(`[blog] Total processed: ${processed}`);
  console.log(`[blog] Successful translations: ${successCount}`);
  console.log(`[blog] Errors: ${errorCount}`);
  console.log(`[blog] Total time: ${totalTime}s`);
  console.log(`[blog] ========================================\n`);
}

main().catch((error) => {
  console.error("[blog] Script failed:", error);
  process.exitCode = 1;
});

