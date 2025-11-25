import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { blogPosts } from "@shared/schema";
import { eq, like } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

async function deleteRacketShapeTechniqueBlogPost() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  try {
    // Search for blog posts with "racket shape" or "technique" in title/slug
    const posts = await db
      .select()
      .from(blogPosts)
      .where(
        like(blogPosts.slug, "%racket-shape%")
      );

    console.log(`Searching for blog posts about racket shape...\n`);

    if (posts.length === 0) {
      console.log("✓ No blog posts found with 'racket-shape' in the slug.");
    } else {
      for (const post of posts) {
        console.log(`Found: "${post.title}"`);
        console.log(`  Slug: ${post.slug}`);
        console.log(`  ID: ${post.id}`);
        
        // Check if it's the one we want to delete
        if (post.title.includes("How Your Racket Shape Affects Your Playing Technique") || 
            post.slug.includes("racket-shape-affects-technique")) {
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
    }

    // Also try the exact slug
    const exactSlug = "how-your-racket-shape-affects-your-playing-technique";
    const exactPost = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, exactSlug))
      .limit(1);

    if (exactPost.length > 0) {
      console.log(`\nFound blog post with exact slug: ${exactSlug}`);
      console.log(`Title: "${exactPost[0].title}"`);
      console.log(`Deleting...`);
      const result = await db
        .delete(blogPosts)
        .where(eq(blogPosts.slug, exactSlug))
        .returning();
      
      if (result.length > 0) {
        console.log(`✓ Successfully deleted: "${result[0].title}"`);
      }
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

deleteRacketShapeTechniqueBlogPost().catch(console.error);

