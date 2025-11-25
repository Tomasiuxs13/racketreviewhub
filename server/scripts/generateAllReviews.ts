import "dotenv/config";
import { storage } from "../storage.js";
import { generateRacketReview } from "../lib/openai.js";

async function generateAllReviews() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ ERROR: OPENAI_API_KEY not set. Cannot generate reviews.");
    console.error("   Please set OPENAI_API_KEY in your .env file.");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.warn("⚠️  WARNING: DATABASE_URL not set. Using in-memory storage.");
    console.warn("   Reviews will be lost when the server restarts.");
    console.warn("   Set DATABASE_URL to use Supabase for persistent storage.\n");
  } else {
    console.log("✓ Using SupabaseStorage (persistent storage)\n");
  }

  console.log("Fetching all rackets...");
  const rackets = await storage.getAllRackets();
  console.log(`Found ${rackets.length} rackets\n`);

  if (rackets.length === 0) {
    console.log("No rackets found. Nothing to do.");
    return;
  }

  // Get starting index from command line argument or environment variable (1-based, so 244 means start from racket 244)
  const startArg = process.argv[2] || process.env.START_FROM;
  const startIndex = startArg ? parseInt(startArg, 10) - 1 : 0;
  if (startIndex > 0) {
    console.log(`Starting from racket ${startIndex + 1} (index ${startIndex})\n`);
  }

  let successCount = 0;
  let errorCount = 0;

  for (let i = Math.max(0, startIndex); i < rackets.length; i++) {
    const racket = rackets[i];
    const progress = `[${i + 1}/${rackets.length}]`;

    try {
      console.log(`${progress} 🔄 Generating review for ${racket.brand} ${racket.model}...`);

      const reviewResult = await generateRacketReview(racket);

      if (!reviewResult || !reviewResult.reviewContent) {
        console.error(`${progress} ❌ Failed to generate review for ${racket.brand} ${racket.model}`);
        errorCount++;
        continue;
      }

      // Update the racket with the generated review
      const updatedRacket = await storage.updateRacket(racket.id, {
        reviewContent: reviewResult.reviewContent,
      });

      if (!updatedRacket) {
        console.error(`${progress} ❌ Failed to update racket ${racket.brand} ${racket.model} with review`);
        errorCount++;
        continue;
      }

      const reviewLength = reviewResult.reviewContent.length;
      console.log(`${progress} ✓ Generated review for ${racket.brand} ${racket.model} (${reviewLength} chars)`);
      successCount++;

      // Add a small delay to avoid rate limiting
      if (i < rackets.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error: any) {
      // Check if it's an API key error
      if (error?.code === 'invalid_api_key' || error?.status === 401) {
        console.error(`\n${progress} ❌ API KEY ERROR: Invalid or expired OpenAI API key`);
        console.error(`   Please check your OPENAI_API_KEY in .env file`);
        console.error(`   Error: ${error?.message || error?.error?.message || 'Invalid API key'}`);
        console.error(`\n   Script stopped at racket ${i + 1}. To resume, run:`);
        console.error(`   START_FROM=${i + 1} npm run generate-reviews\n`);
        errorCount++;
        // Continue processing other rackets (in case it's a temporary issue)
        // But log the issue clearly
      } else {
        console.error(`${progress} ❌ Error processing ${racket.brand} ${racket.model}:`, error?.message || error);
        errorCount++;
      }
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("Summary:");
  console.log(`  ✓ Successfully generated: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  Total processed: ${rackets.length}`);
  console.log("=".repeat(50));
}

generateAllReviews().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

