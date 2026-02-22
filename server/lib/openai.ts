import OpenAI from "openai";
import type { Racket } from "@shared/schema";
import { upsertTranslation } from "./i18n.js";

// Support both OpenRouter_API_Key (preferred) and OPENAI_API_KEY (fallback) for compatibility
const API_KEY = process.env.OpenRouter_API_Key || process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.warn("Warning: OpenRouter_API_Key or OPENAI_API_KEY not set. Review generation will be disabled.");
}

// Configurable models for the OpenRouter pipeline
// We use Claude 3.5 Sonnet for writing the review and estimating ratings by default
// Model docs: https://openrouter.ai/anthropic/claude-3.5-sonnet
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "anthropic/claude-sonnet-4.5";
// We use Gemini 2.5 Flash for reliable translations (lite was too weak for long HTML in JSON)
export const OPENAI_TRANSLATION_MODEL = process.env.OPENAI_TRANSLATION_MODEL || "google/gemini-2.5-flash";
// We use Perplexity Sonar for research tasks (latest model optimized for search on OpenRouter)
export const OPENAI_RESEARCH_MODEL = process.env.OPENAI_RESEARCH_MODEL || "perplexity/sonar";

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
      "HTTP-Referer": "http://localhost:5000",
      "X-Title": "Racket Review Hub"
    }
  })
  : null;

export const isOpenAIConfigured = Boolean(openai && API_KEY);

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

  // Core sections that always appear (but with varied instructions)
  const introSection = `<h2>Introduction</h2>
<p>Write a 2-3 paragraph introduction that opens with a hook sentence about what makes this racket distinctive on court — NOT with the price, NOT with a list of specs. Lead with a strong opinion or observation from testing. Then cover: what kind of player StarVie/this brand built it for, what makes this specific model stand out in the ${racket.year || "current"} lineup, and confirm that we tested it on court. Reference actual specs naturally (${shape} shape, ${racket.balance || ""} balance) as part of the narrative, not as a bullet list. End the intro with a single teaser sentence about what surprised us most during testing.</p>`;

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
<h3>Spin and Control (Viboras & Bandjeas)</h3>
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
    ? `<h2>How It Compares</h2>
<p>Provide an authoritative market comparison. Discuss where this racket sits in the ${racket.brand} lineup and the broader ${tier} market segment. You MUST directly compare it against these specific alternatives: ${options.competitors.join(", ")}. What does THIS racket do better than its direct competitors? What might competing options do better?</p>`
    : `<h2>How It Compares</h2>
<p>Provide an authoritative market comparison. Discuss where this racket sits within the broader ${tier} market segment. You MUST name 1 or 2 specific equivalent rackets from other major brands that an online shopper might also be considering. What does THIS racket do better than its direct competitors?</p>`;

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
- Keep keyword usage natural and readable – never repeat phrases unnaturally just for SEO.`;

  return `You are an expert, highly opinionated padel racket reviewer writing for an enthusiast audience. Write a unique, focused review article using ONLY the HTML structure provided below.

CRITICAL DIRECTIVE: You MUST ONLY talk about THIS specific racket (${racket.brand} ${racket.model}). 
ABSOLUTELY NO GENERIC PADEL EDUCATION. Do NOT explain what racket shapes are. Do NOT explain what weight categories are. Do NOT explain what different core foams mean. Your audience already knows how to play padel. If you include sections like "Understanding Padel Shapes", "Skill Level Recommendations", or "Maintenance Tips", YOU HAVE FAILED.

You must output EXACTLY these 8 sections, utilizing the provided HTML structure.

${seoGuidance}

${introSection}

${performanceSection}

${prosConsSection}

${technologySection}

${levelSection}

${comparisonSection}

${faqSection}

${conclusionSection}

