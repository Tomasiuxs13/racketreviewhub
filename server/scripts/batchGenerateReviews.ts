#!/usr/bin/env tsx
/**
 * Batch-API review generation — 50% token pricing vs the live pipeline.
 *
 * Runs the same 4-step pipeline as regenerateAllReviews.ts, but each step is a
 * Message Batch over a wave of rackets:
 *   1. research  (Sonnet 5 + web search)   → specs/sentiment/keywords backfill
 *   2. ratings   (Sonnet 5, thinking off)  → grounded 0-100 ratings
 *   3. review    (Sonnet 5)                → 9-section HTML review + publish gates
 *   4. translate (Haiku 4.5)               → ES/PT/IT/FR content_translations
 *
 * Usage:
 *   npx tsx server/scripts/batchGenerateReviews.ts --priority [options]
 *
 * Options:
 *   --priority          in-stock (PN or Padel Market), old-format reviews only, top brands first
 *   --year <n>          only rackets of this model year
 *   --limit <n>         cap total rackets processed
 *   --budget-eur <n>    hard stop between waves once measured spend exceeds this
 *   --wave-size <n>     rackets per wave (default 25)
 *   --locales <list>    comma-separated translation locales (default es,pt,it,fr)
 *   --skip-research     skip the research batch (cheaper, less grounded)
 *   --dry-run           print the queue and exit
 */
import "dotenv/config";
import { storage } from "../storage.js";
import {
  anthropic,
  OPENAI_MODEL,
  OPENAI_RESEARCH_MODEL,
  OPENAI_TRANSLATION_MODEL,
  buildResearchPrompt,
  parseResearchResponse,
  buildRatingsPrompt,
  parseRatingsResponse,
  buildReviewGenerationPrompts,
  cleanGeneratedReviewHtml,
  buildTranslationPrompts,
  parseTranslationResponse,
  type RacketResearch,
  type RacketRatings,
} from "../lib/openai.js";
import { INTRO_HOOK_ANGLES } from "../lib/openai.js";
import { upsertTranslation } from "../lib/i18n.js";
import { checkPublishQualityGates } from "../lib/qualityGates.js";
import { formatRacketDisplayName } from "@shared/utils";
import type { Racket } from "@shared/schema";

// ---------------------------------------------------------------------------
// CLI args

function parseIntArg(flag: string): number | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  const val = parseInt(process.argv[idx + 1], 10);
  return isNaN(val) ? undefined : val;
}
function parseStrArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

const priorityMode = process.argv.includes("--priority");
const dryRun = process.argv.includes("--dry-run");
const skipResearch = process.argv.includes("--skip-research");
const yearFilter = parseIntArg("--year");
const limit = parseIntArg("--limit");
const budgetEur = parseIntArg("--budget-eur");
const waveSize = parseIntArg("--wave-size") ?? 25;
const locales = (parseStrArg("--locales") ?? "es,pt,it,fr")
  .split(",").map((l) => l.trim().toLowerCase()).filter((l) => l && l !== "en");

// ---------------------------------------------------------------------------
// Cost accounting (Batch API = 50% token pricing; web-search fee undiscounted)

const BATCH_PRICES: Record<string, { inPerM: number; outPerM: number }> = {
  "claude-sonnet-5": { inPerM: 1, outPerM: 5 },     // 2/10 * 0.5
  "claude-haiku-4-5": { inPerM: 0.5, outPerM: 2.5 }, // 1/5 * 0.5
};
const WEB_SEARCH_USD = 0.01;
const USD_PER_EUR = 1.10;
let spentUsd = 0;

function trackBatchUsage(model: string, usage: any): void {
  const p = BATCH_PRICES[model] ?? BATCH_PRICES["claude-sonnet-5"];
  const inTok = usage?.input_tokens ?? 0;
  const cacheWrite = usage?.cache_creation_input_tokens ?? 0; // 1.25x input rate
  const cacheRead = usage?.cache_read_input_tokens ?? 0;      // 0.1x input rate
  const outTok = usage?.output_tokens ?? 0;
  const searches = usage?.server_tool_use?.web_search_requests ?? 0;
  spentUsd +=
    (inTok / 1e6) * p.inPerM +
    (cacheWrite / 1e6) * p.inPerM * 1.25 +
    (cacheRead / 1e6) * p.inPerM * 0.1 +
    (outTok / 1e6) * p.outPerM +
    searches * WEB_SEARCH_USD;
}
const spentEur = () => spentUsd / USD_PER_EUR;

