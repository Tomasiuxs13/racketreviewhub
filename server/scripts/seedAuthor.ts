import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env") });

async function seedAuthor() {
  // Import storage dynamically to ensure it uses the right implementation
  const storageModule = await import("../storage.js");
  const storage = storageModule.storage;

  if (!process.env.DATABASE_URL) {
    console.warn("⚠️  WARNING: DATABASE_URL not set. Using in-memory storage.");
    console.warn("   Author will be lost when the server restarts.");
    console.warn("   Set DATABASE_URL to use Supabase for persistent storage.\n");
  } else {
    console.log("✓ Using SupabaseStorage (persistent storage)\n");
  }

  const defaultAuthor = {
    name: "Carlos Rodriguez",
    slug: "carlos-rodriguez",
    bio: "Professional padel player and equipment reviewer with over 15 years of experience. Carlos has tested hundreds of rackets and provides expert insights to help players find the perfect equipment for their game.",
    avatarUrl: null,
  };

  // Check if author already exists
  const existing = await storage.getAuthor(defaultAuthor.slug);
  if (existing) {
    console.log(`Author "${defaultAuthor.name}" already exists, skipping...`);
    return;
  }

  try {
    const author = await storage.createAuthor(defaultAuthor);
    console.log(`✓ Created author: ${author.name} (${author.slug})`);
    console.log(`  Author ID: ${author.id}`);
  } catch (error) {
    console.error("Error creating author:", error);
  }
}

seedAuthor().catch(console.error);

