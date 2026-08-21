import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { Racket } from "@shared/schema";
import { formatRacketDisplayName } from "@shared/utils";
import { upsertTranslation } from "./i18n.js";

// Legacy OpenRouter key — only used by the deprecated `openai` client export below.
const API_KEY = process.env.OpenRouter_API_Key || process.env.OPENAI_API_KEY;

// The generation pipeline runs on the Claude API directly.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_KEY) {
  console.warn("Warning: ANTHROPIC_API_KEY not set. Review generation will be disabled.");
}

// Configurable models for the Claude API pipeline.
// Claude Sonnet 5 writes reviews and estimates ratings.
// NOTE: Sonnet 5 rejects non-default sampling params (temperature/top_p) — do not pass them.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "claude-sonnet-5";
// Claude Haiku 4.5 handles translations — strong HTML/JSON instruction following,
// same provider family for consistent tone across locales.
export const OPENAI_TRANSLATION_MODEL = process.env.OPENAI_TRANSLATION_MODEL || "claude-haiku-4-5";
// Research uses Claude Sonnet 5 with the Claude API's built-in web-search server tool.
export const OPENAI_RESEARCH_MODEL = process.env.OPENAI_RESEARCH_MODEL || "claude-sonnet-5";

export const anthropic = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;

interface ClaudeCallOptions {
  model: string;
  user: string;
  system?: string;
  maxTokens: number;
  timeoutMs?: number;
  /** Only pass for models that accept sampling params (e.g. Haiku 4.5) — Sonnet 5 rejects them. */
  temperature?: number;
  /** Disable adaptive thinking for short structured-output tasks to keep max_tokens tight. */
  disableThinking?: boolean;
  /** Enable the server-side web search tool (research tasks). */
  webSearch?: boolean;
}

interface ClaudeCallResult {
  text: string;
  stopReason: string | null;
}

/**
 * Thin wrapper over the Messages API used by every pipeline function.
 * Handles server-tool pause_turn continuations and concatenates text blocks.
 */
async function claudeText(opts: ClaudeCallOptions): Promise<ClaudeCallResult | null> {
  if (!anthropic) {
    console.warn("Anthropic client not initialized. Set ANTHROPIC_API_KEY.");
    return null;
  }

  const params: Anthropic.MessageCreateParams = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    messages: [{ role: "user", content: opts.user }],
  };
  if (opts.system) params.system = opts.system;
  if (opts.temperature !== undefined) params.temperature = opts.temperature;
  if (opts.disableThinking) {
    (params as any).thinking = { type: "disabled" };
  }
  if (opts.webSearch) {
    (params as any).tools = [{ type: "web_search_20260209", name: "web_search", max_uses: 2 }];
  }

  const requestOptions = { timeout: opts.timeoutMs ?? 120000, maxRetries: opts.webSearch ? 0 : 1 };

  let response = await anthropic.messages.create(params, requestOptions);
  trackUsage(opts.model, (response as any).usage);

  // Server-side tools can pause the turn; resume by echoing the assistant turn back.
  let continuations = 0;
  while (response.stop_reason === "pause_turn" && continuations < 3) {
    params.messages = [
      { role: "user", content: opts.user },
      { role: "assistant", content: response.content },
    ];
    response = await anthropic.messages.create(params, requestOptions);
    trackUsage(opts.model, (response as any).usage);
    continuations++;
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return { text, stopReason: response.stop_reason };
}

// ---------------------------------------------------------------------------
// Cost tracking: accumulates real usage across every claudeText call so bulk
// scripts can log spend and enforce a hard budget.
// Prices in USD per million tokens (Claude API, intro pricing where applicable).
const MODEL_PRICES: Record<string, { inPerM: number; outPerM: number }> = {
  "claude-sonnet-5": { inPerM: 2, outPerM: 10 },
  "claude-haiku-4-5": { inPerM: 1, outPerM: 5 },
  "claude-opus-4-8": { inPerM: 5, outPerM: 25 },
};
const WEB_SEARCH_PER_REQUEST_USD = 0.01; // $10 per 1000 searches

let cumulativeCostUsd = 0;

function trackUsage(model: string, usage: any): void {
  const price = MODEL_PRICES[model] ?? MODEL_PRICES["claude-sonnet-5"];
  const inputTokens = (usage?.input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0);
  const outputTokens = usage?.output_tokens ?? 0;
  const searches = usage?.server_tool_use?.web_search_requests ?? 0;
  cumulativeCostUsd +=
    (inputTokens / 1_000_000) * price.inPerM +
    (outputTokens / 1_000_000) * price.outPerM +
    searches * WEB_SEARCH_PER_REQUEST_USD;
}

/** Total API spend (USD) accumulated by this process since start. */
export function getCumulativeCostUsd(): number {
  return cumulativeCostUsd;
}

const REVIEW_TRANSLATION_MAX_SECTIONS_PER_BATCH = 1;
const REVIEW_TRANSLATION_MAX_CHARS_PER_BATCH = 2000;

interface ReviewSection {
  id: string;
  text: string;
}

function resolveReviewLocales(options: ReviewGenerationOptions): string[] {
  if (options.skipTranslations) {
    return [];
  }

  if (options.targetLocales && options.targetLocales.length > 0) {
    return options.targetLocales
      .map((locale) => locale.trim().toLowerCase())
      .filter((locale) => locale && locale !== "en");
  }

  return REVIEW_TRANSLATION_LOCALES;
}

