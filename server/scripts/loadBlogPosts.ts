import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { InsertBlogPost } from "@shared/schema";

// Import storage - will use SupabaseStorage if DATABASE_URL is set
let storage: Awaited<typeof import("../storage.js").storage>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple markdown to HTML converter
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Remove the first # heading (title) since it's displayed separately in the page header
  html = html.replace(/^# (.+)$/m, "");

  // Convert headers
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");

  // Convert bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Convert italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Convert links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Convert bullet lists
  html = html.replace(/^\- (.*$)/gim, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");

  // Convert numbered lists
  html = html.replace(/^\d+\. (.*$)/gim, "<li>$1</li>");

  // Convert paragraphs (lines that aren't headers, lists, or empty)
  const lines = html.split("\n");
  const processedLines: string[] = [];
  let currentParagraph: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentParagraph.length > 0) {
        processedLines.push(`<p>${currentParagraph.join(" ")}</p>`);
        currentParagraph = [];
      }
      continue;
    }

    // If it's already HTML (header, list item, etc.), add it directly
    if (
      trimmed.startsWith("<h") ||
      trimmed.startsWith("<ul") ||
      trimmed.startsWith("</ul") ||
      trimmed.startsWith("<li") ||
      trimmed.startsWith("</li") ||
      trimmed.startsWith("<p") ||
      trimmed.startsWith("</p")
    ) {
      if (currentParagraph.length > 0) {
        processedLines.push(`<p>${currentParagraph.join(" ")}</p>`);
        currentParagraph = [];
      }
      processedLines.push(trimmed);
    } else {
      currentParagraph.push(trimmed);
    }
  }

  if (currentParagraph.length > 0) {
    processedLines.push(`<p>${currentParagraph.join(" ")}</p>`);
  }

  return processedLines.join("\n");
}

// Extract title from markdown (first # heading)
function extractTitle(markdown: string): string {
  const match = markdown.match(/^# (.+)$/m);
  return match ? match[1].trim() : "Untitled Blog Post";
}

// Generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Extract excerpt (first paragraph or first 160 characters)
function extractExcerpt(markdown: string): string {
  // Remove the first # heading
  const withoutTitle = markdown.replace(/^# .+$/m, "").trim();
  
  // Get first paragraph (text until double newline or first 160 chars)
  const firstParagraph = withoutTitle.split("\n\n")[0] || withoutTitle.split("\n")[0] || "";
  const excerpt = firstParagraph.substring(0, 160).trim();
  
  // Remove markdown formatting for excerpt
  return excerpt
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

// Extract author from markdown (look for "Author:" in metadata or default)
function extractAuthor(markdown: string, filename: string): string {
  // Check for Author: in metadata section (if present)
  const authorMatch = markdown.match(/Author:\s*(.+)/i);
  if (authorMatch) {
    return authorMatch[1].trim();
  }
  
  // Default author
  return "Padel Racket Reviews";
}

async function loadBlogPosts() {
  // Import storage dynamically to ensure it uses the right implementation
  const storageModule = await import("../storage.js");
  storage = storageModule.storage;

  if (!process.env.DATABASE_URL) {
    console.warn("⚠️  WARNING: DATABASE_URL not set. Using in-memory storage.");
    console.warn("   Blog posts will be lost when the server restarts.");
    console.warn("   Set DATABASE_URL to use Supabase for persistent storage.\n");
  } else {
    console.log("✓ Using SupabaseStorage (persistent storage)\n");
  }

  const dataDir = path.resolve(__dirname, "../data");
  const files = fs.readdirSync(dataDir).filter((file) => 
    file.endsWith(".md") && 
    file.startsWith("blog-") &&
    !file.includes("template") // Skip template files
  );

  console.log(`Found ${files.length} blog post markdown files`);

  for (const file of files) {
    try {
      const filePath = path.join(dataDir, file);
      const markdown = fs.readFileSync(filePath, "utf-8");

      const title = extractTitle(markdown);
      const slug = generateSlug(title);
      const excerpt = extractExcerpt(markdown);
      const author = extractAuthor(markdown, file);
      const content = markdownToHtml(markdown);

      // Check if blog post already exists
      const existing = await storage.getBlogPost(slug);
      if (existing) {
        console.log(`Blog post "${title}" already exists, updating...`);
        // Delete existing post to recreate with updated content
        // Note: This requires a delete method, so we'll use a workaround
        // For SupabaseStorage, we can use direct database access
        if (process.env.DATABASE_URL) {
          // Import drizzle directly for update
          const { drizzle } = await import("drizzle-orm/postgres-js");
          const postgres = (await import("postgres")).default;
          const { blogPosts } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");
          
          const client = postgres(process.env.DATABASE_URL);
          const db = drizzle(client);
          
          await db
            .update(blogPosts)
            .set({
              title,
              excerpt,
              content,
              author,
              updatedAt: new Date(),
            })
            .where(eq(blogPosts.slug, slug));
          
          await client.end();
          console.log(`✓ Updated blog post: ${title} (${slug})`);
        } else {
          // For in-memory storage, delete and recreate
          // We need to get the ID first, but MemStorage doesn't expose deleteBlogPost
          // So we'll just recreate (which will overwrite if using Map)
          console.log(`⚠️  In-memory storage: Please restart server to see updates`);
        }
        continue;
      }

      const postData: InsertBlogPost = {
        title,
        slug,
        excerpt,
        content,
        author,
        featuredImage: null,
      };

      const post = await storage.createBlogPost(postData);
      console.log(`✓ Loaded blog post: ${title} (${slug})`);
    } catch (error) {
      console.error(`Error loading blog post from ${file}:`, error);
    }
  }

  console.log("\nDone loading blog posts!");
}

loadBlogPosts().catch(console.error);

