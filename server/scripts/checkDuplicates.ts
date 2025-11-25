import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { guides, blogPosts } from "@shared/schema";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate slug from title (same as in loadGuides.ts and loadBlogPosts.ts)
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Extract title from markdown
function extractTitle(markdown: string): string {
  const match = markdown.match(/^# (.+)$/m);
  return match ? match[1].trim() : "Untitled";
}

async function checkDuplicates() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client);

  try {
    // Get all guides and blog posts from database
    const allGuides = await db.select().from(guides);
    const allBlogPosts = await db.select().from(blogPosts);

    console.log("Checking for duplicates between guides and blog posts...\n");

    // Create maps of slugs to titles
    const guideSlugs = new Map<string, { id: string; title: string }>();
    const blogSlugs = new Map<string, { id: string; title: string }>();

    allGuides.forEach((guide) => {
      guideSlugs.set(guide.slug, { id: guide.id, title: guide.title });
    });

    allBlogPosts.forEach((post) => {
      blogSlugs.set(post.slug, { id: post.id, title: post.title });
    });

    // Check for exact slug matches
    const duplicateSlugs: Array<{ slug: string; guide: { id: string; title: string }; blog: { id: string; title: string } }> = [];

    for (const [slug, guide] of guideSlugs.entries()) {
      if (blogSlugs.has(slug)) {
        duplicateSlugs.push({
          slug,
          guide,
          blog: blogSlugs.get(slug)!,
        });
      }
    }

    if (duplicateSlugs.length > 0) {
      console.log("⚠️  Found duplicate slugs:\n");
      duplicateSlugs.forEach((dup) => {
        console.log(`Slug: ${dup.slug}`);
        console.log(`  Guide: "${dup.guide.title}" (ID: ${dup.guide.id})`);
        console.log(`  Blog:  "${dup.blog.title}" (ID: ${dup.blog.id})`);
        console.log();
      });
    } else {
      console.log("✓ No duplicate slugs found\n");
    }

    // Check for similar titles (fuzzy matching)
    console.log("Checking for similar titles...\n");
    const similarTitles: Array<{ guide: { id: string; title: string; slug: string }; blog: { id: string; title: string; slug: string } }> = [];

    for (const guide of allGuides) {
      const guideTitleLower = guide.title.toLowerCase();
      for (const post of allBlogPosts) {
        const postTitleLower = post.title.toLowerCase();
        
        // Check if titles are very similar (contain many of the same words)
        const guideWords = new Set(guideTitleLower.split(/\s+/).filter(w => w.length > 3));
        const postWords = new Set(postTitleLower.split(/\s+/).filter(w => w.length > 3));
        
        const commonWords = [...guideWords].filter(w => postWords.has(w));
        const similarity = commonWords.length / Math.max(guideWords.size, postWords.size);
        
        // If more than 50% of words match and they're not already in duplicateSlugs
        if (similarity > 0.5 && guide.slug !== post.slug) {
          similarTitles.push({
            guide: { id: guide.id, title: guide.title, slug: guide.slug },
            blog: { id: post.id, title: post.title, slug: post.slug },
          });
        }
      }
    }

    if (similarTitles.length > 0) {
      console.log("⚠️  Found similar titles (potential duplicates):\n");
      similarTitles.forEach((pair) => {
        console.log(`Guide: "${pair.guide.title}" (${pair.guide.slug})`);
        console.log(`Blog:  "${pair.blog.title}" (${pair.blog.slug})`);
        console.log();
      });
    } else {
      console.log("✓ No similar titles found\n");
    }

    // Summary
    console.log("\n--- Summary ---");
    console.log(`Total guides: ${allGuides.length}`);
    console.log(`Total blog posts: ${allBlogPosts.length}`);
    console.log(`Duplicate slugs: ${duplicateSlugs.length}`);
    console.log(`Similar titles: ${similarTitles.length}`);

    if (duplicateSlugs.length > 0 || similarTitles.length > 0) {
      console.log("\n⚠️  Action needed: Remove duplicate blog posts to keep only guide versions");
    } else {
      console.log("\n✓ No duplicates found!");
    }

    await client.end();
  } catch (error) {
    console.error("Error checking duplicates:", error);
    await client.end();
    process.exit(1);
  }
}

checkDuplicates().catch(console.error);

