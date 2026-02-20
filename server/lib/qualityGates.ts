/**
 * Quality gate checks for racket publishing.
 * A racket must pass all gates before it can be auto-published.
 */

import type { Racket } from "@shared/schema";

export interface QualityCheckResult {
  passes: boolean;
  failures: string[];
}

/**
 * Check if a racket meets minimum quality requirements for publishing.
 * Returns pass/fail with detailed failure reasons.
 */
export function checkPublishQualityGates(racket: Racket): QualityCheckResult {
  const failures: string[] = [];

  // 1. Review content must exist and be substantial (1500 chars ≈ 300+ words)
  if (!racket.reviewContent || racket.reviewContent.trim().length < 1500) {
    failures.push(`Review too short (${racket.reviewContent?.trim().length || 0} chars, need 1500+)`);
  }

  // 2. All 5 ratings must be non-default (not all identical at 75)
  const ratings = [
    racket.powerRating,
    racket.controlRating,
    racket.reboundRating,
    racket.maneuverabilityRating,
    racket.sweetSpotRating,
  ];
  const allDefault = ratings.every((r) => r === 75);
  if (allDefault) {
    failures.push("All ratings are default (75) - need AI-generated ratings");
  }
  if (ratings.some((r) => r <= 0)) {
    failures.push("One or more ratings are 0 or negative");
  }

  // 3. Must have at least one affiliate link
  const hasLink = racket.affiliateLink || racket.titleUrl || racket.padelMarketAffiliateLink;
  if (!hasLink) {
    failures.push("No affiliate link");
  }

  // 4. Must have an image
  if (!racket.imageUrl) {
    failures.push("No image URL");
  }

  // 5. Must have a valid price
  if (!racket.currentPrice || Number(racket.currentPrice) <= 0) {
    failures.push("No valid price");
  }

  return {
    passes: failures.length === 0,
    failures,
  };
}
