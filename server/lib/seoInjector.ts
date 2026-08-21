import { storage } from "../storage.js";
import { extractProsCons, formatRacketDisplayName } from "@shared/utils";
import { fetchTranslation } from "./i18n.js";
import fs from "fs";
import path from "path";

const SITE_URL = process.env.SITE_URL || "https://racketreviewhub.com";
const SUPPORTED_LOCALES = ["en", "es", "pt", "it", "fr"] as const;
type SupportedLocale = typeof SUPPORTED_LOCALES[number];

// Load UI translations for SEO strings
const uiTranslations: Record<string, any> = {};
for (const loc of SUPPORTED_LOCALES) {
  try {
    const filePath = path.resolve(process.cwd(), "client", "src", "locales", `${loc}.json`);
    if (fs.existsSync(filePath)) {
      uiTranslations[loc] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } else {
       // Try without client prefix if running in certain environments
       const altPath = path.resolve(process.cwd(), "src", "locales", `${loc}.json`);
       if (fs.existsSync(altPath)) {
         uiTranslations[loc] = JSON.parse(fs.readFileSync(altPath, "utf-8"));
       }
    }
  } catch (err) {
    console.warn(`[SEO] Failed to load UI translations for locale ${loc}:`, err);
  }
}

/** Get a translated string by dot-notated key */
function t(locale: string, key: string, vars: Record<string, any> = {}): string {
  const dictionary = uiTranslations[locale] || uiTranslations["en"];
  if (!dictionary) return key;

  const value = key.split(".").reduce((acc, part) => acc && acc[part], dictionary);
  if (typeof value !== "string") {
    // Fallback to English if current locale misses the key
    if (locale !== "en") return t("en", key, vars);
    return key;
  }

  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, token) => vars[token] ?? "");
}

/** Extract locale from path, e.g. "/es/rackets/slug" -> "es" */
function extractLocaleFromPath(path: string): SupportedLocale | null {
  const match = path.match(/^\/([a-z]{2})(\/|$)/);
  if (!match) return null;
  const candidate = match[1] as SupportedLocale;
  return SUPPORTED_LOCALES.includes(candidate) && candidate !== "en" ? candidate : null;
}

/** Strip locale prefix from path, e.g. "/es/rackets/slug" -> "/rackets/slug" */
function stripLocalePrefix(path: string): string {
  return path.replace(/^\/[a-z]{2}(\/|$)/, (_, sep) => sep || "/");
}

/** Build hreflang alternate link tags for head injection */
function buildHreflangTags(resourcePath: string): string {
  const tags: string[] = [];
  const normalizedPath = resourcePath === "/" ? "" : resourcePath;
  for (const locale of SUPPORTED_LOCALES) {
    const href = locale === "en"
      ? `${SITE_URL}${normalizedPath || "/"}`
      : `${SITE_URL}/${locale}${normalizedPath}`;
    tags.push(`<link rel="alternate" hreflang="${locale}" href="${href}">`);
  }
  tags.push(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}${normalizedPath || "/"}">`);
  return tags.join("\n    ");
}

interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
  ogType: string;
  ogImage?: string;
  structuredData?: object[];
  /** Semantic HTML content injected into <div id="root"> for crawlers */
  crawlableContent?: string;
  /** Pre-built hreflang link tags for injection into <head> */
  hreflangTags?: string;
  /** Robots directive; defaults to "index, follow" */
  robots?: string;
}

function buildMetaTags(meta: SeoMeta): string {
  const tags: string[] = [];

  tags.push(`<title>${escapeHtml(meta.title)}</title>`);
  tags.push(`<meta name="robots" content="${escapeAttr(meta.robots || "index, follow")}">`);
  tags.push(`<meta name="description" content="${escapeAttr(meta.description)}">`);
  tags.push(`<link rel="canonical" href="${escapeAttr(meta.canonical)}">`);

  // Open Graph
  tags.push(`<meta property="og:title" content="${escapeAttr(meta.title)}">`);
  tags.push(`<meta property="og:description" content="${escapeAttr(meta.description)}">`);
  tags.push(`<meta property="og:url" content="${escapeAttr(meta.canonical)}">`);
  tags.push(`<meta property="og:type" content="${escapeAttr(meta.ogType)}">`);
  tags.push(`<meta property="og:site_name" content="Padel Racket Reviews">`);
  if (meta.ogImage) {
    tags.push(`<meta property="og:image" content="${escapeAttr(meta.ogImage)}">`);
  }

  // Twitter Card
  tags.push(`<meta name="twitter:card" content="summary_large_image">`);
  tags.push(`<meta name="twitter:title" content="${escapeAttr(meta.title)}">`);
  tags.push(`<meta name="twitter:description" content="${escapeAttr(meta.description)}">`);
  if (meta.ogImage) {
    tags.push(`<meta name="twitter:image" content="${escapeAttr(meta.ogImage)}">`);
  }

  // Structured Data
  if (meta.structuredData && meta.structuredData.length > 0) {
    for (const schema of meta.structuredData) {
      tags.push(`<script type="application/ld+json">${JSON.stringify(schema)}</script>`);
    }
  }

  // hreflang alternate links
  if (meta.hreflangTags) {
    tags.push(meta.hreflangTags);
  }

  return tags.join("\n    ");
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Known generic/fallback descriptions that should not be reused as page-specific meta descriptions */
const GENERIC_DESCRIPTIONS = [
  "expert padel racket reviews with detailed ratings, best prices, and buying guides for players of all levels.",
  "expert padel racket reviews with detailed ratings, performance analysis, and the best prices. compare top rackets from leading brands and find your perfect match.",
  "expert padel racket buying guides and advice",
  "expert padel racket reviews, comparisons, and buying guides. find the best padel racket for your playing style and skill level.",
];

/** Check whether an excerpt is usable as a unique meta description */
function isUsableExcerpt(excerpt: string | null | undefined): boolean {
  if (!excerpt || excerpt.trim().length < 30) return false;
  const lower = excerpt.trim().toLowerCase();
  // Reject known generic fallbacks
  if (GENERIC_DESCRIPTIONS.some(g => lower === g || lower.startsWith(g))) return false;
  // Reject "Author: ..." strings
  if (/^author:\s/i.test(excerpt.trim())) return false;
  return true;
}

/** Generate a fallback meta description for a guide page */
function buildGuideDescription(guide: { title: string; category?: string | null }): string {
  const category = guide.category ? ` covering ${guide.category}` : "";
  const base = `${guide.title}${category}. Expert padel guide with tips and buying advice for all levels.`;
  return base.length > 160 ? base.slice(0, 157) + "..." : base;
}

/** Generate a fallback meta description for a blog post */
function buildBlogDescription(post: { title: string }): string {
  const base = `${post.title}. In-depth padel article with expert analysis and practical advice.`;
  return base.length > 160 ? base.slice(0, 157) + "..." : base;
}

/**
 * Extract FAQ question/answer pairs from review HTML.
 * Reviews use the strict format: <p><strong>Q: [question]</strong></p><p>[answer]</p>
 * Returns a FAQPage JSON-LD schema, or null if no Q&A pairs found.
 */
function buildFaqSchema(reviewContent: string | null | undefined): object | null {
  if (!reviewContent) return null;
  const pairs: { question: string; answer: string }[] = [];
  const qaRegex = /<p>\s*<strong>\s*Q:\s*([^<]+?)\s*<\/strong>\s*<\/p>\s*<p>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = qaRegex.exec(reviewContent)) !== null) {
    const question = match[1].trim();
    // Strip any HTML tags from the answer for schema text
    const answer = match[2].replace(/<[^>]+>/g, "").trim();
    if (question && answer) {
      pairs.push({ question, answer });
    }
  }
  if (pairs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": pairs.map((p) => ({
      "@type": "Question",
      "name": p.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": p.answer,
      },
    })),
  };
}