// ---------------------------------------------------------------------------
// Queue building (mirrors regenerateAllReviews --priority, plus colorway dedup)

const PRIORITY_BRANDS = [
  "nox", "bullpadel", "babolat", "adidas", "head", "siux",
  "starvie", "wilson", "black crown", "dunlop", "varlion", "royal padel",
];
const brandRank = (b: string) => {
  const i = PRIORITY_BRANDS.indexOf(b.trim().toLowerCase());
  return i === -1 ? PRIORITY_BRANDS.length : i;
};
const hasCurrentFormatReview = (r: Racket) =>
  Boolean(r.reviewContent && r.reviewContent.includes("<h2>Quick Verdict</h2>"));

const COLOR_WORDS = /\b(white|black|blue|red|green|pink|golden|gold|silver|gray|grey|yellow|orange|purple|navy|coral|mint|rose|lima|lime)\b/gi;

/** Key that collapses colorway variants ("Ultimate White/blue" ≈ "Ultimate Gray/blue"). */
function colorwayKey(r: Racket): string {
  const base = `${r.brand} ${r.model}`
    .toLowerCase()
    .replace(/\b\w+\/\w+\b/g, " ")   // "white/blue" tokens
    .replace(COLOR_WORDS, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base;
}

async function buildQueue(): Promise<{ queue: Racket[]; skippedColorways: Racket[] }> {
  const all = await storage.getAllRackets();
  let queue = all;
  if (priorityMode) {
    queue = queue
      .filter((r) => r.inStock || (r as any).padelMarketInStock)
      .filter((r) => !hasCurrentFormatReview(r))
      .filter((r) => yearFilter === undefined || r.year === yearFilter)
      .sort((a, b) => {
        const d = brandRank(a.brand) - brandRank(b.brand);
        if (d !== 0) return d;
        return (b.overallRating || 0) - (a.overallRating || 0);
      });
  }

  // Colorway dedup: keep the best-rated racket per base model; skip the rest.
  const seen = new Map<string, Racket>();
  const skippedColorways: Racket[] = [];
  const deduped: Racket[] = [];
  for (const r of queue) {
    const key = colorwayKey(r);
    const kept = seen.get(key);
    if (!kept) {
      seen.set(key, r);
      deduped.push(r);
    } else {
      skippedColorways.push(r);
    }
  }
  queue = deduped;
  if (limit !== undefined) queue = queue.slice(0, limit);
  return { queue, skippedColorways };
}

// ---------------------------------------------------------------------------
// Batch helpers

async function runBatch(
  label: string,
  requests: { custom_id: string; params: any }[],
): Promise<Map<string, { text: string; usage: any }>> {
  const out = new Map<string, { text: string; usage: any }>();
  if (!requests.length) return out;

  console.log(`  [${label}] submitting batch of ${requests.length} requests...`);
  const batch = await anthropic!.messages.batches.create({ requests });
  const started = Date.now();

  while (true) {
    await new Promise((r) => setTimeout(r, 30000));
    const st = await anthropic!.messages.batches.retrieve(batch.id);
    const c = st.request_counts;
    console.log(`  [${label}] ${st.processing_status} — ok:${c.succeeded} err:${c.errored} processing:${c.processing} (${Math.round((Date.now() - started) / 1000)}s)`);
    if (st.processing_status === "ended") break;
    if (Date.now() - started > 3 * 3600 * 1000) {
      console.error(`  [${label}] batch exceeded 3h — cancelling`);
      await anthropic!.messages.batches.cancel(batch.id).catch(() => {});
      break;
    }
  }

  for await (const result of await anthropic!.messages.batches.results(batch.id)) {
    if (result.result.type === "succeeded") {
      const msg = result.result.message;
      trackBatchUsage(msg.model, msg.usage);
      const text = (msg.content as any[])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      out.set(result.custom_id, { text, usage: msg.usage });
    } else {
      console.warn(`  [${label}] ${result.custom_id}: ${result.result.type}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main

async function main() {
  if (!anthropic) {
    console.error("ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  const { queue, skippedColorways } = await buildQueue();
  console.log(`Queue: ${queue.length} rackets (${skippedColorways.length} colorway variants deduped)`);
  console.log(`Locales: ${locales.join(", ") || "(none)"} | wave size: ${waveSize} | budget: ${budgetEur !== undefined ? `€${budgetEur}` : "uncapped"} | research: ${skipResearch ? "OFF" : "on"}`);

  if (dryRun) {
    const est = queue.length * 0.12;
    console.log(`\n--- DRY RUN: ~€${est.toFixed(0)} at ~€0.12/racket (batch pricing) ---`);
    const byBrand = new Map<string, number>();
    queue.forEach((r) => byBrand.set(r.brand, (byBrand.get(r.brand) || 0) + 1));
    [...byBrand.entries()].sort((a, b) => b[1] - a[1]).forEach(([b, n]) => console.log(`  ${b}: ${n}`));
    console.log(`\nFirst 12:`);
    queue.slice(0, 12).forEach((r, i) => console.log(`  ${i + 1}. ${r.brand} ${r.model} (€${r.currentPrice}, ${r.overallRating}/100)`));
    if (skippedColorways.length) {
      console.log(`\nDeduped colorways (will not get their own review):`);
      skippedColorways.slice(0, 12).forEach((r) => console.log(`  - ${r.brand} ${r.model}`));
    }
    process.exit(0);
  }

  let done = 0, published = 0, failed = 0;

  for (let w = 0; w < queue.length; w += waveSize) {
    if (budgetEur !== undefined && spentEur() >= budgetEur) {
      console.log(`\n*** BUDGET REACHED: €${spentEur().toFixed(2)} (cap €${budgetEur}). Stopping after ${done} rackets. ***`);
      break;
    }
    const wave = queue.slice(w, w + waveSize);
    console.log(`\n=== WAVE ${Math.floor(w / waveSize) + 1}: ${wave.length} rackets | spent €${spentEur().toFixed(2)}${budgetEur !== undefined ? ` / €${budgetEur}` : ""} ===`);

    // -- Phase 1: research ---------------------------------------------------
    const research = new Map<string, RacketResearch>();
    if (!skipResearch) {
      const reqs = wave.map((r) => ({
        custom_id: `research-${r.id}`,
        params: {
          model: OPENAI_RESEARCH_MODEL,
          max_tokens: 2500,
          tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 1 }],
          messages: [{ role: "user", content: buildResearchPrompt({ brand: r.brand, model: r.model, year: r.year }) }],
        },
      }));
      const results = await runBatch("research", reqs);
      for (const r of wave) {
        const res = results.get(`research-${r.id}`);
        if (!res) continue;
        const parsed = parseResearchResponse(res.text);
        if (!parsed) continue;
        research.set(r.id, parsed);

        const updates: any = {};
        const sp = parsed.specs || {};
        if (!r.balance && sp.balance) updates.balance = sp.balance;
        if (!r.surface && sp.surface) updates.surface = sp.surface;
        if (!r.hardness && sp.hardness) updates.hardness = sp.hardness;
        if (!r.core && sp.core) updates.core = sp.core;
        if (!r.gameLevel && sp.gameLevel) updates.gameLevel = sp.gameLevel;
        if (!r.gameType && sp.gameType) updates.gameType = sp.gameType;
        if (!r.player && sp.player) updates.player = sp.player;
        if (parsed.sentiment) {
          updates.researchBrief = parsed.sentiment +
            (parsed.commonComplaints?.length ? `\n\nCommon Complaints: ${parsed.commonComplaints.join("; ")}` : "");
        }
        if (Object.keys(updates).length) await storage.updateRacket(r.id, updates);
      }
      console.log(`  research parsed for ${research.size}/${wave.length} | spend €${spentEur().toFixed(2)}`);
    }

    // Refresh wave rackets so later prompts see backfilled specs
    const freshWave: Racket[] = [];
    for (const r of wave) {
      freshWave.push((await storage.getRacket(r.id)) ?? r);
    }

    // -- Phase 2: ratings ----------------------------------------------------
    const ratingsReqs = freshWave.map((r) => ({
      custom_id: `ratings-${r.id}`,
      params: {
        model: OPENAI_MODEL,
        max_tokens: 300,
        thinking: { type: "disabled" },
        messages: [{
          role: "user",
          content: buildRatingsPrompt({
            brand: r.brand, model: r.model, shape: r.shape, year: r.year,
            balance: r.balance || undefined, surface: r.surface || undefined,
            hardness: r.hardness || undefined, core: r.core || undefined,
            gameLevel: r.gameLevel || undefined, gameType: r.gameType || undefined,
            player: r.player || undefined, researchBrief: r.researchBrief,
          }),
        }],
      },
    }));
    const ratingsResults = await runBatch("ratings", ratingsReqs);
    const ratingsById = new Map<string, RacketRatings>();
    for (const r of freshWave) {
      const res = ratingsResults.get(`ratings-${r.id}`);
      const parsed = res ? parseRatingsResponse(res.text) : null;
      if (parsed) {
        ratingsById.set(r.id, parsed);
        await storage.updateRacket(r.id, parsed as any);
      }
    }
    console.log(`  ratings updated for ${ratingsById.size}/${freshWave.length} | spend €${spentEur().toFixed(2)}`);

    // -- Phase 3: reviews ----------------------------------------------------
    const allRackets = await storage.getAllRackets();
    const recentGuides = await storage.getRecentGuides(3);
    const internalLinks = recentGuides.map((g) => `<a href="/guides/${g.slug}">${g.title}</a>`);
    const getSlug = (rk: Racket) => (rk as any).slug ||
      `${rk.brand} ${rk.model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    const reviewReqs: { custom_id: string; params: any }[] = [];
    for (const r of freshWave) {
      const merged = { ...r, ...(ratingsById.get(r.id) || {}) } as Racket;
      const priceNum = Number(merged.currentPrice) || 0;
      const scored = allRackets
        .filter((x) => x.id !== merged.id && !/pickle/i.test(x.model) && !/pickle/i.test(x.brand))
        .map((x) => {
          let score = 0;
          if (x.shape === merged.shape) score += 3;
          if (x.gameLevel && x.gameLevel === merged.gameLevel) score += 2;
          if (x.gameType && x.gameType === merged.gameType) score += 2;
          if (x.brand !== merged.brand) score += 1;
          const pd = Math.abs((Number(x.currentPrice) || 0) - priceNum);
          if (pd > 100) score -= 2; else if (pd > 50) score -= 1;
          return { racket: x, score };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);
      const competitors = scored.slice(0, 2).map((s) =>
        `<a href="/rackets/${getSlug(s.racket)}">${s.racket.brand} ${formatRacketDisplayName(s.racket.brand, s.racket.model, s.racket.year)}</a>`);

      const hookAngle = INTRO_HOOK_ANGLES[(w + reviewReqs.length) % INTRO_HOOK_ANGLES.length];
      const prompts = buildReviewGenerationPrompts(merged, { competitors, internalLinks, hookAngle }, research.get(r.id)?.keywords?.slice(0, 8) ?? []);
      reviewReqs.push({
        custom_id: `review-${r.id}`,
        params: {
          model: OPENAI_MODEL,
          max_tokens: 12000,
          system: prompts.system,
          messages: [{ role: "user", content: prompts.user }],
        },
      });
    }
    const reviewResults = await runBatch("review", reviewReqs);
    const reviewById = new Map<string, string>();
    for (const r of freshWave) {
      const res = reviewResults.get(`review-${r.id}`);
      if (!res?.text) { failed++; continue; }
      const html = cleanGeneratedReviewHtml(res.text);
      reviewById.set(r.id, html);
      await storage.updateRacket(r.id, { reviewContent: html } as any);
      const finalState = await storage.getRacket(r.id);
      if (finalState) {
        const gates = checkPublishQualityGates(finalState);
        if (gates.passes && !finalState.isPublished) {
          await storage.updateRacket(r.id, { isPublished: true } as any);
        }
        if (gates.passes) published++;
      }
      done++;
    }
    console.log(`  reviews saved for ${reviewById.size}/${freshWave.length} | spend €${spentEur().toFixed(2)}`);

    // -- Phase 4: translations ------------------------------------------------
    if (locales.length) {
      const specFields = ["color", "balance", "surface", "hardness", "finish", "playersCollection", "product", "core", "format", "gameLevel", "gameType", "player", "shape"] as const;
      const trReqs: { custom_id: string; params: any }[] = [];
      for (const r of freshWave) {
        const html = reviewById.get(r.id);
        if (!html) continue;
        const fresh = (await storage.getRacket(r.id)) ?? r;
        const items = [{ key: "reviewContent", text: html, context: "Padel racket review HTML article. Preserve all HTML tags and structure exactly." }];
        for (const f of specFields) {
          const v = (fresh as any)[f];
          if (v && typeof v === "string" && v.trim()) {
            items.push({ key: f, text: v.trim(), context: `Padel racket specification field: ${f}. Translate the value while keeping technical terms accurate.` });
          }
        }
        // Prompt caching across locales: the 4 locale requests for one racket share
        // the same large payload. Keep system + payload identical (cache_control on
        // the payload block) and put the locale-specific instruction AFTER the
        // breakpoint, so locales 2-4 read the cached prefix (best-effort in batches).
        const cachedPrompts = buildTranslationPrompts(items, "__LOCALE__");
        const sharedSystem = "You are a professional localization specialist for a padel racket review website. Translate content while preserving meaning, tone, HTML tags, and placeholders such as {{variable}} or {variable}. The target locale and its guidance are given at the end of the user message. Respond ONLY with valid JSON.";
        const sharedPayload = cachedPrompts.user
          .replace(/"targetLocale": "__LOCALE__",?\n?/g, "")
          .replace(/to __LOCALE__/g, "to the target locale");
        const LOCALE_GUIDANCE: Record<string, string> = {
          es: "Target locale: es. Use European Spanish (Spain). Use informal 'tú' form. Padel terminology: use 'pala' for racket, 'pista' for court. Keep brand/model names untranslated.",
          pt: "Target locale: pt. Use European Portuguese (Portugal). Use formal 'você' form. Padel terminology: use 'raquete' for racket. Keep brand/model names untranslated.",
          it: "Target locale: it. Use standard Italian. Use informal 'tu' form. Padel terminology: use 'racchetta' for racket, 'campo' for court. Keep brand/model names untranslated.",
          fr: "Target locale: fr. Use standard French. Use informal 'tu' form. Padel terminology: use 'raquette' for racket, 'terrain' for court. Keep brand/model names untranslated.",
        };
        for (const locale of locales) {
          trReqs.push({
            custom_id: `tr-${locale}-${r.id}`,
            params: {
              model: OPENAI_TRANSLATION_MODEL,
              max_tokens: 16000,
              temperature: 0.1,
              system: sharedSystem,
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: sharedPayload, cache_control: { type: "ephemeral" } },
                  { type: "text", text: LOCALE_GUIDANCE[locale] ?? `Target locale: ${locale}.` },
                ],
              }],
            },
          });
        }
      }
      const trResults = await runBatch("translate", trReqs);
      let trSaved = 0;
      for (const [cid, res] of trResults) {
        const m = cid.match(/^tr-([a-z]{2})-(.+)$/);
        if (!m) continue;
        const [, locale, racketId] = m;
        const fields = parseTranslationResponse(res.text);
        if (!fields || !fields.reviewContent) {
          console.warn(`  translate ${cid}: bad payload, skipped`);
          continue;
        }
        await upsertTranslation("racket_review", racketId, locale, fields);
        trSaved++;
      }
      console.log(`  translations saved: ${trSaved}/${trReqs.length}`);
    }

    console.log(`  wave done | cumulative spend €${spentEur().toFixed(2)}`);
  }

  console.log(`\n==============================`);
  console.log(`Done. Rackets: ${done} | published: ${published} | failed: ${failed}`);
  console.log(`Total spend: €${spentEur().toFixed(2)} ($${spentUsd.toFixed(2)}) at batch pricing`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
