import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { blogPosts } from "@shared/schema";
import { eq, like } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

async function deleteSeasonalBlogPost() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  try {
    // Search for any blog posts with "seasonal" in the slug or title
    const posts = await db
      .select()
      .from(blogPosts)
      .where(
        like(blogPosts.slug, "%seasonal%")
      );

    console.log(`Found ${posts.length} blog post(s) with "seasonal" in slug:\n`);

    if (posts.length === 0) {
      console.log("✓ No blog posts found with 'seasonal' in the slug.");
      console.log("The blog post has already been deleted or doesn't exist.");
    } else {
      for (const post of posts) {
        console.log(`Found: "${post.title}"`);
        console.log(`  Slug: ${post.slug}`);
        console.log(`  ID: ${post.id}`);
        console.log(`Deleting...`);

        const result = await db
          .delete(blogPosts)
          .where(eq(blogPosts.id, post.id))
          .returning();

        if (result.length > 0) {
          console.log(`✓ Successfully deleted: "${result[0].title}"\n`);
        }
      }
    }

    // Also try the exact slug
    const exactSlug = "seasonal-padel-racket-guide-choosing-the-right-racket-for-different-conditions";
    const exactPost = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, exactSlug))
      .limit(1);

    if (exactPost.length > 0) {
      console.log(`\nFound blog post with exact slug: ${exactSlug}`);
      console.log(`Deleting...`);
      await db
        .delete(blogPosts)
        .where(eq(blogPosts.slug, exactSlug));
      console.log(`✓ Deleted`);
    } else {
      console.log(`\n✓ No blog post found with exact slug: ${exactSlug}`);
    }

    await client.end();
    console.log("\nDone!");
  } catch (error) {
    console.error("Error:", error);
    await client.end();
    process.exit(1);
  }
}

deleteSeasonalBlogPost().catch(console.error);

