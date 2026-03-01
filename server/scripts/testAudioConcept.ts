import "dotenv/config";
import { storage } from "../storage.js";
import { openai } from "../lib/openai.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    console.log("--- Starting Audio Concept Test ---");

    // 1. Pick a racket
    const rackets = await storage.getAllRackets();
    const racket = rackets.find(r => r.brand === "Babolat" && r.model.includes("Technical Viper")) || rackets[0];

    if (!racket) {
        console.error("No racket found.");
        return;
    }

    console.log(`Target Racket: ${racket.brand} ${racket.model} (${racket.year})`);

    if (!openai) {
        console.error("OpenAI client not initialized.");
        return;
    }

    // 2. Generate Spoken Script using Gemini Flash via OpenRouter
    console.log("-> Generating spoken script using Gemini Flash...");
    const scriptPrompt = `
You are Carlos Rodriguez, a professional padel expert. Write a punchy, 1-minute audio review script for the ${racket.brand} ${racket.model} (${racket.year}).

Review Details:
${racket.reviewContent?.replace(/<[^>]*>/g, '')?.substring(0, 1000) || "No detailed review content available."}
Ratings: Power ${racket.powerRating}, Control ${racket.controlRating}, Overall ${racket.overallRating}.

Tones: Conversational, energetic, and expert.
Structure:
- Hook (5 seconds)
- Key Court Performance (Feel, Defense, Attack) (35 seconds)
- Who it's for (10 seconds)
- Final Verdict (10 seconds)

Target Length: 150-180 words.
NO bullet points. NO headings. Just spoken prose.
`;

    const scriptCompletion = await openai.chat.completions.create({
        model: "google/gemini-2.0-flash-001",
        messages: [{ role: "user", content: scriptPrompt }],
        temperature: 0.7,
    });

    const script = scriptCompletion.choices[0]?.message?.content?.trim();
    if (!script) {
        console.error("Failed to generate script.");
        return;
    }

    console.log("\n--- Generated Script ---");
    console.log(script);
    console.log("------------------------\n");

    // 3. Generate Audio via OpenRouter TTS Proxy
    console.log("-> Attempting to generate audio via OpenRouter TTS proxy...");
    try {
        const response = await fetch("https://openrouter.ai/api/v1/audio/speech", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://racketreviewhub.com",
                "X-Title": "Racket Review Hub"
            },
            body: JSON.stringify({
                model: "openai/tts-1",
                voice: "onyx",
                input: script,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter TTS failed: ${response.status} ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const outputPath = path.resolve(__dirname, "../../test_racket_review.mp3");
        await fs.promises.writeFile(outputPath, buffer);
        console.log(`✓ Audio generated successfully via OpenRouter: ${outputPath}`);
    } catch (error: any) {
        console.error("Failed to generate audio via OpenRouter:", error.message);
    }
}

run().catch(console.error);
