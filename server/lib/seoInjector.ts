import { storage } from "../storage.js";

const SITE_URL = process.env.SITE_URL || "https://racketreviewhub.com";

interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
  ogType: string;
  ogImage?: string;
  structuredData?: object[];
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
 * Resolve SEO metadata for a given URL path.
 * Returns null if no special SEO data is needed (uses default HTML).
 */
export async function resolveSeoMeta(path: string): Promise<SeoMeta | null> {
  try {
    // Racket detail page: /rackets/:slug
    const racketMatch = path.match(/^\/rackets\/([^/]+)$/);
    if (racketMatch) {
      const slug = racketMatch[1];
      const racket = await storage.getRacketBySlug(slug);
      if (racket) {
        const title = `${racket.brand} ${racket.model} ${racket.year || ""} Review - Expert Analysis & Best Price`.trim();
        const description = `Expert review of the ${racket.brand} ${racket.model} ${racket.year || ""} padel racket. Overall rating: ${racket.overallRating}/100. Power: ${racket.powerRating}, Control: ${racket.controlRating}.`;
        return {
          title,
          description,
          canonical: `${SITE_URL}/rackets/${buildRacketSlug(racket.brand, racket.model)}`,
          ogType: "article",
          ogImage: racket.imageUrl || undefined,
          structuredData: [
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": `${racket.brand} ${racket.model} ${racket.year || ""}`.trim(),
              "description": description,
              "image": racket.imageUrl ? [racket.imageUrl] : undefined,
              "brand": { "@type": "Brand", "name": racket.brand },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": racket.overallRating,
                "bestRating": 100,
                "worstRating": 0,
                "ratingCount": 1,
              },
              "offers": racket.affiliateLink || racket.titleUrl ? {
                "@type": "Offer",
                "price": racket.currentPrice,
                "priceCurrency": "EUR",
                "availability": racket.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                "url": racket.affiliateLink || racket.titleUrl,
              } : undefined,
            },
          ],
        };
      }
    }

    // Brand detail page: /brands/:slug
    const brandMatch = path.match(/^\/brands\/([^/]+)$/);
    if (brandMatch) {
      const brand = await storage.getBrand(brandMatch[1]);
      if (brand) {
        const year = new Date().getFullYear();
        const title = `Best ${brand.name} Padel Rackets ${year} - Reviews & Buying Guide`;
        const description = brand.description || `Discover the best ${brand.name} padel rackets. Expert reviews, ratings, and buying guide.`;
        return {
          title,
          description,
          canonical: `${SITE_URL}/brands/${brand.slug}`,
          ogType: "article",
          ogImage: brand.logoUrl || undefined,
        };
      }
    }

    // Guide detail page: /guides/:slug
    const guideMatch = path.match(/^\/guides\/([^/]+)$/);
    if (guideMatch) {
      const guide = await storage.getGuide(guideMatch[1]);
      if (guide) {
        return {
          title: `${guide.title} - Padel Racket Reviews`,
          description: guide.excerpt,
          canonical: `${SITE_URL}/guides/${guide.slug}`,
          ogType: "article",
          ogImage: guide.featuredImage || undefined,
        };
      }
    }

    // Blog post page: /blog/:slug
    const blogMatch = path.match(/^\/blog\/([^/]+)$/);
    if (blogMatch) {
      const post = await storage.getBlogPost(blogMatch[1]);
      if (post) {
        return {
          title: `${post.title} - Padel Racket Reviews`,
          description: post.excerpt,
          canonical: `${SITE_URL}/blog/${post.slug}`,
          ogType: "article",
          ogImage: post.featuredImage || undefined,
        };
      }
    }

    // Static pages
    if (path === "/" || path === "") {
      return {
        title: "Padel Racket Reviews - Expert Reviews & Best Prices",
        description: "Expert padel racket reviews with detailed ratings for power, control, and performance. Find the best prices from top retailers.",
        canonical: SITE_URL,
        ogType: "website",
      };
    }

    if (path === "/rackets") {
      return {
        title: "All Padel Rackets - Compare Reviews & Prices",
        description: "Browse our complete collection of expert padel racket reviews. Filter by brand, shape, price, and performance ratings.",
        canonical: `${SITE_URL}/rackets`,
        ogType: "website",
      };
    }

    if (path === "/guides") {
      return {
        title: "Padel Buying Guides - Expert Advice for Every Level",
        description: "Comprehensive padel racket buying guides for beginners, intermediate, and advanced players. Learn how to choose the right racket.",
        canonical: `${SITE_URL}/guides`,
        ogType: "website",
      };
    }

    if (path === "/brands") {
      return {
        title: "Padel Racket Brands - Top Manufacturers Reviewed",
        description: "Explore top padel racket brands including Babolat, Bullpadel, Head, Adidas, and Nox. Expert reviews and brand comparisons.",
        canonical: `${SITE_URL}/brands`,
        ogType: "website",
      };
    }

    if (path === "/quiz") {
      return {
        title: "Find Your Perfect Padel Racket - Recommendation Quiz",
        description: "Answer 4 quick questions and we'll recommend the best padel racket for your playing level, style, and budget.",
        canonical: `${SITE_URL}/quiz`,
        ogType: "website",
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

  return html;
}