WRITING QUALITY REQUIREMENTS:
- Each of the 8 sections must be substantive. Aim for at least 120 words per section.
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
- "we were keen to see", "we were excited to", "we were struck by", "we were eager to"
- "making it a great choice for players who value these features"
- "help them take their game to the next level"
- "does not disappoint", "lives up to its reputation" (unless followed immediately by a specific why)
- "reveals its true character across different court positions"
- Starting consecutive sentences with "The [spec]..."
- Starting a sentence with a rating number like "The 85/100..."
- Ending sections with generic summaries that repeat the intro sentence

CRITICAL HTML FORMATTING REQUIREMENTS:
- Use <h2> tags for the 8 section headings listed above ONLY. DO NOT invent new <h2> headings.
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
  keywords?: string[];
}

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
  if (!openai) {
    console.warn("OpenAI client not initialized. Using default/empty research.");
    return null;
  }

  try {
    const prompt = `You are a padel research assistant. Your job is to search the web for the specifications and general sentiment of a specific padel racket.
    
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

    const completion = await openai.chat.completions.create({
      model: OPENAI_RESEARCH_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temp for facts
      max_tokens: 1200,
    }, { timeout: 30000 }); // 30 second hard timeout

    let content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      console.error("Failed to get research from OpenRouter");
      return null;
    }

    content = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    return JSON.parse(content) as RacketResearch;
  } catch (error) {
    console.error("Error performing research with OpenRouter:", error);
    return null;
  }
}

// Optional keyword research helper to inform SEO-focused review generation.
// Uses the research model to discover common search queries for a given racket.
async function researchRacketKeywords(brand: string, model: string): Promise<string[]> {
  if (!openai) {
    return [];
  }

  try {
    const prompt = `You are an SEO assistant. Find the MOST COMMON search queries users type into Google and Bing for: ${brand} ${model} padel racket.

CRITICAL: Return ONLY a valid JSON array of strings. No explanations, no markdown, no other text. Example format:
["query 1", "query 2", "query 3"]

Return up to 10 common search queries as a JSON array.`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_RESEARCH_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a JSON-only API. Always return valid JSON arrays, never natural language.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 400,
    }, { timeout: 30000 });

    let content = completion.choices[0]?.message?.content?.trim();
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
  if (!openai) {
    console.warn("OpenAI client not initialized. Using default ratings.");
    return null;
  }

  try {
    const prompt = `You are a padel racket expert. Based on the following racket characteristics, estimate performance ratings on a scale of 0-100.

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

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 200,
    }, { timeout: 45000 }); // 45 second hard timeout

    let content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      console.error("Failed to get rating estimation from OpenAI");
      return null;
    }

    // Clean up response - remove markdown code blocks if present
    content = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const ratings = JSON.parse(content) as RacketRatings;

    // Validate ratings are within bounds
    const validateRating = (value: number): number => {
      return Math.max(0, Math.min(100, Math.round(value)));
    };

    return {
      powerRating: validateRating(ratings.powerRating),
      controlRating: validateRating(ratings.controlRating),
      reboundRating: validateRating(ratings.reboundRating),
      maneuverabilityRating: validateRating(ratings.maneuverabilityRating),
      sweetSpotRating: validateRating(ratings.sweetSpotRating),
      overallRating: validateRating(ratings.overallRating || Math.round(
        (ratings.powerRating +
          ratings.controlRating +
          ratings.reboundRating +
          ratings.maneuverabilityRating +
          ratings.sweetSpotRating) / 5
      )), // Fallback to average if not provided
    };
  } catch (error) {
    console.error("Error estimating ratings with OpenAI:", error);
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

export async function generateRacketReview(
  racket: Racket,
  options: ReviewGenerationOptions = {},
): Promise<ReviewGenerationResult | null> {
  if (!openai) {
    console.warn("OpenAI client not initialized. Skipping review generation.");
    return null;
  }

  try {
    // Build racket information string with all specifications and ratings
    // Use pre-fetched keywords from research if available, otherwise fall back to separate call
    const keywordPhrases = options.keywords?.length
      ? options.keywords
      : await researchRacketKeywords(racket.brand, racket.model);
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
5. All 8 sections must be present and each at least 120 words long.

Specs:
${racketInfo}

Output ONLY the 8 required HTML sections. No markdown wrapping. No preamble.`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 8000,
    }, { timeout: 180000 }); // 3 minute hard timeout for large review generation

    let reviewContent = completion.choices[0]?.message?.content || "";

    if (!reviewContent) {
      console.error("Failed to generate review content");
      return null;
    }

    // Strip markdown code blocks if present (```html ... ``` or ``` ... ```)
    // Handle various formats: ```html, ```, or code blocks at start/end
    reviewContent = reviewContent.trim();

    // Remove code blocks at the beginning - handle multiple formats
    const codeBlockStartPattern = /^```(?:html)?\s*\n?/;
    if (codeBlockStartPattern.test(reviewContent)) {
      reviewContent = reviewContent.replace(codeBlockStartPattern, '');
    }

    // Remove code blocks at the end - handle multiple formats
    const codeBlockEndPattern = /\n?```\s*$/;
    if (codeBlockEndPattern.test(reviewContent)) {
      reviewContent = reviewContent.replace(codeBlockEndPattern, '');
    }

    // Also handle code block markers at start of lines (multiline)
    reviewContent = reviewContent
      .replace(/^```html\s*\n?/gm, '')  // Remove opening ```html at start of lines
      .replace(/^```\s*\n?/gm, '')      // Remove opening ``` at start of lines
      .replace(/\n?```\s*$/gm, '')      // Remove closing ``` at end of lines
      .trim();

    // Clean up any excessive newlines that might have been created
    reviewContent = reviewContent.replace(/\n{3,}/g, '\n\n');

    // Convert any remaining markdown headings that slipped through
    reviewContent = reviewContent
      .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
      .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');

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
        await translateReviewLocales(racket, localesToTranslate, reviewContent);
      } catch (translationError) {
        console.error("Error translating review content:", translationError);
      }
    }

    return {
      reviewContent,
      ratings,
    };
  } catch (error) {
    console.error("Error generating review with OpenAI:", error);
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
  if (!openai) {
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
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    // Clean up any markdown code fences
    return content.replace(/```html\n?/g, "").replace(/```\n?/g, "").trim();
  } catch (error) {
    console.error(`Error generating brand article for ${brand.name}:`, error);
    return null;
  }
}

export async function translateTextBatch(
  items: TranslationBatchItem[],
  targetLocale: string,
  options: TranslationBatchOptions = {},
): Promise<Record<string, string>> {
  if (!openai) {
    throw new Error("OpenAI client not initialized. Set OpenRouter_API_Key or OPENAI_API_KEY to enable translations.");
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

  const completion = await openai.chat.completions.create({
    model: OPENAI_TRANSLATION_MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Translate the text_to_translate fields in the following entries.\n\nInput:\n${JSON.stringify(payload, null, 2)}\n\nCRITICAL: You MUST return ONLY a JSON object of this EXACT shape (do not include context fields in the output):\n{\n  "translations": {\n    "id_1": "translated text for id_1",\n    "id_2": "translated text for id_2"\n  }\n}`,
      },
    ],
    max_tokens: 12000,
  }, { timeout: 120000 }); // 2 minute hard timeout for batch translations

  // Detect truncation before attempting to parse
  const finishReason = completion.choices[0]?.finish_reason;
  if (finishReason === "length") {
    console.warn(`Translation output truncated (finish_reason=length) for ${targetLocale}. Batch too large.`);
    throw new Error(`Translation truncated for ${targetLocale}: output exceeded max_tokens. Reduce batch size or increase max_tokens.`);
  }

  let content = completion.choices[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("OpenAI returned an empty translation response.");
  }

  content = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || typeof parsed.translations !== "object") {
      throw new Error("Unexpected translation payload shape.");
    }
    return parsed.translations as Record<string, string>;
  } catch (error) {
    console.error("Failed to parse translation response:", content);
    throw error;
  }
}


