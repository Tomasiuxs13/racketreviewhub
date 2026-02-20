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

  return cleaned;
}

/**
 * Builds a URL-friendly slug for a racket based on brand and model.
 * Avoids duplicating brand name if model already includes it.
 * Example: "Nox" + "ML10 Pro Cup" -> "nox-ml10-pro-cup"
 * Example: "Adidas" + "ADIDAS METALBONE PRO" -> "adidas-metalbone-pro" (not "adidas-adidas-metalbone-pro")
 */
export function getRacketSlug(racket: Pick<Racket, "brand" | "model">): string {
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
