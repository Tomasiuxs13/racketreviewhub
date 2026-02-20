#!/usr/bin/env tsx
/**
 * Test OpenAI API Key Status and Quota
 * 
 * This script checks if your OpenAI API key is working and provides
 * information about your account status and quota.
 * 
 * Usage:
 *   npx tsx server/scripts/testOpenAIKey.ts
 */

import "dotenv/config";
import OpenAI from "openai";

async function testOpenAIKey() {
  console.log("=".repeat(60));
  console.log("OpenAI API Key Status Check");
  console.log("=".repeat(60));
  console.log("");

  // Check if API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ ERROR: OPENAI_API_KEY not set in environment variables");
    console.error("   Please set it in your .env file");
    process.exit(1);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const keyPrefix = apiKey.substring(0, 7);
  const keySuffix = apiKey.substring(apiKey.length - 4);

  console.log(`✓ API Key found: ${keyPrefix}...${keySuffix}`);
  console.log(`  Key length: ${apiKey.length} characters`);
  const model = process.env.OPENAI_MODEL || "gpt-3.5-turbo";
  console.log(`  Model: ${model} (set OPENAI_MODEL env var to override)`);
  console.log("");

  // Initialize OpenAI client pointing to OpenRouter
  const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: apiKey,
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:5000",
      "X-Title": "Racket Review Hub Test"
    }
  });

  // Test 1: Simple API call
  console.log("🧪 Test 1: Making a simple API call to OpenRouter...");
  try {
    const model = process.env.OPENAI_MODEL || "meta-llama/llama-3.1-8b-instruct";
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "user",
          content: "Say 'API test successful' and nothing else.",
        },
      ],
      max_tokens: 10,
    });

    const content = response.choices[0]?.message?.content;
    console.log(`✓ API call successful!`);
    console.log(`  Response: ${content}`);
    console.log(`  Model: ${response.model}`);
    console.log(`  Tokens used: ${response.usage?.total_tokens || "unknown"}`);
    console.log("");
  } catch (error: any) {
    console.error("❌ API call failed!");
    console.error("");
    console.error("Error details:");
    console.error(`  Status: ${error?.status || "unknown"}`);
    console.error(`  Code: ${error?.code || "unknown"}`);
    console.error(`  Type: ${error?.type || "unknown"}`);
    console.error(`  Message: ${error?.message || String(error)}`);

    if (error?.error) {
      console.error("");
      console.error("Error object:");
      console.error(`  Code: ${error.error.code}`);
      console.error(`  Type: ${error.error.type}`);
      console.error(`  Message: ${error.error.message}`);
    }

    // Specific error handling
    if (error?.code === "insufficient_quota" || error?.status === 429) {
      console.error("");
      console.error("⚠️  QUOTA ERROR DETECTED");
      console.error("");
      console.error("Possible causes:");
      console.error("  1. Monthly spending limit reached");
      console.error("  2. Daily/rate limit exceeded");
      console.error("  3. No payment method on file");
      console.error("  4. Account needs billing setup");
      console.error("  5. API key belongs to different organization than budget");
      console.error("");
      console.error("To fix:");
      console.error("  1. Go to https://platform.openai.com/account/billing");
      console.error("  2. Check which organization your API key belongs to");
      console.error("  3. Verify payment method is added");
      console.error("  4. Check usage limits in Settings → Billing → Usage limits");
      console.error("  5. Ensure the organization with the API key has budget/quota");
    } else if (error?.status === 401) {
      console.error("");
      console.error("⚠️  AUTHENTICATION ERROR");
      console.error("  Your API key may be invalid or expired");
      console.error("  Please check your API key in .env file");
    }

    console.error("");
    process.exit(1);
  }

  // Test 2: Try to get usage info (if available)
  console.log("🧪 Test 2: Checking account information...");
  try {
    // Note: OpenAI API doesn't expose billing info via API, but we can check model availability
    const models = await openai.models.list();
    console.log(`✓ Can list models (${models.data.length} models available)`);
    console.log(`  Sample models: ${models.data.slice(0, 3).map(m => m.id).join(", ")}`);
    console.log("");
  } catch (error: any) {
    console.warn(`⚠️  Could not list models: ${error?.message || String(error)}`);
    console.log("");
  }

  // Summary
  console.log("=".repeat(60));
  console.log("Summary:");
  console.log("  ✓ API key is valid and working");
  console.log("  ✓ Can make API calls successfully");
  console.log("");
  console.log("Note: Billing/quota information is not available via API.");
  console.log("Check your usage at: https://platform.openai.com/usage");
  console.log("Check billing at: https://platform.openai.com/account/billing");
  console.log("=".repeat(60));
}

testOpenAIKey().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

