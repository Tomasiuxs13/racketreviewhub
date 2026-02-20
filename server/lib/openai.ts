import OpenAI from "openai";
import type { Racket } from "@shared/schema";
import { upsertTranslation } from "./i18n.js";

if (!process.env.OPENAI_API_KEY) {
  console.warn("Warning: OPENAI_API_KEY not set. Review generation will be disabled.");
}

// Configurable models for the OpenRouter pipeline
// We use Llama 3.3 for writing the review (latest and smartest open weights model)
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "meta-llama/llama-3.3-70b-instruct";
// We use a fast/cheap model for translation and rating arrays (Llama 3.1 8B)
export const OPENAI_TRANSLATION_MODEL = process.env.OPENAI_TRANSLATION_MODEL || "meta-llama/llama-3.1-8b-instruct";
// We use Perplexity Sonar for research tasks (latest model optimized for search on OpenRouter)
export const OPENAI_RESEARCH_MODEL = process.env.OPENAI_RESEARCH_MODEL || "perplexity/sonar";

const REVIEW_TRANSLATION_MAX_SECTIONS_PER_BATCH = 10;
const REVIEW_TRANSLATION_MAX_CHARS_PER_BATCH = 4000;

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

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENAI_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:5000",
      "X-Title": "Racket Review Hub"
    }
  })
  : null;

export const isOpenAIConfigured = Boolean(openai);

const DEFAULT_REVIEW_TRANSLATION_LOCALES = ["es", "pt", "it", "fr"];

const configuredReviewLocales = (process.env.REVIEW_TRANSLATION_LOCALES ?? DEFAULT_REVIEW_TRANSLATION_LOCALES.join(","))
  .split(",")
  .map((locale) => locale.trim().toLowerCase())
  .filter((locale) => locale && locale !== "en");

export const REVIEW_TRANSLATION_LOCALES = configuredReviewLocales;

