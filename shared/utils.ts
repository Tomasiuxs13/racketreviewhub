/**
 * Extracts Pros and Cons lists from HTML review content.
 * Looks for <h3>Pros</h3> and <h3>Cons</h3> and grabs the subsequent <ul><li> items.
 */
export function extractProsCons(htmlContent: string | null | undefined): { pros: string[]; cons: string[] } {
    if (!htmlContent) return { pros: [], cons: [] };

    const pros: string[] = [];
    const cons: string[] = [];

    try {
        // A simple regex approach to find the UL following an H3 with Pros/Cons
        // Note: In a browser, DOMParser would be safer, but this runs in Node.js (seoInjector) as well.

        // Extract Pros
        const prosMatch = htmlContent.match(/<h3[^>]*>\s*Pros\s*<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/i);
        if (prosMatch && prosMatch[1]) {
            const liMatches = Array.from(prosMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
            for (const match of liMatches) {
                // Strip HTML tags from the inner content
                const text = match[1].replace(/<[^>]*>/g, '').trim();
                if (text) pros.push(text);
            }
        }

        // Extract Cons
        const consMatch = htmlContent.match(/<h3[^>]*>\s*Cons\s*<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/i);
        if (consMatch && consMatch[1]) {
            const liMatches = Array.from(consMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
            for (const match of liMatches) {
                // Strip HTML tags
                const text = match[1].replace(/<[^>]*>/g, '').trim();
                if (text) cons.push(text);
            }
        }
    } catch (e) {
        console.warn("Failed to parse pros/cons from HTML", e);
    }

    return { pros, cons };
}

/**
 * Upscales Padel Market / Awin productserve image URLs from 200x200 to a larger size.
 * These URLs have the pattern: https://images2.productserve.com/?w=200&h=200&...
 * We replace w/h params to get a higher-resolution image.
 */
/**
 * Picks the primary affiliate link for a racket, in this preference order:
 * 1. Padel Nuestro (`affiliateLink` then `titleUrl`) when in stock
 * 2. Padel Market (`padelMarketAffiliateLink`) when in stock
 * 3. Any available link even if OOS (graceful degradation)
 * Returns { url, partner, inStock } or null if no link exists.
 */
export type AffiliatePartner = "padel_nuestro" | "padel_market";
export interface RacketLinkFields {
    affiliateLink?: string | null;
    titleUrl?: string | null;
    padelMarketAffiliateLink?: string | null;
    inStock?: boolean | null;
    padelMarketInStock?: boolean | null;
}
export function pickPrimaryAffiliateLink(
    racket: RacketLinkFields,
): { url: string; partner: AffiliatePartner; inStock: boolean } | null {
    const pn = racket.affiliateLink || racket.titleUrl;
    const pm = racket.padelMarketAffiliateLink;
    const pnInStock = racket.inStock !== false;
    const pmInStock = racket.padelMarketInStock === true;

    if (pn && pnInStock) return { url: pn, partner: "padel_nuestro", inStock: true };
    if (pm && pmInStock) return { url: pm, partner: "padel_market", inStock: true };
    if (pn) return { url: pn, partner: "padel_nuestro", inStock: false };
    if (pm) return { url: pm, partner: "padel_market", inStock: false };
    return null;
}

/**
 * Builds a URL-friendly slug for a racket based on brand and model.
 * Avoids duplicating brand when model already starts with it.
 */
export function computeRacketSlugBase(brand: string, model: string): string {
    const brandLower = brand.toLowerCase();
    const modelLower = model.toLowerCase();
    const base = modelLower.startsWith(brandLower) ? modelLower : `${brandLower} ${modelLower}`;
    return base
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function upscaleProductserveUrl(url: string | null | undefined, size = 600): string | null | undefined {
    if (!url) return url;
    if (!url.includes("productserve.com")) return url;
    return url
        .replace(/([?&])w=\d+/, `$1w=${size}`)
        .replace(/([?&])h=\d+/, `$1h=${size}`);
}

/**
 * Normalizes a feed-supplied racket model string for human/SEO display.
 * Feed models often arrive as "ADIDAS ADIPOWER CARBON CTRL 2025":
 * all-caps, with the brand and year embedded — which produced title tags like
 * "Adidas ADIDAS ADIPOWER CARBON CTRL 2025 2025 Review".
 * Strips a leading brand name, strips a trailing year, and title-cases
 * all-caps words (words containing digits, e.g. "AT10"/"18K", are kept as-is).
 */
export function formatRacketDisplayName(brand: string, model: string, year?: number | null): string {
    let name = (model || "").trim();

    // Strip leading brand (case-insensitive), possibly repeated
    const brandPattern = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
    while (brandPattern.test(name)) {
        name = name.replace(brandPattern, "");
    }

    // Strip a trailing 4-digit year (either the racket's year or any 20xx)
    name = name.replace(/\s+(20\d{2})\s*$/i, (m, y) => {
        if (!year || Number(y) === Number(year)) return "";
        return m;
    }).trim();

    // Title-case fully-uppercase words without digits
    name = name
        .split(/\s+/)
        .map((word) => {
            if (/\d/.test(word)) return word; // keep AT10, 18K, 3.2 as-is
            if (word.length > 1 && word === word.toUpperCase()) {
                // Title-case each hyphenated part: "X-HERO" -> "X-Hero"
                return word
                    .split("-")
                    .map((part) => (part.length > 1 ? part.charAt(0) + part.slice(1).toLowerCase() : part))
                    .join("-");
            }
            return word;
        })
        .join(" ");

    return name || model;
}
