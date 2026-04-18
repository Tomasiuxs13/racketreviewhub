import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Racket } from "@shared/schema"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Cleans review content by removing markdown code blocks (```html or ```)
 * This handles cases where AI-generated content includes code block markers
 */
export function cleanReviewContent(content: string): string {
  if (!content) return content;

  let cleaned = content.trim();

  // Remove code blocks at the beginning
  if (cleaned.startsWith('```html') || cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    if (lines[0]?.match(/^```(html)?\s*$/)) {
      lines.shift();
    }
    cleaned = lines.join('\n');
  }

  // Remove code blocks at the end
  if (cleaned.endsWith('```')) {
    const lines = cleaned.split('\n');
    if (lines[lines.length - 1]?.trim() === '```') {
      lines.pop();
    }
    cleaned = lines.join('\n');
  }

  // Remove any remaining code block markers
  cleaned = cleaned
    .replace(/^```html\s*\n?/gm, '')
    .replace(/^```\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim();

  // Enhance Pros and Cons styling by wrapping them in custom classes
  cleaned = cleaned.replace(
    /<h3>Pros<\/h3>\s*<ul>([\s\S]*?)<\/ul>/gi,
    '<div class="pro-con-card pro-card"><h3 class="flex items-center gap-2 mb-3"><svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>Pros</h3><ul class="space-y-2">$1</ul></div>'
  );
  cleaned = cleaned.replace(
    /<h3>Cons<\/h3>\s*<ul>([\s\S]*?)<\/ul>/gi,
    '<div class="pro-con-card con-card"><h3 class="flex items-center gap-2 mb-3"><svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>Cons</h3><ul class="space-y-2">$1</ul></div>'
  );

  // Group consecutive Pros and Cons cards into a grid layout
  cleaned = cleaned.replace(
    /(<div class="pro-con-card pro-card">[\s\S]*?<\/div>)\s*(<div class="pro-con-card con-card">[\s\S]*?<\/div>)/gi,
    '<div class="pros-cons-grid gap-6 grid grid-cols-1 md:grid-cols-2 my-8">$1$2</div>'
  );

  // Wrap FAQ section in a styled container
  cleaned = cleaned.replace(
    /(<h2>Frequently Asked Questions<\/h2>)([\s\S]*?)(?=<h2>|$)/gi,
    '<div class="review-faq">$1$2</div>'
  );

  // Wrap Final Verdict section in a styled container
  cleaned = cleaned.replace(
    /(<h2>Final Verdict<\/h2>)([\s\S]*?)(?=<h2>|$)/gi,
    '<div class="review-verdict">$1$2</div>'
  );

  // Clean up escaped quote artifacts from AI-generated content
  cleaned = cleaned.replace(/\\"/g, '"');

  return cleaned;
}

/**
 * Builds a URL-friendly slug for a racket based on brand and model.
 * Avoids duplicating brand name if model already includes it.
 * Example: "Nox" + "ML10 Pro Cup" -> "nox-ml10-pro-cup"
 * Example: "Adidas" + "ADIDAS METALBONE PRO" -> "adidas-metalbone-pro" (not "adidas-adidas-metalbone-pro")
 */
export function getRacketSlug(racket: Pick<Racket, "brand" | "model"> & { slug?: string | null }): string {
  // Prefer the stored slug (disambiguates year collisions, stable across brand/model edits)
  if (racket.slug) return racket.slug;

  const brandLower = racket.brand.toLowerCase();
  const modelLower = racket.model.toLowerCase();

  // Check if model already starts with the brand name
  const modelStartsWithBrand = modelLower.startsWith(brandLower);

  // If model includes brand, just use model; otherwise prepend brand
  const base = modelStartsWithBrand ? modelLower : `${brandLower} ${modelLower}`;

  return base
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Specific non-brand values that may appear in the source data
const NON_BRAND_VALUES = new Set([
  "Black, Grey",
  "Blue",
  "Overgrips, Padel Racket Protectors",
  "Overgrips, Padel Racket Protectors, Shockout Antivibrator",
  "Red",
]);

/**
 * Returns true if the given string looks like a valid brand name.
 * Used to filter out known non-brand values that might be present in the data.
 */
export function isValidBrandName(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = name.trim();
  if (!normalized) return false;
  return !NON_BRAND_VALUES.has(normalized);
}

/**
 * Returns an optimized image URL that points to our local Express Sharp proxy.
 * This converts external feed images to fast WebP format on the fly.
 */
export function getOptimizedImageUrl(rawUrl: string | null | undefined, width?: number): string {
  if (!rawUrl) return "";

  // If it's already a local asset, don't proxy it
  if (rawUrl.startsWith("/") && !rawUrl.startsWith("/api/")) {
    return rawUrl;
  }

  const encodedUrl = encodeURIComponent(rawUrl);
  let proxyUrl = `/api/images/optimize?url=${encodedUrl}`;

  if (width) {
    proxyUrl += `&w=${width}`;
  }

  return proxyUrl;
}

/**
 * Extracts pros and cons from review HTML content
 * Looks for lists within <div class="pro-card"> and <div class="con-card">
 */
export function extractProsConsFromHtml(html: string): { pros: string[]; cons: string[] } {
  if (!html) return { pros: [], cons: [] };

  const pros: string[] = [];
  const cons: string[] = [];

  // Extract pros from pro-card
  const proCardMatch = html.match(/<div class="pro-con-card pro-card">[\s\S]*?<ul class="space-y-2">([\s\S]*?)<\/ul>/);
  if (proCardMatch) {
    const proListItems = proCardMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [];
    proListItems.forEach((item) => {
      const text = item.replace(/<[^>]*>/g, "").trim();
      if (text) pros.push(text);
    });
  }

  // Extract cons from con-card
  const conCardMatch = html.match(/<div class="pro-con-card con-card">[\s\S]*?<ul class="space-y-2">([\s\S]*?)<\/ul>/);
  if (conCardMatch) {
    const conListItems = conCardMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [];
    conListItems.forEach((item) => {
      const text = item.replace(/<[^>]*>/g, "").trim();
      if (text) cons.push(text);
    });
  }

  return { pros, cons };
}

/**
 * Extracts FAQ items from review HTML content
 * Looks for <details> and <summary> tags within FAQ section
 */
export function extractFaqFromHtml(html: string): Array<{ question: string; answer: string }> {
  if (!html) return [];

  const faqItems: Array<{ question: string; answer: string }> = [];

  // Match the FAQ section
  const faqMatch = html.match(/<div class="review-faq">([\s\S]*?)<\/div>/);
  if (!faqMatch) return [];

  const faqContent = faqMatch[1];

  // Extract all details/summary pairs
  const detailsMatches = faqContent.match(/<details class="group[^"]*">([\s\S]*?)<\/details>/g) || [];

  detailsMatches.forEach((details) => {
    // Extract question from summary
    const summaryMatch = details.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
    const questionText = summaryMatch ? summaryMatch[1].replace(/<[^>]*>/g, "").trim() : "";

    // Extract answer from paragraph
    const answerMatch = details.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const answerText = answerMatch ? answerMatch[1].replace(/<[^>]*>/g, "").trim() : "";

    if (questionText && answerText) {
      faqItems.push({
        question: questionText,
        answer: answerText,
      });
    }
  });

  return faqItems;
}

/**
 * Generates a "Who Should Buy" description based on racket specs
 * Uses gameLevel and gameType to create a targeted description
 */
export function generateWhoShouldBuy(racket: Pick<Racket, "gameLevel" | "gameType" | "player">): string {
  const levelMap: Record<string, string> = {
    "Beginner": "Beginner to Intermediate players",
    "Intermediate": "Intermediate players",
    "Advanced": "Advanced players",
    "Professional": "Advanced to Professional players",
  };

  const typeMap: Record<string, string> = {
    "Aggressive": "looking for power and pace",
    "Balanced": "looking for an all-rounder",
    "Defensive": "looking for control and spin",
    "Competitive": "looking for competitive edge",
    "Recreational": "looking for comfort and forgiveness",
  };

  const playerMap: Record<string, string> = {
    "man": "Men",
    "woman": "Women",
    "unisex": "All players",
  };

  const level = levelMap[racket.gameLevel] || "Intermediate to Advanced players";
  const type = typeMap[racket.gameType] || "looking for a versatile racket";
  const playerKey = (racket.player?.toLowerCase() || "unisex") as string;
  const player = playerMap[playerKey] || "All players";

  return `${level} ${type}. This is the gold standard for anyone who plays both sides of the court and needs a racket that reacts as fast as you do.`;
}
