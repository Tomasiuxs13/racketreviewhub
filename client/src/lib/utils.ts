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

  return cleaned;
}

/**
 * Builds a URL-friendly slug for a racket based on brand and model.
 * Example: "Nox" + "ML10 Pro Cup" -> "nox-ml10-pro-cup"
 */
export function getRacketSlug(racket: Pick<Racket, "brand" | "model">): string {
  const base = `${racket.brand} ${racket.model}`.toLowerCase();
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
