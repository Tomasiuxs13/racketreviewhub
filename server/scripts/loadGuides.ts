import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { InsertGuide } from "@shared/schema";

// Import storage - will use SupabaseStorage if DATABASE_URL is set
let storage: Awaited<typeof import("../storage.js").storage>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple markdown to HTML converter
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Convert headers
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // Convert bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Convert italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Convert links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Convert images ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Convert bullet lists
  html = html.replace(/^\- (.*$)/gim, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");

  // Convert numbered lists
  html = html.replace(/^\d+\. (.*$)/gim, "<li>$1</li>");
  // Note: This is simplified - in production you'd want a proper markdown parser

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
  return match ? match[1].trim() : "Untitled Guide";
}

// Generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Extract excerpt (first paragraph or first 200 characters)
function extractExcerpt(markdown: string): string {
  // Remove the first # heading
  const withoutTitle = markdown.replace(/^# .+$/m, "").trim();
  
  // Get first paragraph (text until double newline or first 200 chars)
  const firstParagraph = withoutTitle.split("\n\n")[0] || withoutTitle.split("\n")[0] || "";
  const excerpt = firstParagraph.substring(0, 200).trim();
  
  // Remove markdown formatting for excerpt
  return excerpt
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

// Determine category from filename or content
function determineCategory(filename: string, content: string): string {
  const lowerFilename = filename.toLowerCase();
  const lowerContent = content.toLowerCase();

  if (lowerFilename.includes("beginner") || lowerContent.includes("beginner")) {
    return "beginners";
  }
  if (lowerFilename.includes("intermediate") || lowerContent.includes("intermediate")) {
    return "intermediate";
  }
  if (lowerFilename.includes("advanced") || lowerContent.includes("advanced")) {
    return "advanced";
  }
  if (lowerFilename.includes("shape") || lowerContent.includes("shape")) {
    return "general";
  }
  return "general";
}

async function loadGuides() {
  // Import storage dynamically to ensure it uses the right implementation
  const storageModule = await import("../storage.js");
  storage = storageModule.storage;

  if (!process.env.DATABASE_URL) {
    console.warn("⚠️  WARNING: DATABASE_URL not set. Using in-memory storage.");
    console.warn("   Guides will be lost when the server restarts.");
    console.warn("   Set DATABASE_URL to use Supabase for persistent storage.\n");
  } else {
    console.log("✓ Using SupabaseStorage (persistent storage)\n");
  }

  const dataDir = path.resolve(__dirname, "../data");
  const files = fs.readdirSync(dataDir).filter((file) => 
    file.endsWith(".md") && 
    file.startsWith("guide-") &&
    !file.includes("template") && // Skip template files
    !file.includes("content-plan") // Skip content plan files
  );

  console.log(`Found ${files.length} guide markdown files`);

  for (const file of files) {
    try {
      const filePath = path.join(dataDir, file);
      const markdown = fs.readFileSync(filePath, "utf-8");

      const title = extractTitle(markdown);
      const slug = generateSlug(title);
      const excerpt = extractExcerpt(markdown);
      const category = determineCategory(file, markdown);
      const content = markdownToHtml(markdown);

      // Check if guide already exists
      const existing = await storage.getGuide(slug);
      
      const guideData: InsertGuide = {
        title,
        slug,
        excerpt,
        content,
        category,
        featuredImage: null,
      };

      if (existing) {
        console.log(`Guide "${title}" already exists, updating...`);
        // Update existing guide
        if (process.env.DATABASE_URL) {
          // Import drizzle directly for update
          const { drizzle } = await import("drizzle-orm/postgres-js");
          const postgres = (await import("postgres")).default;
          const { guides } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");
          
          const client = postgres(process.env.DATABASE_URL);
          const db = drizzle(client);
          
          await db
            .update(guides)
            .set({
              title,
              excerpt,
              content,
              category,
              updatedAt: new Date(),
            })
            .where(eq(guides.slug, slug));
          
          await client.end();
          console.log(`✓ Updated guide: ${title} (${slug})`);
        } else {
          // For in-memory storage, we can't easily update, so just log
          console.log(`⚠️  In-memory storage: Please restart server to see updates`);
        }
      } else {
        const guide = await storage.createGuide(guideData);
        console.log(`✓ Loaded guide: ${title} (${slug})`);
      }
    } catch (error) {
      console.error(`Error loading guide from ${file}:`, error);
    }
  }

  console.log("\nDone loading guides!");
}

loadGuides().catch(console.error);