export async function translateReviewLocales(
  racket: Racket,
  locales: string[],
  reviewHtml?: string,
): Promise<Record<string, string>> {
  const baseContent = reviewHtml ?? racket.reviewContent ?? "";

  // Collect all fields that need translation
  const fieldsToTranslate: Record<string, string> = {};

  // Add review content if available
  if (baseContent) {
    fieldsToTranslate.reviewContent = baseContent;
  }

  // Add specification fields that have values
  const specFields = [
    "color",
    "balance",
    "surface",
    "hardness",
    "finish",
    "playersCollection",
    "product",
    "core",
    "format",
    "gameLevel",
    "gameType",
    "player",
    "shape",
  ] as const;

  for (const field of specFields) {
    const value = racket[field];
    if (value && typeof value === "string" && value.trim()) {
      fieldsToTranslate[field] = value.trim();
    }
  }

  if (Object.keys(fieldsToTranslate).length === 0) {
    return {};
  }

  const normalizedLocales = locales
    .map((locale) => locale.trim().toLowerCase())
    .filter((locale) => locale && locale !== "en");

  if (!normalizedLocales.length) {
    return {};
  }

  const results: Record<string, string> = {};

  for (const locale of normalizedLocales) {
    try {
      const translatedFields: Record<string, string> = {};

      // Translate review content separately (it's HTML and needs special handling)
      if (fieldsToTranslate.reviewContent) {
        const translatedReview = await translateReviewHtml(fieldsToTranslate.reviewContent, locale);
        if (translatedReview) {
          translatedFields.reviewContent = translatedReview;
        }
      }

      // Translate specification fields in a batch
      const specFieldsToTranslate = Object.entries(fieldsToTranslate)
        .filter(([key]) => key !== "reviewContent")
        .map(([key, text]) => ({
          key,
          text,
          context: `Padel racket specification field: ${key}. Translate the value while keeping technical terms accurate.`,
        }));

      if (specFieldsToTranslate.length > 0) {
        const specTranslations = await translateTextBatch(specFieldsToTranslate, locale);
        Object.assign(translatedFields, specTranslations);
      }

      // Store all translated fields
      if (Object.keys(translatedFields).length > 0) {
        await upsertTranslation("racket_review", racket.id, locale, translatedFields);
        results[locale] = translatedFields.reviewContent || "";
      }
    } catch (error) {
      console.error(`Failed to translate review ${racket.id} to ${locale}:`, error);
    }
  }

  return results;
}

async function translateReviewHtml(content: string, locale: string): Promise<string> {
  const sections = createReviewSections(content);
  if (!sections.length) {
    return content;
  }

  const translations: Record<string, string> = {};
  const batches = chunkReviewSections(sections);

  for (const batch of batches) {
    const batchTranslations = await translateTextBatch(
      batch.map((section) => ({
        key: section.id,
        text: section.text,
        context: "Padel racket review HTML section. Translate text but preserve HTML tags and structure.",
      })),
      locale,
    );

    Object.entries(batchTranslations).forEach(([key, value]) => {
      translations[key] = value;
    });
  }

  return sections
    .map((section) => {
      const translated = translations[section.id]?.trim();
      if (!translated) return section.text;
      // Validate HTML structure wasn't corrupted: check key tags are preserved
      const originalH2Count = (section.text.match(/<h2>/gi) || []).length;
      const translatedH2Count = (translated.match(/<h2>/gi) || []).length;
      if (originalH2Count !== translatedH2Count) {
        console.warn(`Translation HTML mismatch for ${section.id} in ${locale}: expected ${originalH2Count} <h2> tags, got ${translatedH2Count}. Using original.`);
        return section.text;
      }
      return translated;
    })
    .join("\n");
}

function createReviewSections(content: string): ReviewSection[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const segments = normalized.split(/(?=<h2>)/i).map((segment) => segment.trim()).filter(Boolean);

  if (!segments.length) {
    return [{ id: "section_0", text: normalized }];
  }

  return segments.map((segment, index) => ({
    id: `section_${index.toString().padStart(2, "0")}`,
    text: segment,
  }));
}

function chunkReviewSections(sections: ReviewSection[]): ReviewSection[][] {
  const batches: ReviewSection[][] = [];
  let current: ReviewSection[] = [];
  let charCount = 0;

  sections.forEach((section) => {
    const length = section.text.length;
    const exceedsCount = current.length >= REVIEW_TRANSLATION_MAX_SECTIONS_PER_BATCH;
    const exceedsChars = charCount + length > REVIEW_TRANSLATION_MAX_CHARS_PER_BATCH;

    if ((exceedsCount || exceedsChars) && current.length) {
      batches.push(current);
      current = [];
      charCount = 0;
    }

    current.push(section);
    charCount += length;
  });

  if (current.length) {
    batches.push(current);
  }

  return batches;
}

export const openai = API_KEY
  ? new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: API_KEY,
    defaultHeaders: {
      "HTTP-Referer": process.env.SITE_URL || "https://racketreviewhub.com",
      "X-Title": "Racket Review Hub"
    }
  })
  : null;

export const isOpenAIConfigured = Boolean(anthropic);

const DEFAULT_REVIEW_TRANSLATION_LOCALES = ["es", "pt", "it", "fr"];

const configuredReviewLocales = (process.env.REVIEW_TRANSLATION_LOCALES ?? DEFAULT_REVIEW_TRANSLATION_LOCALES.join(","))
  .split(",")
  .map((locale) => locale.trim().toLowerCase())
  .filter((locale) => locale && locale !== "en");

export const REVIEW_TRANSLATION_LOCALES = configuredReviewLocales;

