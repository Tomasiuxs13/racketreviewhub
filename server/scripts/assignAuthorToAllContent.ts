import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, isNull, or } from "drizzle-orm";
import { blogPosts, rackets, authors } from "@shared/schema";

const authorSlug = "carlos-rodriguez";

async function assignAuthorToAllContent() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client);

  try {
    // Get Carlos Rodriguez's ID
    const authorResult = await db
      .select()
      .from(authors)
      .where(eq(authors.slug, authorSlug))
      .limit(1);

    if (authorResult.length === 0) {
      console.error(`Author with slug "${authorSlug}" not found`);
      await client.end();
      process.exit(1);
    }

    const authorId = authorResult[0].id;
    const authorName = authorResult[0].name;
    console.log(`Found author: ${authorName} (ID: ${authorId})\n`);

    // Update all blog posts to have Carlos Rodriguez's authorId
    // Update posts with null authorId OR "Padel Racket Reviews" as author
    const blogPostsResult = await db
      .update(blogPosts)
      .set({
        authorId: authorId,
        author: authorName, // Also update author name to match
      })
      .where(
        or(
          isNull(blogPosts.authorId),
          eq(blogPosts.author, "Padel Racket Reviews")
        )
      )
      .returning();

    console.log(`✓ Updated ${blogPostsResult.length} blog post(s) with authorId`);

    // Update all rackets to have Carlos Rodriguez's authorId
    const racketsResult = await db
      .update(rackets)
      .set({
        authorId: authorId,
      })
      .where(isNull(rackets.authorId))
      .returning();

    console.log(`✓ Updated ${racketsResult.length} racket(s) with authorId`);

    console.log("\n✅ Successfully assigned Carlos Rodriguez as author to all content!");
  } catch (error) {
    console.error("Error assigning author:", error);
    throw error;
  } finally {
    await client.end();
  }
}

assignAuthorToAllContent().catch(console.error);