// Dynamic review template builder - generates different templates based on racket characteristics
// to avoid duplicate content across 1000+ rackets
function buildReviewTemplate(racket: Partial<Racket>, options?: ReviewGenerationOptions): string {
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
<p>Write an engaging, unique introduction for this specific racket from a first-person perspective ("we", "our team"). Mention the brand heritage, what makes this model stand out in the ${racket.year || "current"} lineup. Most importantly, explicitly state that we took this racket to the court and tested it. Be specific - reference actual specs like its ${shape} shape${racket.balance ? ` and ${racket.balance} balance` : ""}.</p>`;

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

  // Level-specific section
  const levelSection = isAdvanced
    ? `<h2>Advanced Player Perspective</h2>
<p>Analyze this racket from an experienced player's viewpoint. Discuss how it handles at high-level play: spin generation, volley response, smash power, and consistency during intense rallies. Compare the feel to what advanced players typically expect from a top-tier ${shape}-shaped racket.</p>`
    : `<h2>Who Should Buy This Racket?</h2>
<p>Provide our honest assessment of the ideal player profile for this racket. Consider skill level, physical attributes, playing frequency, and style preferences. Be highly specific about who will love it and who should look elsewhere (e.g., "Skip this if you rely heavily on flat power").</p>`;

  // Competitor context (always unique per racket)
  const comparisonSection = options?.competitors?.length
    ? `<h2>How It Compares</h2>
<p>Provide an authoritative market comparison. Discuss where this racket sits in the ${racket.brand} lineup and the broader ${tier} market segment. You MUST directly compare it against these specific alternatives: ${options.competitors.join(", ")}. What does this racket do better than its direct competitors? What might competing options do better?</p>`
    : `<h2>How It Compares</h2>
<p>Provide an authoritative market comparison. Discuss where this racket sits in the ${racket.brand} lineup and the broader ${tier} market segment. You MUST name 1 or 2 specific equivalent rackets from other major brands that an online shopper might also be considering. What does this racket do better than its direct competitors? What might competing options do better?</p>`;

  const conclusionSection = `<h2>Final Verdict</h2>
<p>Give a decisive, highly opinionated final verdict based on our time with the racket. State clearly whether we recommend this racket and for whom. Summarize the 2-3 most important takeaways. End with a definitive "Buy it if..." and "Skip it if..." statement.</p>`;

  return `You are an expert padel racket reviewer writing for an enthusiast audience. Write a unique, insightful review article using HTML formatting.

IMPORTANT: Every review must be genuinely different. Do NOT use generic padel education content. Focus entirely on THIS specific racket's characteristics and how they translate to real-world performance.

Required sections (use this exact HTML structure):

${introSection}

${performanceSection}

${prosConsSection}

${technologySection}

${levelSection}

${comparisonSection}

${conclusionSection}

CRITICAL HTML FORMATTING REQUIREMENTS:
- Use <h2> tags for ALL section headings
- Use <h3> tags for Pros and Cons / Performance subsections
- Use <p> tags for ALL paragraph text
- Use <ul> and <li> tags for ALL bullet lists
- Use <strong> tags to emphasize key terms
- DO NOT use markdown formatting - ONLY HTML tags
- DO NOT wrap output in code blocks
- Output should start with <h2> and end with </p>
- Write at least 2-3 paragraphs per section, not just one sentence
- Speak in the first person plural ("we", "our"). Represent the voice of expert padel testers.
- Be highly specific and opinionated - NEVER use wishy-washy generic statements.`;
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
  "commonComplaints": ["complaint 1 (e.g. paint chips easily, head heavy)", "complaint 2 (e.g. handle too short)"]
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
      max_tokens: 500,
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
      temperature: 0.3,
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
`;

    const systemPrompt = buildReviewTemplate(racket, options);

    const userPrompt = `Write a unique, in-depth review for the following padel racket. Follow the HTML structure from the system prompt exactly. Base your review on the actual specifications below - do NOT invent specs or use generic filler content.

If "ONLINE RESEARCH / SENTIMENT" is provided below, you MUST heavily incorporate those findings into your review. Use the real-world sentiment to explain the pros/cons and write an accurate description of how it feels on court.

${racketInfo}

CRITICAL FORMATTING:
- Use ONLY HTML tags (<h2>, <h3>, <p>, <ul>, <li>, <strong>) - NO markdown
- DO NOT wrap output in code blocks
- Write 2-3 substantial paragraphs per section minimum
- Be specific to THIS racket - reference its actual specs, ratings, research, and characteristics
- Offer genuine opinions and recommendations, not generic padel advice`;

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
      temperature: 0.7,
      max_tokens: 6000,
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

    // Post-process to ensure HTML formatting if ChatGPT didn't follow instructions
    // Check if content already has HTML tags
    const hasHtmlTags = reviewContent.includes('<h2>') || reviewContent.includes('<p>') || reviewContent.includes('<ul>');

    if (!hasHtmlTags) {
      console.log('Review content missing HTML tags, converting from plain text...');

      // Split into lines and process
      const lines = reviewContent.split('\n');
      const processed: string[] = [];
      let currentList: string[] = [];
      let inList = false;

      // Known section headings
      const sectionHeadings = [
        'Introduction',
        'Understanding Padel Racket Shapes',
        'Pros and Cons',
        'Weight Considerations',
        'Balance Point',
        'Materials and Construction',
        'Skill Level Recommendations',
        'Price Ranges',
        'Key Factors to Consider',
        'Common Mistakes to Avoid',
        'Where to Buy',
        'Maintenance Tips',
        'Conclusion'
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line) {
          // Close any open list before empty line
          if (inList && currentList.length > 0) {
            processed.push('<ul>');
            processed.push(...currentList);
            processed.push('</ul>');
            currentList = [];
            inList = false;
          }
          processed.push('');
          continue;
        }

        // Check if it's a section heading
        const isHeading = sectionHeadings.some(heading =>
          line === heading || line.startsWith(heading)
        );

        // Check if it's a Pros/Cons subheading
        const isSubHeading = line === 'Pros' || line === 'Cons';

        // Check if it's a bullet point (starts with dash or similar)
        const isBullet = /^[-•*]\s+/.test(line) || /^\d+\.\s+/.test(line);

        if (isHeading) {
          // Close any open list
          if (inList && currentList.length > 0) {
            processed.push('<ul>');
            processed.push(...currentList);
            processed.push('</ul>');
            currentList = [];
            inList = false;
          }
          processed.push(`<h2>${line}</h2>`);
        } else if (isSubHeading) {
          // Close any open list
          if (inList && currentList.length > 0) {
            processed.push('<ul>');
            processed.push(...currentList);
            processed.push('</ul>');
            currentList = [];
            inList = false;
          }
          processed.push(`<h3>${line}</h3>`);
        } else if (isBullet) {
          // Add to current list
          const bulletText = line.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, '');
          // Check if it has strong formatting (text: description)
          if (bulletText.includes(':')) {
            const [key, ...valueParts] = bulletText.split(':');
            const value = valueParts.join(':').trim();
            currentList.push(`<li><strong>${key.trim()}:</strong> ${value}</li>`);
          } else {
            currentList.push(`<li>${bulletText}</li>`);
          }
          inList = true;
        } else {
          // Regular paragraph
          // Close any open list first
          if (inList && currentList.length > 0) {
            processed.push('<ul>');
            processed.push(...currentList);
            processed.push('</ul>');
            currentList = [];
            inList = false;
          }
          processed.push(`<p>${line}</p>`);
        }
      }

      // Close any remaining list
      if (inList && currentList.length > 0) {
        processed.push('<ul>');
        processed.push(...currentList);
        processed.push('</ul>');
      }

      reviewContent = processed.join('\n');
    } else {
      // Content has HTML but might need cleanup
      // Convert any remaining markdown headings
      reviewContent = reviewContent
        .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
        .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    }

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
    throw new Error("OpenAI client not initialized. Set OPENAI_API_KEY to enable translations.");
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
    max_tokens: 8000,
  }, { timeout: 120000 }); // 2 minute hard timeout for batch translations

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