// Dynamic review template builder - generates different templates based on racket characteristics
// to avoid duplicate content across 1000+ rackets and improve SEO performance
function buildReviewTemplate(racket: Partial<Racket>, racketInfo: string, options?: ReviewGenerationOptions): string {
  const price = Number(racket.currentPrice) || 0;
  const shape = racket.shape?.toLowerCase() || "teardrop";
  const gameLevel = racket.gameLevel?.toLowerCase() || "intermediate";
  const gameType = racket.gameType?.toLowerCase() || "balance";

  // Determine racket tier for template variation
  const tier = price >= 300 ? "premium" : price >= 150 ? "midrange" : "budget";
  const isAdvanced = gameLevel === "advanced" || gameLevel === "professional";
  const isPower = gameType === "power";
  const isControl = gameType === "control";

  // Quick verdict box — targets Google featured snippets and AI-search answers.
  // Must be a direct, self-contained answer to "should I buy the X?" in 40-60 words.
  const quickVerdictSection = `<h2>Quick Verdict</h2>
<p>Write a single 40-60 word paragraph that directly answers "Is the ${racket.brand} ${racket.model} worth buying and who is it for?" in a self-contained way. Name the racket, state the verdict, the ideal player profile (level + play style), and its single biggest strength and weakness. This must read as a complete standalone answer — a search engine should be able to lift this paragraph verbatim as a featured snippet.</p>`;

  // Core sections that always appear (but with varied instructions)
  const hookInstruction = options?.hookAngle
    ? `HOOK ANGLE FOR THIS REVIEW: ${options.hookAngle}`
    : "Open with a hook sentence about what makes this racket distinctive on court";
  const introSection = `<h2>Introduction</h2>
<p>Write a 2-3 paragraph introduction. ${hookInstruction} — do NOT open with the price, NOT with a list of specs. Lead with a strong opinion or observation from testing. Then cover: what kind of player StarVie/this brand built it for, what makes this specific model stand out in the ${racket.year || "current"} lineup, and confirm that we tested it on court. Reference actual specs naturally (${shape} shape, ${racket.balance || ""} balance) as part of the narrative, not as a bullet list. End the intro with a single teaser sentence about what surprised us most during testing.</p>`;

  const prosConsSection = `<h2>Pros and Cons</h2>
<p>Analyze this specific racket's strengths and weaknesses based on its actual specifications. Be honest and specific.</p>
<h3>Pros</h3>
<ul>
<li>List 4-5 specific advantages derived from THIS racket's actual specs (shape, balance, core, surface, ratings)</li>
<li>Explain WHY each feature is an advantage for the target player during actual match play</li>
<li>Reference specific performance ratings where relevant</li>
</ul>
<h3>Cons</h3>
<ul>
<li>List 3-4 honest limitations or trade-offs we discovered</li>
<li>Explain which player types will find these problematic (e.g., "players with wrist issues might find the rigid core jarring")</li>
<li>Be specific about compromises inherent in this racket's design choices</li>
</ul>`;

  // Provide a court-tested breakdown rather than just generic shape facts
  const performanceSection = `<h2>Performance on the Court</h2>
<p>Detail how the racket actually feels during play. Instead of just listing specs, break down the experience into specific padel scenarios:</p>
<h3>At the Back of the Court (Defense)</h3>
<p>Describe how the racket handles defensive lobs, low balls, and returning heavy smashes from the baseline. Does its ${shape} shape and ${racket.balance || "current"} balance help or hinder maneuverability?</p>
<h3>At the Net (Volleys and Smashes)</h3>
<p>Explain the sensation when attacking. Discuss power generation on smashes, block volley stability, and punch volley speed.</p>
<h3>Spin and Control (Viboras & Bandejas)</h3>
<p>Describe how the ${racket.surface || "surface"} interacts with the ball when applying slice or topspin during bandeja and vibora setups.</p>`;

  // Dynamic sections based on racket tier
  const technologySection = tier === "premium"
    ? `<h2>Technology and Build Quality</h2>
<p>Detail the specific technologies used in this ${racket.brand} racket. Discuss the ${racket.surface || "surface"} face, ${racket.core || "core"} technology, and frame construction. Explain how we felt these technologies working during our playtest. Reference any proprietary technologies from ${racket.brand}.</p>`
    : `<h2>Construction and Materials</h2>
<p>Describe the materials and build quality of this racket. Discuss the ${racket.core || "core"} and ${racket.surface || "surface material"}, and how they contribute to the racket's performance at this price point. Offer our honest assessment of the material quality relative to the price.</p>`;

  // Level-specific section — always includes specific player profile
  const levelSection = isAdvanced
    ? `<h2>Who Is This Racket For?</h2>
<p>Give a highly specific player profile — not just skill level. Cover all of the following:</p>
<ul>
<li>Preferred court position (left side / right side / both)</li>
<li>Playing style (aggressive baseliner, all-court, net-first, defensive retriever)</li>
<li>Physical profile considerations (arm comfort, wrist sensitivity, swing speed)</li>
<li>How often they play (recreational 1-2x/week vs competitive 4x+/week)</li>
<li>One or two specific player archetypes who should look elsewhere and why</li>
</ul>
<p>Be decisive and opinionated. Example: "This is not a racket for the player who loves to end points with flat smashes from the left side — the round shape and soft core simply won't generate the explosive pop you need. It IS the racket for the right-side player who constructs points through bandejas and precise cross-court volleys."</p>`
    : `<h2>Who Should Buy This Racket?</h2>
<p>Provide our honest assessment of the ideal player profile for this racket. Cover all of the following:</p>
<ul>
<li>Skill level and how long they have been playing</li>
<li>Preferred court position and playing style</li>
<li>Physical considerations (arm comfort, swing speed, strength)</li>
<li>Playing frequency</li>
<li>One or two player archetypes who should NOT buy this racket and why</li>
</ul>
<p>Be highly specific. Avoid vague statements like "great for players who value control". Instead: "If you are a recreational player who plays twice a week and is still developing your vibora, this racket's forgiving sweet spot will save you more points than a diamond-shaped power racket ever could."</p>`;

  const comparisonSection = options?.competitors?.length
    ? `<h2>How It Compares</h2>\n<p>Provide an authoritative market comparison. Discuss where this racket sits in the ${racket.brand} lineup and the broader ${tier} market segment. You MUST directly compare it against these specific alternatives: ${options.competitors.join(", ")}. Use exactly the HTML link provided for each competitor when mentioning it. What does THIS racket do better than its direct competitors? What might competing options do better?</p>`
    : `<h2>How It Compares</h2>\n<p>Provide an authoritative market comparison. Discuss where this racket sits within the broader ${tier} market segment. You MUST name 1 or 2 specific equivalent rackets from other major brands that an online shopper might also be considering. What does THIS racket do better than its direct competitors?</p>`;

  const faqSection = `<h2>Frequently Asked Questions</h2>
<p>Answer exactly 4 questions using this EXACT HTML format for every Q&A pair:</p>
<p><strong>Q: [Question text here]</strong></p>
<p>[Answer text here — 2-4 sentences, specific and direct.]</p>
<p>Cover these 4 questions in this order:</p>
<ol>
<li>Is the ${racket.brand} ${racket.model} good for ${gameLevel || "intermediate"} players?</li>
<li>Who is the ${racket.brand} ${racket.model} actually best suited for? (Be specific: playing style, court position, physical profile, how often they play)</li>
<li>How does the ${racket.brand} ${racket.model} compare to ${options?.competitors?.[0] || "similar rackets from other major brands"}?</li>
<li>Is the ${racket.brand} ${racket.model} still a good buy in ${new Date().getFullYear()} considering its price and performance?</li>
</ol>
<p>CRITICAL: Every question must be wrapped in &lt;strong&gt; tags prefixed with "Q:". Every answer must be in its own &lt;p&gt; tag. No &lt;h3&gt; or &lt;h4&gt; tags in this section.</p>`;

  const conclusionSection = `<h2>Final Verdict</h2>
<p>Give a decisive, highly opinionated final verdict based on our time with the racket. State clearly whether we recommend this racket and for whom. Summarize the 2-3 most important takeaways. End with a definitive "Buy it if..." and "Skip it if..." statement.</p>`;

  const seoGuidance = `
SEO OPTIMIZATION REQUIREMENTS:
- Naturally weave in these keyword patterns where appropriate (without keyword stuffing):
  * "${racket.brand} ${racket.model} review"
  * "${racket.brand} ${racket.model} padel racket"
  * "${shape} padel racket"
  * "${gameLevel || "intermediate"} padel racket"
- Explicitly mention the full racket name "${racket.brand} ${racket.model}" several times in the introduction and conclusion.
- Answer search-intent questions directly in the body and FAQ-style section, such as:
  * "Is ${racket.brand} ${racket.model} good for ${gameLevel || "intermediate"} players?"
  * "Is this racket better for power, control, or all-around play?"
  * "How does it compare against other ${tier} ${shape} rackets?"
- Use natural language that would make this review a strong candidate for Google featured snippets.
- Keep keyword usage natural and readable – never repeat phrases unnaturally just for SEO.
${options?.internalLinks?.length ? `\nINTERNAL LINKING REQUIREMENT:
You MUST integrate the following exact HTML anchor tags naturally within your review (e.g., in the introduction, performance, or FAQ sections). Place them where they contextually make sense, substituting plain text mentions with these exact links:
${options.internalLinks.map(link => `- ${link}`).join("\n")}
` : ""}`;

  return `You are an expert, highly opinionated padel racket reviewer writing for an enthusiast audience. Write a unique, focused review article using ONLY the HTML structure provided below.

CRITICAL DIRECTIVE: You MUST ONLY talk about THIS specific racket (${racket.brand} ${racket.model}). 
ABSOLUTELY NO GENERIC PADEL EDUCATION. Do NOT explain what racket shapes are. Do NOT explain what weight categories are. Do NOT explain what different core foams mean. Your audience already knows how to play padel. If you include sections like "Understanding Padel Shapes", "Skill Level Recommendations", or "Maintenance Tips", YOU HAVE FAILED.

You must output EXACTLY these 9 sections, utilizing the provided HTML structure.

${seoGuidance}

${quickVerdictSection}

${introSection}

${performanceSection}

${prosConsSection}

${technologySection}

${levelSection}

${comparisonSection}

${faqSection}

${conclusionSection}

WRITING QUALITY REQUIREMENTS:
- Each section must be substantive. Aim for at least 140 words per section, EXCEPT "Quick Verdict" which must stay at 40-60 words.
- Every performance claim must be grounded in a specific padel scenario. BAD: "excellent for volleys". GOOD: "when blocking a hard-hit smash from the back glass, the stiff frame returns the ball cleanly with minimal energy loss".
- Never cite a numerical rating as evidence for itself. BAD: "The 92/100 control rating proves this racket has great control." GOOD: "We noticed pin-point accuracy on cross-court volleys, which aligns with its control-oriented design."
- Never START a sentence or bullet point with a rating number. BAD: "The 85/100 maneuverability rating delivers..." GOOD: "During quick exchanges at the net, the racket felt nimble..."
- Reference specific, named shot types where relevant: bandeja, vibora, bajada, lob, smash, block volley.

PARAGRAPH FORMATTING (CRITICAL FOR READABILITY):
- Every <p> tag must contain 2-4 sentences MAXIMUM. Never write a paragraph longer than 60 words.
- Break long explanations into multiple short <p> tags. Readers scan on mobile — dense paragraphs get skipped.
- For <li> bullet points, keep each to 1-2 sentences (40 words max). If a point needs more explanation, split it into separate bullets.
- After each H3 subheading, use 2-3 short paragraphs rather than one long block.

BANNED PHRASES & PATTERNS (never use these):
- Opening the Introduction with "The first thing we noticed" or "What struck us first" — these are overused across our reviews. Invent a hook specific to THIS racket instead (a shot it changed, an expectation it broke, a comparison to its predecessor).
- "we were keen to see", "we were excited to", "we were struck by", "we were eager to"
- "making it a great choice for players who value these features"
- "help them take their game to the next level"
- "does not disappoint", "lives up to its reputation" (unless followed immediately by a specific why)
- "reveals its true character across different court positions"
- Starting consecutive sentences with "The [spec]..."
- Starting a sentence with a rating number like "The 85/100..."
- Ending sections with generic summaries that repeat the intro sentence

CRITICAL HTML FORMATTING REQUIREMENTS:
- Use <h2> tags for the 9 section headings listed above ONLY. DO NOT invent new <h2> headings.
- Use <h3> tags for Pros and Cons / Performance subsections.
- Use <p> tags for ALL paragraph text.
- Use <ul> and <li> tags for ALL bullet lists.
- DO NOT use markdown formatting - ONLY HTML tags.
- DO NOT wrap output in markdown code blocks (like \`\`\`html). Just output the raw HTML directly.
- Speak in the first person plural ("we", "our") representing a team of expert playtesters.
- Be highly specific to THIS racket's specs (${racket.shape} shape, ${racket.balance} balance, etc).`;
}

