#!/usr/bin/env tsx
/**
 * Normalize Category Data
 *
 * Cleans up inconsistent category field values across all rackets.
 * Maps free-text values to canonical enum values defined in schema.
 *
 * Usage:
 *   npx tsx server/scripts/normalizeCategoryData.ts [--dry-run]
 */

import "dotenv/config";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const isRenderDatabase = process.env.DATABASE_URL.includes(".render.com") || process.env.DATABASE_URL.includes("dpg-");
const db = postgres(process.env.DATABASE_URL, {
  ssl: isRenderDatabase ? { rejectUnauthorized: false } : undefined,
});

// Mapping tables: lowercase input -> canonical value
const shapeMap: Record<string, string> = {
  "diamond": "diamond",
  "round": "round",
  "teardrop": "teardrop",
  "hybrid": "hybrid",
  "not a racket": "",  // Will be flagged
};

const balanceMap: Record<string, string> = {
  "low": "Low",
  "mid": "Mid",
  "mid-high": "Mid-High",
  "medium": "Mid",
  "high": "High",
  "top": "High",
};

const hardnessMap: Record<string, string> = {
  "soft": "Soft",
  "medium": "Medium",
  "hard": "Hard",
};

const gameLevelMap: Record<string, string> = {
  "beginner": "Beginner",
  "intermediate": "Intermediate",
  "advanced": "Advanced",
  "professional": "Professional",
  "normal": "Intermediate",
  "medium": "Intermediate",
  "pro": "Professional",
};

const gameTypeMap: Record<string, string> = {
  "power": "Power",
  "control": "Control",
  "balance": "Balance",
  "all-around": "All-around",
  "all around": "All-around",
  "allaround": "All-around",
  "hybrid": "Balance",
};

const playerMap: Record<string, string> = {
  "man": "Man",
  "woman": "Woman",
  "both": "Both",
  "man, woman": "Both",
  "woman, man": "Both",
  "unisex": "Both",
};

function normalize(value: string | null, map: Record<string, string>): string | null {
  if (!value || !value.trim()) return null;
  const key = value.trim().toLowerCase();
  return map[key] ?? null;
}

async function run() {
  console.log("=".repeat(60));
  console.log(`Normalize Category Data ${dryRun ? "(DRY RUN)" : ""}`);
  console.log("=".repeat(60));

  const rackets = await db`SELECT id, brand, model, shape, balance, hardness, game_level, game_type, player FROM rackets`;
  console.log(`Found ${rackets.length} rackets to check\n`);

  let updatedCount = 0;
  let flaggedCount = 0;
  const updates: Array<{ id: string; fields: Record<string, string | null> }> = [];

  for (const r of rackets) {
    const changes: Record<string, string | null> = {};

    // Shape normalization
    const normShape = normalize(r.shape, shapeMap);
    if (r.shape && normShape !== null && normShape !== r.shape) {
      changes.shape = normShape;
    } else if (r.shape && normShape === null && r.shape.trim()) {
      console.log(`  FLAGGED: ${r.brand} ${r.model} - unknown shape: "${r.shape}"`);
      flaggedCount++;
    } else if (r.shape === "" || (r.shape && shapeMap[r.shape.trim().toLowerCase()] === "")) {
      console.log(`  FLAGGED: ${r.brand} ${r.model} - empty/invalid shape: "${r.shape}"`);
      flaggedCount++;
    }

    // Balance normalization
    const normBalance = normalize(r.balance, balanceMap);
    if (r.balance && normBalance !== null && normBalance !== r.balance) {
      changes.balance = normBalance;
    }

    // Hardness normalization
    const normHardness = normalize(r.hardness, hardnessMap);
    if (r.hardness && normHardness !== null && normHardness !== r.hardness) {
      changes.hardness = normHardness;
    }

    // Game Level normalization
    const normLevel = normalize(r.game_level, gameLevelMap);
    if (r.game_level && normLevel !== null && normLevel !== r.game_level) {
      changes.game_level = normLevel;
    }

    // Game Type normalization
    const normType = normalize(r.game_type, gameTypeMap);
    if (r.game_type && normType !== null && normType !== r.game_type) {
      changes.game_type = normType;
    }

    // Player normalization
    const normPlayer = normalize(r.player, playerMap);
    if (r.player && normPlayer !== null && normPlayer !== r.player) {
      changes.player = normPlayer;
    }

    if (Object.keys(changes).length > 0) {
      updates.push({ id: r.id, fields: changes });
    }
  }

  console.log(`\nFound ${updates.length} rackets needing updates, ${flaggedCount} flagged for review\n`);

  if (updates.length > 0) {
    console.log("Changes to apply:");
    for (const u of updates.slice(0, 20)) {
      const r = rackets.find(r => r.id === u.id);
      console.log(`  ${r?.brand} ${r?.model}: ${JSON.stringify(u.fields)}`);
    }
    if (updates.length > 20) {
      console.log(`  ... and ${updates.length - 20} more`);
    }
  }

  if (!dryRun && updates.length > 0) {
    console.log("\nApplying updates...");
    let applied = 0;
    for (const u of updates) {
      const setClauses: string[] = [];
      const values: any[] = [];

      // Build dynamic update
      if (u.fields.shape !== undefined) await db`UPDATE rackets SET shape = ${u.fields.shape} WHERE id = ${u.id}`;
      if (u.fields.balance !== undefined) await db`UPDATE rackets SET balance = ${u.fields.balance} WHERE id = ${u.id}`;
      if (u.fields.hardness !== undefined) await db`UPDATE rackets SET hardness = ${u.fields.hardness} WHERE id = ${u.id}`;
      if (u.fields.game_level !== undefined) await db`UPDATE rackets SET game_level = ${u.fields.game_level} WHERE id = ${u.id}`;
      if (u.fields.game_type !== undefined) await db`UPDATE rackets SET game_type = ${u.fields.game_type} WHERE id = ${u.id}`;
      if (u.fields.player !== undefined) await db`UPDATE rackets SET player = ${u.fields.player} WHERE id = ${u.id}`;

      applied++;
    }
    console.log(`Applied ${applied} updates`);
  } else if (dryRun) {
    console.log("\nDry run - no changes applied. Remove --dry-run to apply.");
  }

  await db.end();
  console.log("\nDone.");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
