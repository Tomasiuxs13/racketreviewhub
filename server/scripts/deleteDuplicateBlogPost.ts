import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { blogPosts } from "@shared/schema";
import { eq } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const slug = "when-to-replace-your-padel-racket-signs-it-s-time-for-an-upgrade";

async function deleteDuplicateBlogPost() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  try {
    // Find the blog post by slug
    const post = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);

    if (post.length === 0) {
      console.log(`No blog post found with slug: ${slug}`);
      await client.end();
      return;
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
      console.log(`  The guide version at /guides/${slug} will remain active.`);
    } else {
      console.log(`✗ Failed to delete blog post`);
    }

    await client.end();
  } catch (error) {
    console.error("Error deleting blog post:", error);
    await client.end();
    process.exit(1);
  }
}

deleteDuplicateBlogPost().catch(console.error);