export interface RacketRatings {
  powerRating: number;
  controlRating: number;
  reboundRating: number;
  maneuverabilityRating: number;
  sweetSpotRating: number;
  overallRating: number;
}

export interface ReviewGenerationResult {
  reviewContent: string;
  ratings?: RacketRatings;
}

export interface ReviewGenerationOptions {
  targetLocales?: string[];
  skipTranslations?: boolean;
  competitors?: string[];
  internalLinks?: string[];
  keywords?: string[];
  /** Angle for the introduction's opening hook — rotated across bulk runs so
   *  similar rackets don't converge on the same phrasing (Sonnet 5 has no
   *  temperature; prompt-side variation is the lever). */
  hookAngle?: string;
}

/** Rotation pool for intro hook angles used by bulk generation. */
export const INTRO_HOOK_ANGLES = [
  "Open with a specific shot from testing (a vibora, bandeja, or block volley) and what the racket did to it.",
  "Open with the expectation you had before testing and how the racket broke or confirmed it.",
  "Open with how this racket compares to its predecessor or its siblings in the brand lineup.",
  "Open with the type of player you kept thinking about while testing it.",
  "Open with a weakness or quirk you noticed early, then pivot to what it gets right.",
  "Open with the racket's price positioning and whether the on-court experience matches it.",
  "Open with the sound/feel of the first clean strike and what it signals about the build.",
  "Open with a match situation (defending a 2v1 net assault, closing a tight tiebreak) where the racket showed its character.",
];

export interface RacketResearch {
  specs?: {
    balance?: string;
    surface?: string;
    hardness?: string;
    core?: string;
    gameLevel?: string;
    gameType?: string;
    player?: string;
  };
  sentiment?: string; // Summarized pros/cons from the internet
  commonComplaints?: string[]; // Specific flaws/issues reported by users
  keywords?: string[]; // Common search queries for SEO
}

