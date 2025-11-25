import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { blogPosts } from "@shared/schema";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

async function listAllBlogPosts() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  try {
    const allPosts = await db.select().from(blogPosts).orderBy(blogPosts.title);

    console.log(`Total blog posts in database: ${allPosts.length}\n`);
    console.log("All blog posts:\n");

    allPosts.forEach((post, index) => {
      console.log(`${index + 1}. "${post.title}"`);
      console.log(`   Slug: ${post.slug}`);
      console.log(`   ID: ${post.id}`);
      console.log();
    });

    // Check specifically for seasonal
    const seasonalPosts = allPosts.filter(p => 
      p.slug.includes("seasonal") || p.title.toLowerCase().includes("seasonal")
    );

    if (seasonalPosts.length > 0) {
      console.log("\n⚠️  Found blog posts related to 'seasonal':");
      seasonalPosts.forEach(post => {
        console.log(`   - "${post.title}" (${post.slug})`);
      });
    }

    await client.end();
  } catch (error) {
    console.error("Error listing blog posts:", error);
    await client.end();
    process.exit(1);
  }
}

listAllBlogPosts().catch(console.error);

