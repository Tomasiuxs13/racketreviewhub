import OpenAI from "openai";
import type { Racket } from "@shared/schema";
import { upsertTranslation } from "./i18n.js";

if (!process.env.OPENAI_API_KEY) {
  console.warn("Warning: OPENAI_API_KEY not set. Review generation will be disabled.");
}

const REVIEW_TRANSLATION_MAX_SECTIONS_PER_BATCH = 6;
const REVIEW_TRANSLATION_MAX_CHARS_PER_BATCH = 1800;

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
  if (!baseContent) {
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
      const translated = await translateReviewHtml(baseContent, locale);
      if (translated) {
        await upsertTranslation("racket_review", racket.id, locale, {
          reviewContent: translated,
        });
        results[locale] = translated;
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
    .map((section) => translations[section.id]?.trim() || section.text)
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
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

export const isOpenAIConfigured = Boolean(openai);

const DEFAULT_REVIEW_TRANSLATION_LOCALES = ["es", "pt", "it", "fr"];

const configuredReviewLocales = (process.env.REVIEW_TRANSLATION_LOCALES ?? DEFAULT_REVIEW_TRANSLATION_LOCALES.join(","))
  .split(",")
  .map((locale) => locale.trim().toLowerCase())
  .filter((locale) => locale && locale !== "en");

export const REVIEW_TRANSLATION_LOCALES = configuredReviewLocales;

const REVIEW_TEMPLATE = `You are a professional padel racket reviewer. Write a comprehensive review article for a padel racket following this EXACT HTML structure. You MUST use HTML tags and maintain this structure consistently:

<h2>Introduction</h2>
<p>Start with an engaging introduction about the racket, mentioning the brand and model. Explain who this racket is best suited for based on its characteristics.</p>

<h2>Understanding Padel Racket Shapes</h2>
<p>Explain the shape of this racket (round, teardrop, or diamond) and what that means for performance:</p>
<ul>
<li><strong>Round Shape:</strong> Best for beginners and control-focused players. Maximum control and precision, larger sweet spot, lower balance point, less power but more consistent shots.</li>
<li><strong>Teardrop Shape:</strong> Best for intermediate to advanced players seeking balance. Good mix of power and control, medium-sized sweet spot, versatile for all playing styles, medium balance point.</li>
<li><strong>Diamond Shape:</strong> Best for advanced players seeking maximum power. Maximum power generation, smaller sweet spot requires precision, high balance point for aggressive play, demanding on technique.</li>
</ul>

<h2>Pros and Cons</h2>
<p>Based on the racket's specifications and characteristics, analyze and list the key advantages and disadvantages:</p>
<h3>Pros</h3>
<ul>
<li>Analyze the racket's strengths based on its shape, balance point, materials, and performance ratings</li>
<li>Identify what player types will benefit most from these features</li>
<li>Highlight any standout features like power rating, control rating, or unique specifications</li>
<li>Mention value proposition if price is competitive</li>
<li>Note any technical advantages or innovative features</li>
</ul>
<h3>Cons</h3>
<ul>
<li>Identify weaknesses or limitations based on the racket's characteristics</li>
<li>Note who should avoid this racket (e.g., beginners for advanced rackets, or advanced players for beginner rackets)</li>
<li>Mention any compromises in design (e.g., power vs control trade-offs)</li>
<li>Consider physical demands or skill requirements</li>
<li>Note any missing features or areas where competitors might excel</li>
</ul>

<h2>Weight Considerations</h2>
<p>Discuss the weight characteristics of this racket and how it affects performance:</p>
<ul>
<li><strong>Light Rackets (350-360g):</strong> Easier to maneuver, less arm fatigue, good for beginners, generally less powerful.</li>
<li><strong>Medium Weight (360-370g):</strong> Balance between power and maneuverability, most versatile option, suitable for most players.</li>
<li><strong>Heavy Rackets (370-380g):</strong> More power on shots, better stability, requires more strength to control, best for advanced players.</li>
</ul>

<h2>Balance Point</h2>
<p>Explain the balance point of this racket:</p>
<ul>
<li><strong>Low Balance:</strong> Weight concentrated in handle. Better control and precision, easier maneuverability, less power, ideal for beginners and control players.</li>
<li><strong>Medium Balance:</strong> Weight distributed evenly. Balance between power and control, versatile performance, good for intermediate players.</li>
<li><strong>High Balance:</strong> Weight concentrated in head. Maximum power, more demanding to control, best for advanced players.</li>
</ul>

<h2>Materials and Construction</h2>
<p>Describe the materials and construction:</p>
<ul>
<li><strong>Frame Materials:</strong> Carbon Fiber (most common, excellent stiffness, responsiveness, durability), Fiberglass (less expensive, less responsive, entry-level).</li>
<li><strong>Core Types:</strong> EVA Soft (softer core, excellent comfort and control, great for beginners), EVA Medium (balanced core, mix of power and control), MultiEVA (advanced core system with different densities, power while maintaining control), Foam (softer than EVA, maximum comfort but less power).</li>
</ul>

<h2>Skill Level Recommendations</h2>
<p>Provide recommendations based on skill level:</p>
<ul>
<li><strong>Beginner Players:</strong> Round or teardrop shape, 350-365g weight, low to medium balance, EVA Soft core.</li>
<li><strong>Intermediate Players:</strong> Teardrop shape, 360-370g weight, medium balance, EVA Soft or Medium core.</li>
<li><strong>Advanced Players:</strong> Diamond or teardrop shape (depending on style), 365-380g weight, medium to high balance, MultiEVA or EVA Medium core.</li>
</ul>

<h2>Price Ranges</h2>
<p>Discuss the price point:</p>
<ul>
<li><strong>Budget (€100-€200):</strong> Entry-level rackets suitable for beginners.</li>
<li><strong>Mid-Range (€200-€300):</strong> Best value for most players. Carbon fiber frames, quality cores, good performance.</li>
<li><strong>Premium (€300+):</strong> Top-tier rackets with advanced materials and technologies. Best for serious players.</li>
</ul>

<h2>Key Factors to Consider</h2>
<p>List important factors:</p>
<ul>
<li><strong>Your Skill Level:</strong> Match the racket to your current ability</li>
<li><strong>Playing Style:</strong> Aggressive players may prefer power rackets, while control players should choose round or teardrop shapes</li>
<li><strong>Physical Condition:</strong> Players with arm issues should prioritize lighter, softer rackets</li>
<li><strong>Budget:</strong> Set a realistic budget and find the best racket within that range</li>
<li><strong>Try Before You Buy:</strong> If possible, test rackets before purchasing</li>
</ul>

<h2>Common Mistakes to Avoid</h2>
<p>List common mistakes:</p>
<ul>
<li><strong>Choosing a racket that's too advanced:</strong> Beginners should avoid diamond-shaped, high-balance rackets</li>
<li><strong>Focusing only on price:</strong> The cheapest option isn't always the best value</li>
<li><strong>Ignoring weight:</strong> A racket that's too heavy can cause arm fatigue and injury</li>
<li><strong>Not considering your playing style:</strong> Match the racket to how you actually play</li>
</ul>

<h2>Where to Buy</h2>
<p>Mention where to purchase this racket:</p>
<ul>
<li>Specialized padel retailers (online and physical stores)</li>
<li>Sports equipment stores</li>
<li>Online marketplaces (Amazon, etc.)</li>
<li>Brand websites</li>
</ul>
<p>Always check return policies and warranty information before purchasing.</p>

<h2>Maintenance Tips</h2>
<p>Provide maintenance advice:</p>
<ul>
<li>Store your racket in a protective cover when not in use</li>
<li>Avoid extreme temperatures</li>
<li>Clean the racket surface regularly</li>
<li>Replace the grip when it becomes worn</li>
<li>Check for cracks or damage regularly</li>
</ul>

<h2>Conclusion</h2>
<p>End with a strong conclusion summarizing the racket's strengths and who should consider it. Provide a clear recommendation based on the racket's characteristics.</p>

CRITICAL HTML FORMATTING REQUIREMENTS - YOU MUST FOLLOW THESE EXACTLY:
- Use <h2> tags for ALL section headings (Introduction, Understanding Padel Racket Shapes, Pros and Cons, Weight Considerations, etc.)
- Use <h3> tags for Pros and Cons subsections
- Use <p> tags for ALL paragraph text - wrap every paragraph in <p></p>
- Use <ul> and <li> tags for ALL bullet point lists - never use plain text with dashes
- Use <strong> tags to emphasize key terms within list items
- Maintain this EXACT structure and order for every review
- DO NOT use markdown formatting (##, -, *, etc.) - ONLY HTML tags
- DO NOT output plain text - every element must be wrapped in HTML tags
- Ensure consistent formatting across all sections

EXAMPLE OF CORRECT OUTPUT FORMAT:
<h2>Introduction</h2>
<p>Start with an engaging introduction about the racket, mentioning the brand and model.</p>
<h2>Pros and Cons</h2>
<h3>Pros</h3>
<ul>
<li><strong>Advantage 1:</strong> Description of advantage</li>
<li><strong>Advantage 2:</strong> Description of advantage</li>
</ul>
<h3>Cons</h3>
<ul>
<li><strong>Disadvantage 1:</strong> Description of disadvantage</li>
</ul>

REMEMBER: 
- Output ONLY HTML-formatted text, never plain text or markdown
- DO NOT wrap the output in markdown code blocks (three backticks with html or three backticks)
- Output the HTML directly without any code block markers
- The output should start with <h2> and end with </p> or </ul> tags`;

export interface ReviewGenerationResult {
  reviewContent: string;
  ratings?: {
    powerRating: number;
    controlRating: number;
    reboundRating: number;
    maneuverabilityRating: number;
    sweetSpotRating: number;
  };
}

export interface ReviewGenerationOptions {
  targetLocales?: string[];
  skipTranslations?: boolean;
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
`;

    const systemPrompt = REVIEW_TEMPLATE;

    const userPrompt = `Write a comprehensive review article for the following padel racket following the EXACT HTML structure provided in the system prompt. Use the racket information below to create a detailed, informative review:

${racketInfo}

CRITICAL: You MUST format the entire review using HTML tags:
- Use <h2> tags for section headings (Introduction, Understanding Padel Racket Shapes, Pros and Cons, etc.)
- Use <h3> tags for Pros and Cons subsections
- Use <p> tags for all paragraph text
- Use <ul> and <li> tags for ALL bullet point lists
- Use <strong> tags to emphasize key terms
- DO NOT use markdown (##, -, etc.) - ONLY HTML tags
- DO NOT wrap your output in markdown code blocks (three backticks with html or three backticks) - output the HTML directly
- The review should be specific to this racket model and include relevant details about its performance characteristics, target audience, and value proposition.

Example of correct formatting:
<h2>Introduction</h2>
<p>Your introduction paragraph here.</p>
<h2>Pros and Cons</h2>
<h3>Pros</h3>
<ul>
<li><strong>Advantage 1:</strong> Description</li>
<li><strong>Advantage 2:</strong> Description</li>
</ul>
<h3>Cons</h3>
<ul>
<li><strong>Disadvantage 1:</strong> Description</li>
</ul>`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
      max_tokens: 3000,
    });

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

  const systemPrompt = `You are a professional localization specialist for marketing sites and product interfaces. Translate content from ${sourceLocale.toUpperCase()} to ${targetLocale.toUpperCase()} while preserving meaning, tone, HTML tags, and placeholders such as {{variable}} or {variable}. Respond ONLY with valid JSON.`;

  const payload = {
    instructions: [
      "Return a JSON object where each key matches the provided id and each value is the translated string.",
      "Do not include additional commentary or formatting.",
      "Preserve placeholders exactly as they appear ({{variable}}).",
      "If HTML tags are present, keep them unchanged and in the same order.",
      "Use the provided context notes to keep nuance (e.g., headlines vs paragraphs).",
      "Use sentence casing consistent with native speakers.",
    ],
    sourceLocale,
    targetLocale,
    entries: items.map((item) => ({
      id: item.key,
      text: item.text,
      context: item.context ?? "",
    })),
  };

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Translate the following entries:\n${JSON.stringify(payload, null, 2)}\n\nReturn only JSON of the shape {"translations": {"key":"value"}}.`,
      },
    ],
    max_tokens: 2000,
  });

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