export async function performRacketResearch(racketInfo: {
  brand: string;
  model: string;
  year?: number;
}): Promise<RacketResearch | null> {
  if (!anthropic) {
    console.warn("Anthropic client not initialized. Using default/empty research.");
    return null;
  }

  try {
    const prompt = buildResearchPrompt(racketInfo);
    const result = await claudeText({
      model: OPENAI_RESEARCH_MODEL,
      user: prompt,
      maxTokens: 2500, // room for adaptive thinking + JSON answer
      webSearch: true,
      timeoutMs: 150000, // one generous attempt; timed-out server requests still bill, so never retry-hammer
    });

    const content = result?.text?.trim();
    if (!content) {
      console.error("Failed to get research from Claude");
      return null;
    }
    const parsed = parseResearchResponse(content);
    if (!parsed) {
      console.warn(`Research model returned non-JSON for ${racketInfo.brand} ${racketInfo.model} — skipping research.`);
    }
    return parsed;
  } catch (error) {
    console.error("Error performing research with Claude:", error);
    return null;
  }
}

/** Prompt for the web-search research step. Shared by live and batch pipelines. */
export function buildResearchPrompt(racketInfo: { brand: string; model: string; year?: number }): string {
  return `You are a padel research assistant. Your job is to search the web for the specifications and general sentiment of a specific padel racket.
    
Target Racket:
- Brand: ${racketInfo.brand}
- Model: ${racketInfo.model}
- Year: ${racketInfo.year || 'Unknown'}

Please find the official specifications and summarize what reviewers/players say about its strengths and weaknesses.

Return ONLY a JSON object with these exact keys (no other text):
{
  "specs": {
    "balance": "Low/Mid/Mid-High/High",
    "surface": "e.g. 12K Carbon, Fiberglass",
    "hardness": "Soft/Medium/Hard",
    "core": "e.g. EVA Soft, Multi-EVA",
    "gameLevel": "Beginner/Intermediate/Advanced/Professional",
    "gameType": "Power/Control/Balance/All-around",
    "player": "Man/Woman/Both"
  },
  "sentiment": "A 2-3 sentence summary of the general consensus on how this racket plays, its best features, and its flaws. Be specific.",
  "commonComplaints": ["complaint 1 (e.g. paint chips easily, head heavy)", "complaint 2 (e.g. handle too short)"],
  "keywords": ["up to 10 common Google search queries users type when looking for this racket, e.g. '${racketInfo.brand} ${racketInfo.model} review', '${racketInfo.brand} ${racketInfo.model} padel racket'"]
}

If you cannot find specific information for a field, leave it null or omit it. Do not guess.`;
}

/** Parse the research model's output (JSON possibly wrapped in prose/fences). */
export function parseResearchResponse(raw: string): RacketResearch | null {
  let content = raw.trim();
  const objMatch = content.match(/\{[\s\S]*\}/);
  if (objMatch) {
    content = objMatch[0];
  }
  content = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(content) as RacketResearch;
  } catch {
    return null;
  }
}