interface BreadcrumbItem {
  name: string;
  url?: string;
}

function buildBreadcrumbSchema(items: BreadcrumbItem[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": item.name,
      ...(item.url ? { "item": item.url } : {}),
    })),
  };
}

function localeUrl(path: string, locale: string): string {
  return locale === "en" ? `${SITE_URL}${path}` : `${SITE_URL}/${locale}${path}`;
}

function buildRacketSlug(brand: string, model: string): string {
  const lower = model.toLowerCase();
  const brandLower = brand.toLowerCase();
  const base = lower.startsWith(brandLower) ? lower : `${brandLower} ${lower}`;
  return base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Cleans review content by stripping markdown code block markers.
 * Server-side equivalent of the client-side cleanReviewContent.
 */
function cleanReviewContentServer(content: string): string {
  if (!content) return content;
  let cleaned = content.trim();
  // Remove code blocks at the beginning
  if (cleaned.startsWith('```html') || cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    if (lines[0]?.match(/^```(html)?\s*$/)) lines.shift();
    cleaned = lines.join('\n');
  }
  // Remove code blocks at the end
  if (cleaned.endsWith('```')) {
    const lines = cleaned.split('\n');
    if (lines[lines.length - 1]?.trim() === '```') lines.pop();
    cleaned = lines.join('\n');
  }
  cleaned = cleaned
    .replace(/^```html\s*\n?/gm, '')
    .replace(/^```\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim();
  // Clean up escaped quote artifacts
  cleaned = cleaned.replace(/\\"/g, '"');
  return cleaned;
}

/**
 * Build crawlable HTML for a racket detail page.
 * This content is injected inside <div id="root"> so crawlers can index it.
 * React will replace it on client-side hydration.
 */
function buildRacketCrawlableHtml(racket: any): string {
  const parts: string[] = [];
  parts.push(`<article id="ssr-content" data-nosnippet="false">`);
  const displayModel = formatRacketDisplayName(racket.brand, racket.model, racket.year);
  parts.push(`<h1>${escapeHtml(`${racket.brand} ${displayModel} ${racket.year || ''} Padel Racket Review`.trim())}</h1>`);

  // Overall rating
  parts.push(`<p><strong>Overall Rating: ${racket.overallRating}/100</strong></p>`);

  // Performance ratings
  if (racket.powerRating || racket.controlRating) {
    parts.push(`<section>`);
    parts.push(`<h2>Performance Ratings</h2>`);
    parts.push(`<ul>`);
    if (racket.powerRating) parts.push(`<li>Power: ${racket.powerRating}/100</li>`);
    if (racket.controlRating) parts.push(`<li>Control: ${racket.controlRating}/100</li>`);
    if (racket.reboundRating) parts.push(`<li>Rebound: ${racket.reboundRating}/100</li>`);
    if (racket.maneuverabilityRating) parts.push(`<li>Maneuverability: ${racket.maneuverabilityRating}/100</li>`);
    if (racket.sweetSpotRating) parts.push(`<li>Sweet Spot: ${racket.sweetSpotRating}/100</li>`);
    parts.push(`</ul>`);
    parts.push(`</section>`);
  }

  // Specifications
  const specs: [string, any][] = [
    ['Brand', racket.brand],
    ['Shape', racket.shape],
    ['Balance', racket.balance],
    ['Surface', racket.surface],
    ['Hardness', racket.hardness],
    ['Core', racket.core],
    ['Game Level', racket.gameLevel],
    ['Game Type', racket.gameType],
    ['Year', racket.year],
  ];
  const validSpecs = specs.filter(([, v]) => v);
  if (validSpecs.length > 0) {
    parts.push(`<section>`);
    parts.push(`<h2>Specifications</h2>`);
    parts.push(`<dl>`);
    for (const [label, value] of validSpecs) {
      parts.push(`<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd>`);
    }
    parts.push(`</dl>`);
    parts.push(`</section>`);
  }

  // Review content (the full article body)
  if (racket.reviewContent) {
    parts.push(`<section>`);
    parts.push(`<h2>Expert Review</h2>`);
    parts.push(cleanReviewContentServer(racket.reviewContent));
    parts.push(`</section>`);
  }

  // Price info
  if (racket.currentPrice) {
    parts.push(`<p>Current Price: €${Number(racket.currentPrice).toFixed(2)}</p>`);
  }

  parts.push(`</article>`);
  return parts.join('\n');
}

/**
 * Build crawlable HTML for a guide detail page.
 */
function buildGuideCrawlableHtml(guide: any): string {
  const parts: string[] = [];
  parts.push(`<article id="ssr-content">`);
  parts.push(`<h1>${escapeHtml(guide.title)}</h1>`);
  if (guide.excerpt) {
    parts.push(`<p>${escapeHtml(guide.excerpt)}</p>`);
  }
  if (guide.content) {
    parts.push(cleanReviewContentServer(guide.content));
  }
  parts.push(`</article>`);
  return parts.join('\n');
}

/**
 * Build crawlable HTML for a brand detail page.
 */
function buildBrandCrawlableHtml(brand: any): string {
  const parts: string[] = [];
  parts.push(`<article id="ssr-content">`);
  parts.push(`<h1>${escapeHtml(brand.name)} Padel Rackets</h1>`);
  if (brand.description) {
    parts.push(`<p>${escapeHtml(brand.description)}</p>`);
  }
  if (brand.articleContent) {
    parts.push(cleanReviewContentServer(brand.articleContent));
  }
  parts.push(`</article>`);
  return parts.join('\n');
}

/**
 * Build crawlable HTML for a blog post page.
 */
function buildBlogCrawlableHtml(post: any): string {
  const parts: string[] = [];
  parts.push(`<article id="ssr-content">`);
  parts.push(`<h1>${escapeHtml(post.title)}</h1>`);
  if (post.excerpt) {
    parts.push(`<p>${escapeHtml(post.excerpt)}</p>`);
  }
  if (post.content) {
    parts.push(cleanReviewContentServer(post.content));
  }
  parts.push(`</article>`);
  return parts.join('\n');
}

/**
 * Build crawlable HTML for the Home page.
 */
async function buildHomeCrawlableHtml(locale: string): Promise<string> {
  const rackets = await storage.getPublishedRackets();
  const guides = await storage.getAllGuides();
  const parts: string[] = [];
  parts.push(`<article id="ssr-content">`);
  parts.push(`<h1>${escapeHtml(t(locale, "home.hero.title"))}</h1>`);
  parts.push(`<p>${escapeHtml(t(locale, "home.hero.subtitle"))}</p>`);
  
  parts.push(`<section>`);
  parts.push(`<h2>${escapeHtml(t(locale, "home.recentReviews.title"))}</h2>`);
  parts.push(`<ul>`);
  for (const r of rackets.slice(0, 12)) {
    const slug = buildRacketSlug(r.brand, r.model);
    const href = locale === "en" ? `/rackets/${slug}` : `/${locale}/rackets/${slug}`;
    parts.push(`<li><a href="${href}">${escapeHtml(`${r.brand} ${r.model}`)} - ${r.overallRating}/100</a></li>`);
  }
  parts.push(`</ul>`);
  parts.push(`</section>`);

  parts.push(`<section>`);
  parts.push(`<h2>${escapeHtml(t(locale, "home.recentGuides.title"))}</h2>`);
  parts.push(`<ul>`);
  for (const g of guides.slice(0, 6)) {
    const href = locale === "en" ? `/guides/${g.slug}` : `/${locale}/guides/${g.slug}`;
    parts.push(`<li><a href="${href}">${escapeHtml(g.title)}</a></li>`);
  }
  parts.push(`</ul>`);
  parts.push(`</section>`);
  
  parts.push(`</article>`);
  return parts.join('\n');
}

/**
 * Build crawlable HTML for listing pages.
 */
async function buildListingCrawlableHtml(title: string, description: string, items: { label: string, href: string }[]): Promise<string> {
  const parts: string[] = [];
  parts.push(`<article id="ssr-content">`);
  parts.push(`<h1>${escapeHtml(title)}</h1>`);
  parts.push(`<p>${escapeHtml(description)}</p>`);
  parts.push(`<ul>`);
  for (const item of items) {
    parts.push(`<li><a href="${item.href}">${escapeHtml(item.label)}</a></li>`);
  }
  parts.push(`</ul>`);
  parts.push(`</article>`);
  return parts.join('\n');
}
export async function resolveSeoMeta(path: string): Promise<SeoMeta | { is404: true }> {
  try {
    // Detect and strip locale prefix from path
    const locale = extractLocaleFromPath(path) ?? "en";
    const resourcePath = locale !== "en" ? stripLocalePrefix(path) : path;

    // Racket detail page: /rackets/:slug (or /es/rackets/:slug)
    const racketMatch = resourcePath.match(/^\/rackets\/([^/]+)$/);
    if (racketMatch) {
      const rawSlug = racketMatch[1];
      // Normalize legacy duplicated-brand slugs (e.g. "nox-nox-foo" → "nox-foo")
      const dupMatch = rawSlug.match(/^([a-z0-9]+)-\1-(.+)$/);
      const slug = dupMatch ? `${dupMatch[1]}-${dupMatch[2]}`.replace(/--+/g, "-") : rawSlug;
      const racket = await storage.getRacketBySlug(slug);
      if (racket) {
        // Apply translation if non-English locale
        let reviewContent = racket.reviewContent;
        if (locale !== "en") {
          try {
            const translation = await fetchTranslation("racket_review", racket.id, locale);
            if (translation?.reviewContent) {
              reviewContent = translation.reviewContent;
            }
          } catch (err) {
            console.warn(`[SEO] Failed to load ${locale} translation for racket ${racket.id}:`, err);
          }
        }
        const translatedRacket = { ...racket, reviewContent };

        // Normalize feed model names ("ADIDAS ADIPOWER CARBON CTRL 2025") so titles
        // don't duplicate the brand/year: "Adidas Adipower Carbon Ctrl 2025 Review..."
        const displayModel = formatRacketDisplayName(racket.brand, racket.model, racket.year);
        const fullDisplayName = `${racket.brand} ${displayModel} ${racket.year || ""}`.trim();

        const title = t(locale, "racket.seo.title", {
          brand: racket.brand,
          model: displayModel,
          year: racket.year || "",
          rating: racket.overallRating
        });

        const description = t(locale, "racket.seo.description", {
          brand: racket.brand,
          model: displayModel,
          year: racket.year || "",
          rating: racket.overallRating
        }) || `Expert ${fullDisplayName} padel racket review. ${racket.overallRating}/100 rating.`.trim();

        const extracted = extractProsCons(reviewContent);

        // E-E-A-T: attribute the review to the real author (Person) when one is
        // assigned; Google's reviews system devalues anonymous/org-only reviews.
        let authorSchema: object = {
          "@type": "Organization",
          "name": t(locale, "common.brandName"),
        };
        if (racket.authorId) {
          try {
            const author = await storage.getAuthorById(racket.authorId);
            if (author) {
              authorSchema = {
                "@type": "Person",
                "name": author.name,
                "url": `${SITE_URL}/authors/${author.slug}`,
                ...(author.bio ? { "description": author.bio } : {}),
              };
            }
          } catch (err) {
            console.warn(`[SEO] Failed to load author ${racket.authorId} for review schema:`, err);
          }
        }

        const reviewSchema: any = {
          "@type": "Review",
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": racket.overallRating,
            "bestRating": 100,
            "worstRating": 0,
          },
          "author": authorSchema,
        };

        if (extracted.pros.length > 0) {
          reviewSchema.positiveNotes = {
            "@type": "ItemList",
            "itemListElement": extracted.pros.map((p, i) => ({
              "@type": "ListItem",
              "position": i + 1,
              "name": p
            }))
          };
        }
        if (extracted.cons.length > 0) {
          reviewSchema.negativeNotes = {
            "@type": "ItemList",
            "itemListElement": extracted.cons.map((c, i) => ({
              "@type": "ListItem",
              "position": i + 1,
              "name": c
            }))
          };
        }

        const racketCanonicalPath = `/rackets/${buildRacketSlug(racket.brand, racket.model)}`;
        const racketUrl = locale === "en"
          ? `${SITE_URL}${racketCanonicalPath}`
          : `${SITE_URL}/${locale}${racketCanonicalPath}`;
        const topLevelReviewSchema = {
          "@context": "https://schema.org",
          "@type": "Review",
          "itemReviewed": {
            "@type": "Product",
            "name": fullDisplayName,
            "brand": { "@type": "Brand", "name": racket.brand },
            "image": racket.imageUrl || undefined,
          },
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": racket.overallRating,
            "bestRating": 100,
            "worstRating": 0,
          },
          "author": authorSchema,
          "publisher": { "@type": "Organization", "name": t(locale, "common.brandName"), "url": SITE_URL },
          "datePublished": racket.createdAt ? new Date(racket.createdAt).toISOString().split("T")[0] : undefined,
          "dateModified": racket.updatedAt ? new Date(racket.updatedAt).toISOString().split("T")[0] : undefined,
          ...(extracted.pros.length > 0 ? { positiveNotes: reviewSchema.positiveNotes } : {}),
          ...(extracted.cons.length > 0 ? { negativeNotes: reviewSchema.negativeNotes } : {}),
        };

        const faqSchema = buildFaqSchema(reviewContent);

        return {
          title,
          description,
          canonical: racketUrl,
          ogType: "article",
          ogImage: racket.imageUrl || undefined,
          crawlableContent: buildRacketCrawlableHtml(translatedRacket),
          hreflangTags: buildHreflangTags(racketCanonicalPath),
          structuredData: [
            ...(faqSchema ? [faqSchema] : []),
            buildBreadcrumbSchema([
              { name: t(locale, "header.menu.home") || "Home", url: localeUrl("/", locale) },
              { name: t(locale, "header.menu.rackets") || "Rackets", url: localeUrl("/rackets", locale) },
              { name: racket.brand, url: localeUrl(`/brands/${racket.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, locale) },
              { name: fullDisplayName },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": fullDisplayName,
              "description": description,
              "image": racket.imageUrl ? [racket.imageUrl] : undefined,
              "brand": { "@type": "Brand", "name": racket.brand },
              "review": reviewSchema,
              "dateModified": racket.updatedAt ? new Date(racket.updatedAt).toISOString().split("T")[0] : undefined,
              "url": racketUrl,
              "offers": (() => {
                const offers: any[] = [];
                if (racket.affiliateLink || racket.titleUrl) {
                  offers.push({
                    "@type": "Offer",
                    "price": racket.currentPrice,
                    "priceCurrency": "EUR",
                    "availability": racket.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                    "url": racket.affiliateLink || racket.titleUrl,
                    "seller": { "@type": "Organization", "name": "Padel Nuestro" },
                  });
                }
                if (racket.padelMarketAffiliateLink) {
                  offers.push({
                    "@type": "Offer",
                    "price": racket.currentPrice,
                    "priceCurrency": "EUR",
                    "availability": racket.padelMarketInStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                    "url": racket.padelMarketAffiliateLink,
                    "seller": { "@type": "Organization", "name": "Padel Market" },
                  });
                }
                if (offers.length === 0) return undefined;
                if (offers.length === 1) return offers[0];
                return {
                  "@type": "AggregateOffer",
                  "lowPrice": racket.currentPrice,
                  "highPrice": racket.originalPrice && Number(racket.originalPrice) > Number(racket.currentPrice) ? racket.originalPrice : racket.currentPrice,
                  "priceCurrency": "EUR",
                  "offerCount": offers.length,
                  "offers": offers,
                };
              })(),
            },
            topLevelReviewSchema,
          ],
        };
      }
      return { is404: true };
    }

    // Brand detail page: /brands/:slug
    const brandMatch = resourcePath.match(/^\/brands\/([^/]+)$/);
    if (brandMatch) {
      const brand = await storage.getBrand(brandMatch[1]);
      if (brand) {
        const year = new Date().getFullYear();
        const title = `Best ${brand.name} Padel Rackets ${year} - Reviews & Buying Guide`;
        const description = brand.description || `Discover the best ${brand.name} padel rackets. Expert reviews, ratings, and buying guide.`;
        const brandCanonicalPath = `/brands/${brand.slug}`;
        const brandUrl = locale === "en" ? `${SITE_URL}${brandCanonicalPath}` : `${SITE_URL}/${locale}${brandCanonicalPath}`;
        const brandSchema: any = {
          "@context": "https://schema.org",
          "@type": "Brand",
          "name": brand.name,
          "url": brandUrl,
        };
        if (brand.logoUrl) brandSchema.logo = brand.logoUrl;
        if (brand.description) brandSchema.description = brand.description;
        return {
          title,
          description,
          canonical: brandUrl,
          ogType: "article",
          ogImage: brand.logoUrl || undefined,
          crawlableContent: buildBrandCrawlableHtml(brand),
          hreflangTags: buildHreflangTags(brandCanonicalPath),
          structuredData: [
            buildBreadcrumbSchema([
              { name: t(locale, "header.menu.home") || "Home", url: localeUrl("/", locale) },
              { name: t(locale, "header.menu.brands") || "Brands", url: localeUrl("/brands", locale) },
              { name: brand.name },
            ]),
            brandSchema,
          ],
        };
      }
      return { is404: true };
    }

    // Guide detail page: /guides/:slug
    const guideMatch = resourcePath.match(/^\/guides\/([^/]+)$/);
    if (guideMatch) {
      const guide = await storage.getGuide(guideMatch[1]);
      if (guide) {
        const guideCanonicalPath = `/guides/${guide.slug}`;
        const guideUrl = locale === "en" ? `${SITE_URL}${guideCanonicalPath}` : `${SITE_URL}/${locale}${guideCanonicalPath}`;
        const guideDescription = isUsableExcerpt(guide.excerpt)
          ? guide.excerpt
          : buildGuideDescription(guide);
        return {
          title: `${guide.title} - Padel Racket Reviews`,
          description: guideDescription,
          canonical: guideUrl,
          ogType: "article",
          ogImage: guide.featuredImage || undefined,
          crawlableContent: buildGuideCrawlableHtml(guide),
          hreflangTags: buildHreflangTags(guideCanonicalPath),
          structuredData: [
            buildBreadcrumbSchema([
              { name: t(locale, "header.menu.home") || "Home", url: localeUrl("/", locale) },
              { name: t(locale, "header.menu.guides") || "Guides", url: localeUrl("/guides", locale) },
              { name: guide.title },
            ]),
          ],
        };
      }
      return { is404: true };
    }

    // Blog post page: /blog/:slug
    const blogMatch = resourcePath.match(/^\/blog\/([^/]+)$/);
    if (blogMatch) {
      const post = await storage.getBlogPost(blogMatch[1]);
      if (post) {
        const blogCanonicalPath = `/blog/${post.slug}`;
        const blogUrl = locale === "en" ? `${SITE_URL}${blogCanonicalPath}` : `${SITE_URL}/${locale}${blogCanonicalPath}`;
        const blogDescription = isUsableExcerpt(post.excerpt)
          ? post.excerpt
          : buildBlogDescription(post);
        return {
          title: `${post.title} - Padel Racket Reviews`,
          description: blogDescription,
          canonical: blogUrl,
          ogType: "article",
          ogImage: post.featuredImage || undefined,
          crawlableContent: buildBlogCrawlableHtml(post),
          hreflangTags: buildHreflangTags(blogCanonicalPath),
          structuredData: [
            buildBreadcrumbSchema([
              { name: t(locale, "header.menu.home") || "Home", url: localeUrl("/", locale) },
              { name: t(locale, "header.menu.blog") || "Blog", url: localeUrl("/blog", locale) },
              { name: post.title },
            ]),
          ],
        };
      }
      return { is404: true };
    }

    // Static pages
    if (resourcePath === "/" || resourcePath === "") {
      const homeMeta = {
        title: t(locale, "home.seo.title"),
        description: t(locale, "home.seo.description"),
        canonical: locale === "en" ? SITE_URL : `${SITE_URL}/${locale}`,
        ogType: "website",
        hreflangTags: buildHreflangTags("/"),
        crawlableContent: ""
      };
      homeMeta.crawlableContent = await buildHomeCrawlableHtml(locale);
      return homeMeta;
    }

    if (resourcePath === "/rackets") {
      const pageTitle = t(locale, "header.menu.rackets") + " - Padel Racket Reviews";
      const pageDesc = "Browse our complete collection of expert padel racket reviews. Filter by brand, shape, price, and performance ratings.";
      const rackets = await storage.getPublishedRackets();
      const items = rackets.map(r => {
        const slug = buildRacketSlug(r.brand, r.model);
        return {
          label: `${r.brand} ${r.model}`,
          href: locale === "en" ? `/rackets/${slug}` : `/${locale}/rackets/${slug}`
        };
      });
      return {
        title: pageTitle,
        description: pageDesc,
        canonical: locale === "en" ? `${SITE_URL}/rackets` : `${SITE_URL}/${locale}/rackets`,
        ogType: "website",
        hreflangTags: buildHreflangTags("/rackets"),
        crawlableContent: await buildListingCrawlableHtml(pageTitle, pageDesc, items)
      };
    }

    if (resourcePath === "/guides") {
      const pageTitle = t(locale, "header.menu.guides") + " - Padel Racket Reviews";
      const pageDesc = "Comprehensive padel racket buying guides for beginners, intermediate, and advanced players.";
      const guides = await storage.getAllGuides();
      const items = guides.map(g => ({
        label: g.title,
        href: locale === "en" ? `/guides/${g.slug}` : `/${locale}/guides/${g.slug}`
      }));
      return {
        title: pageTitle,
        description: pageDesc,
        canonical: locale === "en" ? `${SITE_URL}/guides` : `${SITE_URL}/${locale}/guides`,
        ogType: "website",
        hreflangTags: buildHreflangTags("/guides"),
        crawlableContent: await buildListingCrawlableHtml(pageTitle, pageDesc, items)
      };
    }

    if (resourcePath === "/brands") {
      const pageTitle = t(locale, "header.menu.brands") + " - Padel Racket Reviews";
      const pageDesc = "Explore top padel racket brands including Babolat, Bullpadel, Head, Adidas, and Nox.";
      const brands = await storage.getAllBrands();
      const items = brands.map(b => ({
        label: b.name,
        href: locale === "en" ? `/brands/${b.slug}` : `/${locale}/brands/${b.slug}`
      }));
      return {
        title: pageTitle,
        description: pageDesc,
        canonical: locale === "en" ? `${SITE_URL}/brands` : `${SITE_URL}/${locale}/brands`,
        ogType: "website",
        hreflangTags: buildHreflangTags("/brands"),
        crawlableContent: await buildListingCrawlableHtml(pageTitle, pageDesc, items)
      };
    }

    if (resourcePath === "/quiz") {
      const pageTitle = t(locale, "header.quizButton") + " - Padel Racket Reviews";
      const pageDesc = "Answer 4 quick questions and we'll recommend the best padel racket for your playing level, style, and budget.";
      return {
        title: pageTitle,
        description: pageDesc,
        canonical: locale === "en" ? `${SITE_URL}/quiz` : `${SITE_URL}/${locale}/quiz`,
        ogType: "website",
        hreflangTags: buildHreflangTags("/quiz"),
        crawlableContent: await buildListingCrawlableHtml(pageTitle, pageDesc, [])
      };
    }

    if (resourcePath === "/blog") {
      const pageTitle = t(locale, "header.menu.blog") + " - Padel Racket Reviews";
      const pageDesc = "Latest news, tips, and insights from the padel world.";
      const posts = await storage.getAllBlogPosts();
      const items = posts.map(p => ({
        label: p.title,
        href: locale === "en" ? `/blog/${p.slug}` : `/${locale}/blog/${p.slug}`
      }));
      return {
        title: pageTitle,
        description: pageDesc,
        canonical: locale === "en" ? `${SITE_URL}/blog` : `${SITE_URL}/${locale}/blog`,
        ogType: "website",
        hreflangTags: buildHreflangTags("/blog"),
        crawlableContent: await buildListingCrawlableHtml(pageTitle, pageDesc, items)
      };
    }

    // Best of category pages: /best/:category
    const bestMatch = resourcePath.match(/^\/best\/([^/]+)$/);
    if (bestMatch) {
      const category = bestMatch[1].toLowerCase();
      const year = new Date().getFullYear();
      const categoryTitles: Record<string, string> = {
        "power": "Best Power Padel Rackets",
        "control": "Best Control Padel Rackets",
        "beginner": "Best Beginner Padel Rackets",
        "advanced": "Best Advanced Padel Rackets",
        "budget": "Best Budget Padel Rackets",
        "overall": "Best Overall Padel Rackets",
      };
      const categoryDescriptions: Record<string, string> = {
        "power": "Dominate the court with maximum explosive power and aggressive smash capabilities.",
        "control": "Pinpoint accuracy and defensive stability for the tactical, precise player.",
        "beginner": "Forgiving, easy-to-play rackets with large sweet spots, perfect for starting out.",
        "advanced": "Premium technological marvels built for competition-level performance.",
        "budget": "Incredible value for money without sacrificing build quality or playability.",
        "overall": "Our top-rated rackets combining power, control, maneuverability, and value.",
      };
      // Unknown categories must 404 — a fabricated fallback page for any
      // /best/* string is an unbounded source of thin duplicate URLs.
      if (!categoryTitles[category]) {
        return { is404: true };
      }
      const catTitle = categoryTitles[category];
      const catDesc = categoryDescriptions[category];
      const bestCanonicalPath = `/best/${category}`;
      const bestUrl = locale === "en" ? `${SITE_URL}${bestCanonicalPath}` : `${SITE_URL}/${locale}${bestCanonicalPath}`;
      const pageTitle = `${catTitle} of ${year} - Expert Reviews`;
      const pageDesc = `Discover the ${catTitle.toLowerCase()} for ${year}. ${catDesc}`;

      // Populate crawlable listing with matching rackets so the page is indexable
      const allRackets = await storage.getPublishedRackets();
      const scored = allRackets.map(r => {
        let score = r.overallRating || 0;
        switch (category) {
          case "power":
            score = r.powerRating || 0; break;
          case "control":
            score = r.controlRating || 0; break;
          case "beginner":
            score = (r.gameLevel?.toLowerCase() === "beginner" ? 100 : 0) + (r.sweetSpotRating || 0) + (r.maneuverabilityRating || 0);
            break;
          case "advanced":
            score = (r.gameLevel?.toLowerCase() === "advanced" || r.gameLevel?.toLowerCase() === "professional" ? 100 : 0) + (r.overallRating || 0);
            break;
          case "budget":
            score = -Number(r.currentPrice || 999); break;
          case "overall":
          default:
            score = r.overallRating || 0;
        }
        return { r, score };
      }).sort((a, b) => b.score - a.score).slice(0, 20);

      const items = scored.map(({ r }) => {
        const slug = (r as any).slug || buildRacketSlug(r.brand, r.model);
        return {
          label: `${r.brand} ${r.model} ${r.year || ""} — ${r.overallRating}/100 — €${Number(r.currentPrice).toFixed(2)}`.trim(),
          href: locale === "en" ? `/rackets/${slug}` : `/${locale}/rackets/${slug}`,
        };
      });

      return {
        title: pageTitle,
        description: pageDesc,
        canonical: bestUrl,
        ogType: "website",
        hreflangTags: buildHreflangTags(bestCanonicalPath),
        crawlableContent: await buildListingCrawlableHtml(pageTitle, pageDesc, items),
        structuredData: [
          buildBreadcrumbSchema([
            { name: t(locale, "header.menu.home") || "Home", url: localeUrl("/", locale) },
            { name: t(locale, "header.menu.rackets") || "Rackets", url: localeUrl("/rackets", locale) },
            { name: catTitle },
          ]),
        ],
      };
    }

    if (resourcePath === "/about") {
      const pageTitle = t(locale, "about.seoTitle");
      const pageDesc = t(locale, "about.seoDescription");
      return {
        title: pageTitle,
        description: pageDesc,
        canonical: locale === "en" ? `${SITE_URL}/about` : `${SITE_URL}/${locale}/about`,
        ogType: "website",
        hreflangTags: buildHreflangTags("/about"),
        crawlableContent: await buildListingCrawlableHtml(pageTitle, pageDesc, [])
      };
    }

    if (resourcePath === "/contact") {
      return {
        title: "Contact Us - Padel Racket Reviews",
        description: "Get in touch with the Padel Racket Reviews team. Questions about rackets, reviews, partnerships, or feedback — we'd love to hear from you.",
        canonical: locale === "en" ? `${SITE_URL}/contact` : `${SITE_URL}/${locale}/contact`,
        ogType: "website",
        hreflangTags: buildHreflangTags("/contact"),
      };
    }

    if (resourcePath === "/methodology") {
      return {
        title: t(locale, "methodology.seoTitle"),
        description: t(locale, "methodology.seoDescription"),
        canonical: locale === "en" ? `${SITE_URL}/methodology` : `${SITE_URL}/${locale}/methodology`,
        ogType: "website",
        hreflangTags: buildHreflangTags("/methodology"),
      };
    }

    // Legal pages (match actual client routes: /privacy, /terms, /disclosure)
    const legalMatch = resourcePath.match(/^\/(privacy|terms|disclosure|disclaimer|cookie-policy|privacy-policy)$/);
    if (legalMatch) {
      const legalPage = legalMatch[1];
      const legalTitles: Record<string, string> = {
        "privacy": "Privacy Policy - Padel Racket Reviews",
        "privacy-policy": "Privacy Policy - Padel Racket Reviews",
        "terms": "Terms of Service - Padel Racket Reviews",
        "disclosure": "Affiliate Disclosure - Padel Racket Reviews",
        "disclaimer": "Disclaimer - Padel Racket Reviews",
        "cookie-policy": "Cookie Policy - Padel Racket Reviews",
      };
      const legalDescriptions: Record<string, string> = {
        "privacy": "Privacy policy for Padel Racket Reviews. Learn how we collect, use, and protect your personal data.",
        "privacy-policy": "Privacy policy for Padel Racket Reviews. Learn how we collect, use, and protect your personal data.",
        "terms": "Terms of service governing the use of Padel Racket Reviews website and services.",
        "disclosure": "Affiliate disclosure for Padel Racket Reviews. Learn how we earn commissions through affiliate partnerships.",
        "disclaimer": "Important disclaimers regarding affiliate links, health information, and accuracy of content on Padel Racket Reviews.",
        "cookie-policy": "How Padel Racket Reviews uses cookies and similar technologies. Manage your preferences and learn about our data practices.",
      };
      const legalCanonicalPath = `/${legalPage}`;
      return {
        title: legalTitles[legalPage] || `${legalPage} - Padel Racket Reviews`,
        description: legalDescriptions[legalPage] || `Legal information for Padel Racket Reviews.`,
        canonical: locale === "en" ? `${SITE_URL}${legalCanonicalPath}` : `${SITE_URL}/${locale}${legalCanonicalPath}`,
        ogType: "website",
        hreflangTags: buildHreflangTags(legalCanonicalPath),
      };
    }

    // Author detail page: /authors/:slug
    const authorMatch = resourcePath.match(/^\/authors\/([^/]+)$/);
    if (authorMatch) {
      const author = await storage.getAuthor(authorMatch[1]);
      if (author) {
        const authorCanonicalPath = `/authors/${author.slug}`;
        const authorUrl = locale === "en" ? `${SITE_URL}${authorCanonicalPath}` : `${SITE_URL}/${locale}${authorCanonicalPath}`;
        return {
          title: `${author.name} - Author at Padel Racket Reviews`,
          description: author.bio
            ? (author.bio.length > 160 ? author.bio.slice(0, 157) + "..." : author.bio)
            : `Read expert padel articles and reviews by ${author.name} on Padel Racket Reviews.`,
          canonical: authorUrl,
          ogType: "article",
          ogImage: author.avatarUrl || undefined,
          hreflangTags: buildHreflangTags(authorCanonicalPath),
        };
      }
      return { is404: true };
    }

    // Comparison tool: /compare is indexable; /compare/:ids permutations are
    // user-generated and would flood the index with near-duplicates, so they
    // get noindex + a canonical pointing at the base tool page.
    const compareMatch = resourcePath.match(/^\/compare(\/.+)?$/);
    if (compareMatch) {
      const compareCanonicalPath = "/compare";
      return {
        title: "Compare Padel Rackets Side-by-Side - Padel Racket Reviews",
        description: "Compare padel rackets side-by-side: power, control, weight, balance, price and expert ratings. Find the right racket for your game.",
        canonical: locale === "en" ? `${SITE_URL}${compareCanonicalPath}` : `${SITE_URL}/${locale}${compareCanonicalPath}`,
        ogType: "website",
        hreflangTags: buildHreflangTags(compareCanonicalPath),
        ...(compareMatch[1] ? { robots: "noindex, follow" } : {}),
      };
    }

    // Auth/admin utility pages: real client routes, but never for the index.
    if (/^\/(login|signup)$/.test(resourcePath) || /^\/admin(\/.*)?$/.test(resourcePath)) {
      return {
        title: "Padel Racket Reviews",
        description: "Expert padel racket reviews, comparisons, and buying guides.",
        canonical: `${SITE_URL}${resourcePath}`,
        ogType: "website",
        robots: "noindex, nofollow",
      };
    }

    // Any path not matched above is not a real page: return a hard 404 so
    // crawlers don't file the SPA shell as a soft 404 / duplicate.
    return { is404: true };
  } catch (error) {
    console.error("[SEO] Error resolving meta for path:", path, error);
    throw error;
  }
}

/** Build site-wide navigation HTML for crawlers to discover all major sections */
function buildCrawlerNav(locale: string): string {
  const loc = locale === "en" ? "" : `/${locale}`;
  const links = [
    { href: `${loc}/`, label: t(locale, "header.menu.home") || "Home" },
    { href: `${loc}/rackets`, label: t(locale, "header.menu.rackets") || "Rackets" },
    { href: `${loc}/brands`, label: t(locale, "header.menu.brands") || "Brands" },
    { href: `${loc}/guides`, label: t(locale, "header.menu.guides") || "Guides" },
    { href: `${loc}/blog`, label: t(locale, "header.menu.blog") || "Blog" },
    { href: `${loc}/best/power`, label: "Best Power Rackets" },
    { href: `${loc}/best/control`, label: "Best Control Rackets" },
    { href: `${loc}/best/beginner`, label: "Best Beginner Rackets" },
    { href: `${loc}/quiz`, label: t(locale, "header.quizButton") || "Racket Quiz" },
    { href: `${loc}/about`, label: t(locale, "footer.about") || "About" },
    { href: `${loc}/methodology`, label: t(locale, "footer.methodology") || "Methodology" },
    { href: `${loc}/contact`, label: t(locale, "footer.contact") || "Contact" },
  ];
  const items = links.map(l => `<li><a href="${l.href}">${escapeHtml(l.label)}</a></li>`).join("\n");
  return `<nav aria-label="Site navigation"><ul>${items}</ul></nav>`;
}

/**
 * Inject SEO meta tags into the HTML template.
 * Replaces the default <title> and adds meta tags in <head>.
 */
export function injectSeoMeta(html: string, meta: SeoMeta): string {
  const metaTags = buildMetaTags(meta);

  // Remove the existing static title
  html = html.replace(
    /<title>.*?<\/title>/,
    "",
  );

  // Remove existing static meta description
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    "",
  );

  // Inject before closing </head>
  html = html.replace("</head>", `    ${metaTags}\n  </head>`);

  // Inject crawlable content inside <div id="root"> for search engine crawlers.
  // React's createRoot will replace this content on client-side hydration.
  // Also inject site-wide nav links so crawlers can discover all major sections.
  // IMPORTANT: content must NOT be display:none — Google devalues hidden text and
  // it reads as cloaking. We render it visible (minimal styling) and let React
  // replace it on hydration; the brief flash is the SEO-correct trade-off.
  {
    const localeFromCanonical = meta.canonical.replace(SITE_URL, "").match(/^\/([a-z]{2})(\/|$)/);
    const locale = localeFromCanonical && SUPPORTED_LOCALES.includes(localeFromCanonical[1] as SupportedLocale) && localeFromCanonical[1] !== "en"
      ? localeFromCanonical[1]
      : "en";
    const navHtml = buildCrawlerNav(locale);
    const content = meta.crawlableContent ? `${navHtml}${meta.crawlableContent}` : navHtml;
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root"><div id="seo-ssr" style="max-width:72rem;margin:0 auto;padding:1rem;font-family:system-ui,sans-serif">${content}</div></div>`,
    );
  }

  return html;
}
