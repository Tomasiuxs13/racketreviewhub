import { storage } from "../storage.js";
import { extractProsCons } from "@shared/utils";
import { fetchTranslation } from "./i18n.js";

const SITE_URL = process.env.SITE_URL || "https://racketreviewhub.com";
const SUPPORTED_LOCALES = ["en", "es", "pt", "it", "fr"] as const;
type SupportedLocale = typeof SUPPORTED_LOCALES[number];

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
  for (const locale of SUPPORTED_LOCALES) {
    const href = locale === "en"
      ? `${SITE_URL}${resourcePath}`
      : `${SITE_URL}/${locale}${resourcePath}`;
    tags.push(`<link rel="alternate" hreflang="${locale}" href="${href}">`);
  }
  tags.push(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}${resourcePath}">`);
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
}

function buildMetaTags(meta: SeoMeta): string {
  const tags: string[] = [];

  tags.push(`<title>${escapeHtml(meta.title)}</title>`);
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
  parts.push(`<h1>${escapeHtml(`${racket.brand} ${racket.model} ${racket.year || ''} Padel Racket Review`.trim())}</h1>`);

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
 * Resolve SEO metadata for a given URL path.
 * Handles both English paths (/rackets/:slug) and locale-prefixed paths (/es/rackets/:slug).
 * Returns null if no special SEO data is needed (uses default HTML).
 */
export async function resolveSeoMeta(path: string): Promise<SeoMeta | null> {
  try {
    // Detect and strip locale prefix from path
    const locale = extractLocaleFromPath(path) ?? "en";
    const resourcePath = locale !== "en" ? stripLocalePrefix(path) : path;

    // Racket detail page: /rackets/:slug (or /es/rackets/:slug)
    const racketMatch = resourcePath.match(/^\/rackets\/([^/]+)$/);
    if (racketMatch) {
      const slug = racketMatch[1];
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

        const title = `${racket.brand} ${racket.model} ${racket.year || ""} Padel Racket Review - Expert Analysis & Best Price`.trim();
        const gameLevel = racket.gameLevel ? `${racket.gameLevel}-level ` : "";
        const shape = racket.shape ? `${racket.shape}-shape ` : "";
        const playStyle = racket.gameType || "all-around";
        const description = `Expert ${racket.brand} ${racket.model} ${racket.year || ""} padel racket review. ${racket.overallRating}/100 rating – ${racket.powerRating} power, ${racket.controlRating} control. ${gameLevel}${shape}racket for ${playStyle} players. Best price comparison & buying guide.`.trim();

        const extracted = extractProsCons(reviewContent);
        const reviewSchema: any = {
          "@type": "Review",
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": racket.overallRating,
            "bestRating": 100,
            "worstRating": 0,
          },
          "author": {
            "@type": "Organization",
            "name": "Padel Racket Reviews",
          },
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
            "name": `${racket.brand} ${racket.model} ${racket.year || ""}`.trim(),
            "brand": { "@type": "Brand", "name": racket.brand },
            "image": racket.imageUrl || undefined,
          },
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": racket.overallRating,
            "bestRating": 100,
            "worstRating": 0,
          },
          "author": { "@type": "Organization", "name": "Padel Racket Reviews" },
          "datePublished": racket.createdAt ? new Date(racket.createdAt).toISOString().split("T")[0] : undefined,
          "dateModified": racket.updatedAt ? new Date(racket.updatedAt).toISOString().split("T")[0] : undefined,
          ...(extracted.pros.length > 0 ? { positiveNotes: reviewSchema.positiveNotes } : {}),
          ...(extracted.cons.length > 0 ? { negativeNotes: reviewSchema.negativeNotes } : {}),
        };

        return {
          title,
          description,
          canonical: racketUrl,
          ogType: "article",
          ogImage: racket.imageUrl || undefined,
          crawlableContent: buildRacketCrawlableHtml(translatedRacket),
          hreflangTags: buildHreflangTags(racketCanonicalPath),
          structuredData: [
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": `${racket.brand} ${racket.model} ${racket.year || ""}`.trim(),
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
        return {
          title,
          description,
          canonical: brandUrl,
          ogType: "article",
          ogImage: brand.logoUrl || undefined,
          crawlableContent: buildBrandCrawlableHtml(brand),
          hreflangTags: buildHreflangTags(brandCanonicalPath),
        };
      }
    }

    // Guide detail page: /guides/:slug
    const guideMatch = resourcePath.match(/^\/guides\/([^/]+)$/);
    if (guideMatch) {
      const guide = await storage.getGuide(guideMatch[1]);
      if (guide) {
        const guideCanonicalPath = `/guides/${guide.slug}`;
        const guideUrl = locale === "en" ? `${SITE_URL}${guideCanonicalPath}` : `${SITE_URL}/${locale}${guideCanonicalPath}`;
        return {
          title: `${guide.title} - Padel Racket Reviews`,
          description: guide.excerpt,
          canonical: guideUrl,
          ogType: "article",
          ogImage: guide.featuredImage || undefined,
          crawlableContent: buildGuideCrawlableHtml(guide),
          hreflangTags: buildHreflangTags(guideCanonicalPath),
        };
      }
    }

    // Blog post page: /blog/:slug
    const blogMatch = resourcePath.match(/^\/blog\/([^/]+)$/);
    if (blogMatch) {
      const post = await storage.getBlogPost(blogMatch[1]);
      if (post) {
        const blogCanonicalPath = `/blog/${post.slug}`;
        const blogUrl = locale === "en" ? `${SITE_URL}${blogCanonicalPath}` : `${SITE_URL}/${locale}${blogCanonicalPath}`;
        return {
          title: `${post.title} - Padel Racket Reviews`,
          description: post.excerpt,
          canonical: blogUrl,
          ogType: "article",
          ogImage: post.featuredImage || undefined,
          crawlableContent: buildBlogCrawlableHtml(post),
          hreflangTags: buildHreflangTags(blogCanonicalPath),
        };
      }
    }

    // Static pages
    if (resourcePath === "/" || resourcePath === "") {
      return {
        title: "Padel Racket Reviews - Expert Reviews & Best Prices",
        description: "Expert padel racket reviews with detailed ratings for power, control, and performance. Find the best prices from top retailers.",
        canonical: locale === "en" ? SITE_URL : `${SITE_URL}/${locale}`,
        ogType: "website",
        hreflangTags: buildHreflangTags("/"),
      };
    }

    if (resourcePath === "/rackets") {
      return {
        title: "All Padel Rackets - Compare Reviews & Prices",
        description: "Browse our complete collection of expert padel racket reviews. Filter by brand, shape, price, and performance ratings.",
        canonical: locale === "en" ? `${SITE_URL}/rackets` : `${SITE_URL}/${locale}/rackets`,
        ogType: "website",
        hreflangTags: buildHreflangTags("/rackets"),
      };
    }

    if (resourcePath === "/guides") {
      return {
        title: "Padel Buying Guides - Expert Advice for Every Level",
        description: "Comprehensive padel racket buying guides for beginners, intermediate, and advanced players. Learn how to choose the right racket.",
        canonical: locale === "en" ? `${SITE_URL}/guides` : `${SITE_URL}/${locale}/guides`,
        ogType: "website",
        hreflangTags: buildHreflangTags("/guides"),
      };
    }

    if (resourcePath === "/brands") {
      return {
        title: "Padel Racket Brands - Top Manufacturers Reviewed",
        description: "Explore top padel racket brands including Babolat, Bullpadel, Head, Adidas, and Nox. Expert reviews and brand comparisons.",
        canonical: locale === "en" ? `${SITE_URL}/brands` : `${SITE_URL}/${locale}/brands`,
        ogType: "website",
        hreflangTags: buildHreflangTags("/brands"),
      };
    }

    if (resourcePath === "/quiz") {
      return {
        title: "Find Your Perfect Padel Racket - Recommendation Quiz",
        description: "Answer 4 quick questions and we'll recommend the best padel racket for your playing level, style, and budget.",
        canonical: locale === "en" ? `${SITE_URL}/quiz` : `${SITE_URL}/${locale}/quiz`,
        ogType: "website",
        hreflangTags: buildHreflangTags("/quiz"),
      };
    }

    return null;
  } catch (error) {
    console.error("[SEO] Error resolving meta for path:", path, error);
    return null;
  }
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
  if (meta.crawlableContent) {
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root">${meta.crawlableContent}</div>`,
    );
  }

  return html;
}
