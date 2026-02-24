import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { blogPosts } from "../../shared/schema";
import { translateTextBatch } from "../lib/openai";
import { upsertTranslation } from "../lib/i18n";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgresql://racketreviewhub_db_user:C4aYY4VPvxBdmqpmBCMpvCPPYKtG736h@dpg-d4nbqt7gi27c738g4c8g-a.frankfurt-postgres.render.com/racketreviewhub_db";
const client = postgres(connectionString, { ssl: "require" });
const db = drizzle(client);

async function translateContent(content: string, locale: string): Promise<string> {
    // Split content by <h2> tags to keep batches manageable
    const sections = content.split(/(?=<h2>)/i).filter(Boolean);
    const translatedSections: string[] = [];

    console.log(`Translating ${sections.length} sections for locale: ${locale}...`);

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        console.log(`  Processing section ${i + 1}/${sections.length} (${section.length} chars)...`);

        const batch = [{
            key: `section_${i}`,
            text: section,
            context: "Padel article section. Preserve all HTML tags and strictly keep brand/model names in English."
        }];

        try {
            const result = await translateTextBatch(batch, locale);
            translatedSections.push(result[`section_${i}`]);
        } catch (error) {
            console.error(`  Error translating section ${i}:`, error);
            translatedSections.push(section); // Fallback to original
        }
    }

    return translatedSections.join("");
}

async function main() {
    const slug = "best-padel-rackets-2026";
    const targetLocales = ["es", "pt", "it", "fr"];

    try {
        const post = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
        if (post.length === 0) {
            console.error("Article not found!");
            process.exit(1);
        }

        const original = post[0];

        for (const locale of targetLocales) {
            console.log(`\n--- Starting translation for ${locale.toUpperCase()} ---`);

            // Translate title and excerpt together
            const metaBatch = [
                { key: "title", text: original.title, context: "Article title" },
                { key: "excerpt", text: original.excerpt, context: "Article excerpt/summary" }
            ];

            console.log("Translating metadata...");
            const metaResult = await translateTextBatch(metaBatch, locale);

            console.log("Translating content...");
            const translatedContent = await translateContent(original.content, locale);

            await upsertTranslation("blog_post", original.id, locale, {
                title: metaResult.title,
                excerpt: metaResult.excerpt,
                content: translatedContent
            });

            console.log(`Success! ${locale.toUpperCase()} translation stored.`);
        }

        console.log("\nAll translations complete!");
    } catch (error) {
        console.error("Translation failed:", error);
    } finally {
        process.exit(0);
    }
}

main();
