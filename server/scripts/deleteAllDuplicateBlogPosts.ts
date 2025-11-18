import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { guides, blogPosts } from "@shared/schema";
import { eq } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

// Slugs that exist in both guides and blog posts (duplicates)
const duplicateSlugs = [
  "padel-racket-buying-mistakes-to-avoid-learn-from-common-errors",
  "padel-racket-grip-replacement-guide-when-and-how-to-change-your-grip",
  "seasonal-padel-racket-guide-choosing-the-right-racket-for-different-conditions",
];

async function deleteAllDuplicateBlogPosts() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  try {
    console.log("Deleting duplicate blog posts (keeping guide versions)...\n");

    for (const slug of duplicateSlugs) {
      // Find the blog post by slug
      const post = await db
        .select()
        .from(blogPosts)
        .where(eq(blogPosts.slug, slug))
        .limit(1);

      if (post.length === 0) {
        console.log(`⚠️  No blog post found with slug: ${slug}`);
        continue;
      }

      console.log(`Found blog post: "${post[0].title}" (ID: ${post[0].id})`);
      console.log(`Deleting duplicate blog post...`);

      // Delete the blog post
      const result = await db
        .delete(blogPosts)
        .where(eq(blogPosts.slug, slug))
        .returning();

      if (result.length > 0) {
        console.log(`✓ Successfully deleted blog post: "${result[0].title}"`);
        console.log(`  The guide version at /guides/${slug} will remain active.\n`);
      } else {
        console.log(`✗ Failed to delete blog post\n`);
      }
    }

    console.log("Done! All duplicate blog posts have been removed.");
    await client.end();
  } catch (error) {
    console.error("Error deleting blog posts:", error);
    await client.end();
    process.exit(1);
  }
}

deleteAllDuplicateBlogPosts().catch(console.error);

