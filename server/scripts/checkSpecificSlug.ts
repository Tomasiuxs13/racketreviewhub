import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { guides, blogPosts } from "@shared/schema";
import { eq } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const slug = "seasonal-padel-racket-guide-choosing-the-right-racket-for-different-conditions";

async function checkSpecificSlug() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  try {
    // Check for guide
    const guide = await db
      .select()
      .from(guides)
      .where(eq(guides.slug, slug))
      .limit(1);

    // Check for blog post
    const blogPost = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);

    console.log(`Checking slug: ${slug}\n`);

    if (guide.length > 0) {
      console.log(`✓ Guide found: "${guide[0].title}" (ID: ${guide[0].id})`);
    } else {
      console.log(`✗ No guide found with this slug`);
    }

    if (blogPost.length > 0) {
      console.log(`⚠️  Blog post found: "${blogPost[0].title}" (ID: ${blogPost[0].id})`);
      console.log(`   This is a duplicate and should be deleted.`);
    } else {
      console.log(`✓ No blog post found with this slug`);
    }

    await client.end();
  } catch (error) {
    console.error("Error checking slug:", error);
    await client.end();
    process.exit(1);
  }
}

checkSpecificSlug().catch(console.error);