// Optional keyword research helper to inform SEO-focused review generation.
// Uses the research model to discover common search queries for a given racket.
async function researchRacketKeywords(brand: string, model: string): Promise<string[]> {
  if (!anthropic) {
    return [];
  }

  try {
    const prompt = `You are an SEO assistant. Find the MOST COMMON search queries users type into Google and Bing for: ${brand} ${model} padel racket.

CRITICAL: Return ONLY a valid JSON array of strings. No explanations, no markdown, no other text. Example format:
["query 1", "query 2", "query 3"]

Return up to 10 common search queries as a JSON array.`;

    const result = await claudeText({
      model: OPENAI_RESEARCH_MODEL,
      system: "You are a JSON-only API. Always return valid JSON arrays, never natural language.",
      user: prompt,
      maxTokens: 600,
      disableThinking: true,
      timeoutMs: 60000,
    });

    let content = result?.text?.trim();
    if (!content) {
      return [];
    }

    // Remove markdown code blocks if present
    content = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    // Try to extract JSON array from the response if it's embedded in text
    // Look for array pattern: [...]
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      content = arrayMatch[0];
    }

    // Try parsing as JSON
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === "string").slice(0, 10);
      }
    } catch (parseError) {
      // If JSON parsing fails, try to extract quoted strings as a fallback
      const stringMatches = content.match(/"([^"]+)"/g);
      if (stringMatches && stringMatches.length > 0) {
        return stringMatches
          .map((match) => match.replace(/^"|"$/g, ""))
          .filter((s) => s.length > 0)
          .slice(0, 10);
      }
    }

    return [];
  } catch (error) {
    // Silently fail - keyword research is optional, don't break review generation
    console.warn(`Keyword research failed for ${brand} ${model} (non-critical):`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

// Estimate ratings using ChatGPT based on racket characteristics
export async function estimateRacketRatings(racketInfo: {
  brand: string;
  model: string;
  shape: string;
  year?: number;
  balance?: string;
  surface?: string;
  hardness?: string;
  core?: string;
  gameLevel?: string;
  gameType?: string;
  player?: string;
  researchBrief?: string | null;
}): Promise<RacketRatings | null> {
  if (!anthropic) {
    console.warn("OpenAI client not initialized. Using default ratings.");
    return null;
  }

  try {
    const prompt = buildRatingsPrompt(racketInfo);
    const result = await claudeText({
      model: OPENAI_MODEL,
      user: prompt,
      maxTokens: 300,
      disableThinking: true, // short structured output — no thinking budget needed
      timeoutMs: 45000,
    });

    const content = result?.text?.trim();
    if (!content) {
      console.error("Failed to get rating estimation from Claude");
      return null;
    }
    return parseRatingsResponse(content);
  } catch (error) {
    console.error("Error estimating ratings with Claude:", error);
    return null;
  }
}

/** Prompt for the ratings-estimation step. Shared by live and batch pipelines. */
export function buildRatingsPrompt(racketInfo: {
  brand: string; model: string; shape: string; year?: number;
  balance?: string; surface?: string; hardness?: string; core?: string;
  gameLevel?: string; gameType?: string; player?: string;
  researchBrief?: string | null;
}): string {
  return `You are a padel racket expert. Based on the following racket characteristics, estimate performance ratings on a scale of 0-100.

Racket Information:
- Brand: ${racketInfo.brand}
- Model: ${racketInfo.model}
- Shape: ${racketInfo.shape}
- Year: ${racketInfo.year || 'Unknown'}
${racketInfo.balance ? `- Balance: ${racketInfo.balance}` : ''}
${racketInfo.surface ? `- Surface: ${racketInfo.surface}` : ''}
${racketInfo.hardness ? `- Hardness: ${racketInfo.hardness}` : ''}
${racketInfo.core ? `- Core: ${racketInfo.core}` : ''}
${racketInfo.gameLevel ? `- Game Level: ${racketInfo.gameLevel}` : ''}
${racketInfo.gameType ? `- Game Type: ${racketInfo.gameType}` : ''}
${racketInfo.player ? `- Player Type: ${racketInfo.player}` : ''}

${racketInfo.researchBrief ? `ONLINE RESEARCH / SENTIMENT:\n${racketInfo.researchBrief}\n` : ''}

Consider these factors when estimating:
- Shape affects power vs control balance (Diamond = more power, Round = more control, Teardrop = balanced)
- If Online Research is provided, heavily heavily weight those findings in your ratings. 
- Brand reputation and typical quality
- Balance point affects maneuverability
- Core material affects sweet spot and feel
- Game level indicates target player skill

*** RATINGS CALIBRATION RUBRIC ***
Use this rubric to calibrate your ratings and avoid clustering everything around 80-90:
- 95-100: Absolute top tier for this specific characteristic (e.g. 95+ Power means it's an absolute cannon).
- 85-94: Excellent, a strong suit of this racket.
- 75-84: Good/Average. Does the job but doesn't stand out.
- 60-74: Below average. A noticeable weakness.
- <60: Poor performance in this area.

Return ONLY a JSON object with these exact keys (no other text):
{
  "powerRating": <number 0-100>,
  "controlRating": <number 0-100>,
  "reboundRating": <number 0-100>,
  "maneuverabilityRating": <number 0-100>,
  "sweetSpotRating": <number 0-100>,
  "overallRating": <number 0-100>
}

The overallRating should be a comprehensive assessment considering all factors, not just a simple average. Consider:
- Online Research/Sentiment (if provided)
- Brand reputation and quality
- Price point and value proposition
- Target player level and suitability
- Overall balance of power, control, and other characteristics
- Innovation and technology level`;
}

/** Parse + clamp the ratings model's JSON output. Shared by live and batch pipelines. */
export function parseRatingsResponse(raw: string): RacketRatings | null {
  try {
    const content = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const ratings = JSON.parse(content) as RacketRatings;

    // Validate ratings are within bounds and not NaN
    const validateRating = (value: any, fallback = 80): number => {
      const num = Number(value);
      if (isNaN(num)) return fallback;
      return Math.max(0, Math.min(100, Math.round(num)));
    };

    const powerRating = validateRating(ratings.powerRating, 85);
    const controlRating = validateRating(ratings.controlRating, 85);
    const reboundRating = validateRating(ratings.reboundRating, 80);
    const maneuverabilityRating = validateRating(ratings.maneuverabilityRating, 80);
    const sweetSpotRating = validateRating(ratings.sweetSpotRating, 85);

    return {
      powerRating,
      controlRating,
      reboundRating,
      maneuverabilityRating,
      sweetSpotRating,
      overallRating: validateRating(
        ratings.overallRating !== undefined ? ratings.overallRating : Math.round(
          (powerRating + controlRating + reboundRating + maneuverabilityRating + sweetSpotRating) / 5
        ), 85
      ),
    };
  } catch {
    return null;
  }
}

export interface TranslationBatchItem {
  key: string;
  text: string;
  context?: string;
}

export interface TranslationBatchOptions {
  sourceLocale?: string;
}

/**
 * Build the {system, user} prompt pair for review generation.
 * Normalizes the feed model name so generated prose uses the clean display name.
 * Shared by live and batch pipelines.
 */
export function buildReviewGenerationPrompts(
  racketInput: Racket,
  options: ReviewGenerationOptions = {},
  keywordPhrases: string[] = [],
): { system: string; user: string } {
  // Normalize the feed model name ("ADIDAS ADIPOWER CTRL MTW PRO EDT 2025") so the
  // generated prose says "Adidas Adipower Ctrl MTW Pro EDT 2025" instead of the
  // duplicated all-caps feed string — this text is what gets indexed.
  const racket = {
    ...racketInput,
    model: formatRacketDisplayName(racketInput.brand, racketInput.model, racketInput.year),
  };

  const keywordHintBlock = keywordPhrases.length
    ? `Top real-world search queries users type when looking for this racket:
${keywordPhrases.map((k: string) => `- ${k}`).join("\n")}`
    : "";

  const racketInfo = `
Brand: ${racket.brand}
Model: ${racket.model}
Year: ${racket.year}
Shape: ${racket.shape}
Current Price: €${Number(racket.currentPrice).toFixed(2)}
${racket.originalPrice ? `Original Price: €${Number(racket.originalPrice).toFixed(2)}` : ""}
Performance Ratings (0-100):
- Power Rating: ${racket.powerRating}/100
- Control Rating: ${racket.controlRating}/100
- Rebound Rating: ${racket.reboundRating}/100
- Maneuverability Rating: ${racket.maneuverabilityRating}/100
- Sweet Spot Rating: ${racket.sweetSpotRating}/100
- Overall Rating: ${racket.overallRating}/100
Specifications:
${racket.color ? `- Color: ${racket.color}` : ""}
${racket.balance ? `- Balance: ${racket.balance}` : ""}
${racket.surface ? `- Surface: ${racket.surface}` : ""}
${racket.hardness ? `- Hardness: ${racket.hardness}` : ""}
${racket.finish ? `- Finish: ${racket.finish}` : ""}
${racket.core ? `- Core: ${racket.core}` : ""}
${racket.gameLevel ? `- Game Level: ${racket.gameLevel}` : ""}
${racket.gameType ? `- Game Type: ${racket.gameType}` : ""}
${racket.player ? `- Player: ${racket.player}` : ""}
${racket.product ? `- Product: ${racket.product}` : ""}
${racket.format ? `- Format: ${racket.format}` : ""}
${racket.playersCollection ? `- Players Collection: ${racket.playersCollection}` : ""}

${racket.researchBrief ? `ONLINE RESEARCH / SENTIMENT:\n${racket.researchBrief}\n` : ''}
${keywordHintBlock ? `\nKEYWORD RESEARCH INSIGHTS (for SEO, not to be shown as a list, but woven naturally into the prose):\n${keywordHintBlock}\n` : ""}
`;

    const systemPrompt = buildReviewTemplate(racket, racketInfo, options);

    const userPrompt = `Write the review now. Use the specs below.

Absolute prohibitions:
1. NO GENERIC PADEL EXPLANATIONS. ONLY talk about the ${racket.brand} ${racket.model}.
2. NO banned filler phrases (see system prompt).
3. NO citing a rating number as proof of itself.
4. Every performance claim needs a real padel scenario behind it.
5. All 9 sections must be present. "Quick Verdict" is 40-60 words; every other section at least 140 words.

Specs:
${racketInfo}

Output ONLY the 9 required HTML sections. No markdown wrapping. No preamble.`;

  return { system: systemPrompt, user: userPrompt };
}

/**
 * Strip markdown fences / stray markdown headings from a generated review.
 * Shared by live and batch pipelines.
 */
export function cleanGeneratedReviewHtml(raw: string): string {
  let reviewContent = raw.trim();

  const codeBlockStartPattern = /^```(?:html)?\s*\n?/;
  if (codeBlockStartPattern.test(reviewContent)) {
    reviewContent = reviewContent.replace(codeBlockStartPattern, '');
  }
  const codeBlockEndPattern = /\n?```\s*$/;
  if (codeBlockEndPattern.test(reviewContent)) {
    reviewContent = reviewContent.replace(codeBlockEndPattern, '');
  }
  reviewContent = reviewContent
    .replace(/^```html\s*\n?/gm, '')
    .replace(/^```\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim();

  reviewContent = reviewContent.replace(/\n{3,}/g, '\n\n');

  return reviewContent
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
}

export async function generateRacketReview(
  racket: Racket,
  options: ReviewGenerationOptions = {},
): Promise<ReviewGenerationResult | null> {
  if (!anthropic) {
    console.warn("OpenAI client not initialized. Skipping review generation.");
    return null;
  }

  try {
    const originalRacket = racket;
    // Use pre-fetched keywords from research if available, otherwise fall back to separate call
    const keywordPhrases = options.keywords?.length
      ? options.keywords
      : await researchRacketKeywords(racket.brand, racket.model);

    const prompts = buildReviewGenerationPrompts(racket, options, keywordPhrases);
    const result = await claudeText({
      model: OPENAI_MODEL,
      system: prompts.system,
      user: prompts.user,
      maxTokens: 12000, // review text + adaptive thinking headroom
      timeoutMs: 300000, // 5 minute hard timeout for large review generation
    });

    let reviewContent = result?.text || "";

    if (!reviewContent) {
      console.error("Failed to generate review content");
      return null;
    }
    if (result?.stopReason === "max_tokens") {
      console.warn("Review generation hit max_tokens — output may be truncated.");
    }

    reviewContent = cleanGeneratedReviewHtml(reviewContent);

    // Try to extract ratings from the review if they're mentioned, otherwise use existing ratings
    // For now, we'll use the existing ratings from the racket
    const ratings = {
      powerRating: racket.powerRating,
      controlRating: racket.controlRating,
      reboundRating: racket.reboundRating,
      maneuverabilityRating: racket.maneuverabilityRating,
      sweetSpotRating: racket.sweetSpotRating,
      overallRating: racket.overallRating,
    };

    const localesToTranslate = resolveReviewLocales(options);
    if (reviewContent && localesToTranslate.length) {
      try {
        await translateReviewLocales(originalRacket, localesToTranslate, reviewContent);
      } catch (translationError) {
        console.error("Error translating review content:", translationError);
      }
    }

    return {
      reviewContent,
      ratings,
    };
  } catch (error) {
    console.error("Error generating review with Claude:", error);
    return null;
  }
}

/**
 * Generate a unique brand article based on the brand's rackets and characteristics.
 */
export async function generateBrandArticle(
  brand: { name: string; description?: string | null },
  rackets: Array<{ model: string; year: number; shape: string; overallRating: number; currentPrice: string; powerRating: number; controlRating: number; gameLevel?: string | null; gameType?: string | null }>,
): Promise<string | null> {
  if (!anthropic) {
    console.warn("OpenAI not available, skipping brand article generation");
    return null;
  }

  const racketSummaries = rackets.slice(0, 10).map((r) =>
    `- ${brand.name} ${r.model} (${r.year}): ${r.shape} shape, overall ${r.overallRating}/100, power ${r.powerRating}, control ${r.controlRating}, €${Number(r.currentPrice).toFixed(2)}${r.gameLevel ? `, ${r.gameLevel} level` : ""}${r.gameType ? `, ${r.gameType} style` : ""}`
  ).join("\n");

  const systemPrompt = `You are a padel equipment journalist writing a brand profile article for a racket review website. Write in a knowledgeable, engaging style. Use HTML formatting with h2 and h3 headings, p tags for paragraphs, and ul/li for lists. Do NOT use h1 tags. The article should be 600-900 words.`;

  const userPrompt = `Write a unique brand article about ${brand.name} padel rackets.

${brand.description ? `Brand description: ${brand.description}` : ""}

Current ${brand.name} rackets in our database:
${racketSummaries || "No rackets available yet."}

Article structure:
1. Opening paragraph about ${brand.name}'s position in the padel world
2. "Technology & Innovation" - what makes their rackets distinctive (materials, construction, unique features)
3. "Product Line Overview" - analyze their range based on the actual rackets listed above (shapes, price range, who each targets)
4. "Who Should Choose ${brand.name}?" - specific player profiles that benefit from this brand
5. Brief conclusion with a recommendation

Important:
- Base your analysis on the actual racket data provided
- Reference specific models by name when discussing the product line
- Avoid generic filler content - be specific about this brand
- Do NOT include any links or URLs
- Output clean HTML only`;

  try {
    const result = await claudeText({
      model: OPENAI_MODEL,
      system: systemPrompt,
      user: userPrompt,
      maxTokens: 5000, // article + adaptive thinking headroom
      timeoutMs: 180000,
    });

    const content = result?.text;
    if (!content) return null;

    // Clean up any markdown code fences
    return content.replace(/```html\n?/g, "").replace(/```\n?/g, "").trim();
  } catch (error) {
    console.error(`Error generating brand article for ${brand.name}:`, error);
    return null;
  }
}

/**
 * Build the {system, user} prompt pair for a translation batch request.
 * Mirrors translateTextBatch's live prompts. Shared by live and batch pipelines.
 */
export function buildTranslationPrompts(
  items: TranslationBatchItem[],
  targetLocale: string,
  sourceLocale = "en",
): { system: string; user: string } {
  const localeGuidance: Record<string, string> = {
    es: "Use European Spanish (Spain). Use informal 'tú' form. Padel terminology: use 'pala' for racket, 'pista' for court. Keep brand/model names untranslated.",
    pt: "Use European Portuguese (Portugal). Use formal 'você' form. Padel terminology: use 'raquete' for racket. Keep brand/model names untranslated.",
    it: "Use standard Italian. Use informal 'tu' form. Padel terminology: use 'racchetta' for racket, 'campo' for court. Keep brand/model names untranslated.",
    fr: "Use standard French. Use informal 'tu' form. Padel terminology: use 'raquette' for racket, 'terrain' for court. Keep brand/model names untranslated.",
  };
  const localeHint = localeGuidance[targetLocale] || "";
  const system = `You are a professional localization specialist for a padel racket review website. Translate content from ${sourceLocale.toUpperCase()} to ${targetLocale.toUpperCase()} while preserving meaning, tone, HTML tags, and placeholders such as {{variable}} or {variable}. Respond ONLY with valid JSON.${localeHint ? `\n\nLocale-specific guidance: ${localeHint}` : ""}`;

  const payload = {
    instructions: [
      "Return a JSON object where each key matches the provided id and each value is the translated string.",
      "CRITICAL: The value must be a plain string, NOT an object.",
      "Do NOT translate or return the context fields.",
      "Do not include additional commentary or formatting.",
      "Preserve placeholders exactly as they appear ({{variable}}).",
      "If HTML tags are present, keep them unchanged and in the same order.",
      "Use the provided context notes to keep nuance (e.g., headlines vs paragraphs).",
      "Use sentence casing consistent with native speakers.",
      "Ensure the translation reads naturally to a native speaker - avoid overly literal translations.",
      "Keep padel-specific technical terms accurate for the target locale.",
    ],
    sourceLocale,
    targetLocale,
    entries: items.map((item) => ({
      id: item.key,
      text_to_translate: item.text,
      context: item.context ?? "",
    })),
  };

  const user = `Translate the text_to_translate fields in the following entries.\n\nInput:\n${JSON.stringify(payload, null, 2)}\n\nCRITICAL: You MUST return ONLY a JSON object of this EXACT shape (do not include context fields in the output):\n{\n  "translations": {\n    "id_1": "translated text for id_1",\n    "id_2": "translated text for id_2"\n  }\n}`;
  return { system, user };
}

/** Parse the translation model's JSON output. Returns null on shape mismatch. */
export function parseTranslationResponse(raw: string): Record<string, string> | null {
  try {
    const content = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || typeof parsed.translations !== "object") return null;
    return parsed.translations as Record<string, string>;
  } catch {
    return null;
  }
}

export async function translateTextBatch(
  items: TranslationBatchItem[],
  targetLocale: string,
  options: TranslationBatchOptions = {},
): Promise<Record<string, string>> {
  if (!anthropic) {
    throw new Error("Anthropic client not initialized. Set ANTHROPIC_API_KEY to enable translations.");
  }

  if (!items.length) {
    return {};
  }

  const sourceLocale = options.sourceLocale ?? "en";

  const localeGuidance: Record<string, string> = {
    es: "Use European Spanish (Spain). Use informal 'tú' form. Padel terminology: use 'pala' for racket, 'pista' for court. Keep brand/model names untranslated.",
    pt: "Use European Portuguese (Portugal). Use formal 'você' form. Padel terminology: use 'raquete' for racket. Keep brand/model names untranslated.",
    it: "Use standard Italian. Use informal 'tu' form. Padel terminology: use 'racchetta' for racket, 'campo' for court. Keep brand/model names untranslated.",
    fr: "Use standard French. Use informal 'tu' form. Padel terminology: use 'raquette' for racket, 'terrain' for court. Keep brand/model names untranslated.",
  };

  const localeHint = localeGuidance[targetLocale] || "";

  const systemPrompt = `You are a professional localization specialist for a padel racket review website. Translate content from ${sourceLocale.toUpperCase()} to ${targetLocale.toUpperCase()} while preserving meaning, tone, HTML tags, and placeholders such as {{variable}} or {variable}. Respond ONLY with valid JSON.${localeHint ? `\n\nLocale-specific guidance: ${localeHint}` : ""}`;

  const payload = {
    instructions: [
      "Return a JSON object where each key matches the provided id and each value is the translated string.",
      "CRITICAL: The value must be a plain string, NOT an object.",
      "Do NOT translate or return the context fields.",
      "Do not include additional commentary or formatting.",
      "Preserve placeholders exactly as they appear ({{variable}}).",
      "If HTML tags are present, keep them unchanged and in the same order.",
      "Use the provided context notes to keep nuance (e.g., headlines vs paragraphs).",
      "Use sentence casing consistent with native speakers.",
      "Ensure the translation reads naturally to a native speaker - avoid overly literal translations.",
      "Keep padel-specific technical terms accurate for the target locale.",
    ],
    sourceLocale,
    targetLocale,
    entries: items.map((item) => ({
      id: item.key,
      text_to_translate: item.text,
      context: item.context ?? "",
    })),
  };

  let retries = 0;
  const maxRetries = 2;

  while (retries <= maxRetries) {
    try {
      const result = await claudeText({
        model: OPENAI_TRANSLATION_MODEL,
        system: systemPrompt,
        user: `Translate the text_to_translate fields in the following entries.\n\nInput:\n${JSON.stringify(payload, null, 2)}\n\nCRITICAL: You MUST return ONLY a JSON object of this EXACT shape (do not include context fields in the output):\n{\n  "translations": {\n    "id_1": "translated text for id_1",\n    "id_2": "translated text for id_2"\n  }\n}`,
        maxTokens: 12000,
        temperature: 0.1, // Haiku 4.5 accepts sampling params
        timeoutMs: 120000, // 2 minute hard timeout for batch translations
      });

      // Detect truncation before attempting to parse
      if (result?.stopReason === "max_tokens") {
        console.warn(`Translation output truncated (stop_reason=max_tokens) for ${targetLocale}. Batch too large.`);
        throw new Error(`Translation truncated for ${targetLocale}: output exceeded max_tokens. Reduce batch size or increase max_tokens.`);
      }

      let content = result?.text?.trim();

      if (!content) {
        throw new Error("Claude returned an empty translation response.");
      }

      content = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== "object" || typeof parsed.translations !== "object") {
        throw new Error("Unexpected translation payload shape.");
      }
      return parsed.translations as Record<string, string>;
    } catch (error) {
      console.error(`[Attempt ${retries + 1}/${maxRetries + 1}] Failed to translate/parse response for ${targetLocale}:`, error instanceof Error ? error.message : String(error));

      retries++;
      if (retries > maxRetries) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retries - 1)));
    }
  }

  return {};
}


