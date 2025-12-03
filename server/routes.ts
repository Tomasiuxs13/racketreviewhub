import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import type { Racket } from "@shared/schema";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "./middleware/jwtAuth.js";
import { validateAdminCredentials, generateToken, verifyToken, isAdminEmail } from "./lib/jwt.js";
import { generateRacketReview, estimateRacketRatings } from "./lib/openai.js";
import {
  applyTranslationsToEntity,
  applyTranslationsToEntities,
  fetchTranslation,
  fetchTranslationsForEntity,
  isValidEntityType,
  upsertTranslation,
} from "./lib/i18n.js";

// Cache duration constants (in seconds)
const CACHE_SHORT = 300; // 5 minutes for list endpoints
const CACHE_MEDIUM = 1800; // 30 minutes for brands, guides
const CACHE_LONG = 3600; // 1 hour for individual items
const CACHE_RACKET = 300; // 5 minutes for racket data (prices update frequently)

/**
 * Set cache headers on response
 * @param res Express response
 * @param maxAge Cache duration in seconds
 * @param data Data to generate ETag from (optional)
 */
function setCacheHeaders(res: Response, maxAge: number, data?: unknown): void {
  res.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`);
  if (data) {
    const etag = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
    res.set('ETag', `"${etag}"`);
  }
}

// Simple hash function to create deterministic pseudo-random values
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Estimate ratings based on brand and model for deterministic results
function estimateRatingsByBrand(brand: string, model: string = ''): {
  powerRating: number;
  controlRating: number;
  reboundRating: number;
  maneuverabilityRating: number;
  sweetSpotRating: number;
} {
  const brandLower = brand.toLowerCase();
  const seed = hashString(`${brandLower}-${model.toLowerCase()}`);
  
  // Generate deterministic pseudo-random offsets based on brand+model hash
  const getOffset = (index: number, range: number) => {
    return (hashString(`${seed}-${index}`) % range);
  };
  
  // High-end professional brands
  if (['nox', 'bullpadel', 'head'].includes(brandLower)) {
    return {
      powerRating: 85 + getOffset(1, 10),
      controlRating: 80 + getOffset(2, 10),
      reboundRating: 82 + getOffset(3, 10),
      maneuverabilityRating: 78 + getOffset(4, 10),
      sweetSpotRating: 80 + getOffset(5, 10),
    };
  }
  
  // Premium brands
  if (['babolat', 'adidas', 'wilson'].includes(brandLower)) {
    return {
      powerRating: 80 + getOffset(1, 10),
      controlRating: 82 + getOffset(2, 10),
      reboundRating: 78 + getOffset(3, 10),
      maneuverabilityRating: 80 + getOffset(4, 10),
      sweetSpotRating: 79 + getOffset(5, 10),
    };
  }
  
  // Mid-tier brands
  if (['dunlop', 'prince', 'tecnifibre'].includes(brandLower)) {
    return {
      powerRating: 75 + getOffset(1, 10),
      controlRating: 77 + getOffset(2, 10),
      reboundRating: 74 + getOffset(3, 10),
      maneuverabilityRating: 76 + getOffset(4, 10),
      sweetSpotRating: 75 + getOffset(5, 10),
    };
  }
  
  // Default for other brands
  return {
    powerRating: 70 + getOffset(1, 15),
    controlRating: 70 + getOffset(2, 15),
    reboundRating: 70 + getOffset(3, 15),
    maneuverabilityRating: 70 + getOffset(4, 15),
    sweetSpotRating: 70 + getOffset(5, 15),
  };
}

// Fields that should be translated for racket reviews
const RACKET_REVIEW_TRANSLATABLE_FIELDS = [
  "reviewContent",
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication endpoints (JWT-based)
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const user = await validateAdminCredentials(email, password);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = generateToken(user);

      res.json({
        user: {
          id: user.userId,
          email: user.email,
          isAdmin: user.isAdmin,
        },
        token,
        // For backward compatibility with client code expecting session
        session: {
          access_token: token,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    // With JWT, logout is handled client-side by removing the token
    res.json({ message: "Logged out successfully" });
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      res.json({
        user: {
          id: req.user?.id,
          email: req.user?.email,
          isAdmin: req.user?.isAdmin,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.post("/api/auth/verify", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ valid: false, error: "No token provided" });
      }

      const token = authHeader.replace("Bearer ", "");
      const payload = verifyToken(token);

      if (!payload) {
        return res.status(401).json({ valid: false, error: "Invalid or expired token" });
      }

      return res.json({
        valid: true,
        user: {
          id: payload.userId,
          email: payload.email,
          isAdmin: isAdminEmail(payload.email),
        },
      });
    } catch (error) {
      console.error("Verify token error:", error);
      return res.status(500).json({ valid: false, error: "Internal server error" });
    }
  });

  // Rackets endpoints
  app.get("/api/rackets", async (req, res) => {
    try {
      // Support compact mode to exclude reviewContent for list views
      const compact = req.query.fields === "compact";
      
      // Only show published rackets to the public
      const rackets = compact 
        ? await storage.getPublishedRacketsCompact()
        : await storage.getPublishedRackets();
      
      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      let result;
      if (locale !== "en" && isValidEntityType("racket_review")) {
        result = await applyTranslationsToEntities(
          rackets as Racket[],
          "racket_review",
          locale,
          RACKET_REVIEW_TRANSLATABLE_FIELDS as any,
        );
      } else {
        result = rackets;
      }
      
      // Set cache headers - 5 minutes for list endpoint
      setCacheHeaders(res, CACHE_SHORT, result);
      res.json(result);
    } catch (error) {
      console.error("Error in GET /api/rackets:", error);
      res.status(500).json({ error: "Failed to fetch rackets" });
    }
  });

  app.get("/api/rackets/search", async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      if (!query || query.trim().length === 0) {
        return res.json([]);
      }

      const allRackets = await storage.getAllRackets();
      const searchTerm = query.toLowerCase().trim();
      
      // Filter and deduplicate by brand+model (case-insensitive)
      const seen = new Map<string, Racket>();
      const filtered = allRackets.filter((racket) => {
        const brandMatch = racket.brand.toLowerCase().includes(searchTerm);
        const modelMatch = racket.model.toLowerCase().includes(searchTerm);
        if (!brandMatch && !modelMatch) {
          return false;
        }

        // Create a unique key for brand+model combination (case-insensitive)
        const key = `${racket.brand.toLowerCase()}:${racket.model.toLowerCase()}`;
        
        // If we've seen this brand+model combination before, skip it
        if (seen.has(key)) {
          return false;
        }
        
        // Keep the first occurrence (or you could keep the one with the highest rating)
        seen.set(key, racket);
        return true;
      });

      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      let results = filtered.slice(0, 8); // Limit to 8 results for preview
      
      if (locale !== "en" && isValidEntityType("racket_review")) {
        results = await applyTranslationsToEntities(
          results,
          "racket_review",
          locale,
          RACKET_REVIEW_TRANSLATABLE_FIELDS as any,
        );
      }

      // Short cache for search results
      setCacheHeaders(res, 60, results);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to search rackets" });
    }
  });

  app.get("/api/rackets/recent", async (req, res) => {
    try {
      const rackets = await storage.getRecentRackets(10);
      
      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      let result;
      if (locale !== "en" && isValidEntityType("racket_review")) {
        result = await applyTranslationsToEntities(
          rackets,
          "racket_review",
          locale,
          RACKET_REVIEW_TRANSLATABLE_FIELDS as any,
        );
      } else {
        result = rackets;
      }
      
      // Cache for 5 minutes
      setCacheHeaders(res, CACHE_SHORT, result);
      res.json(result);
    } catch (error) {
      console.error("Error in GET /api/rackets/recent:", error);
      res.status(500).json({ error: "Failed to fetch recent rackets" });
    }
  });

  app.get("/api/rackets/slug/:slug", async (req, res) => {
    try {
      const racket = await storage.getRacketBySlug(req.params.slug);
      if (!racket) {
        return res.status(404).json({ error: "Racket not found" });
      }
      
      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      let result;
      if (locale !== "en" && isValidEntityType("racket_review")) {
        result = await applyTranslationsToEntity(
          racket,
          "racket_review",
          locale,
          RACKET_REVIEW_TRANSLATABLE_FIELDS as any,
        );
      } else {
        result = racket;
      }
      
      // Cache individual rackets for 5 minutes (prices update frequently)
      setCacheHeaders(res, CACHE_RACKET, result);
      res.json(result);
    } catch (error) {
      console.error("Error in GET /api/rackets/slug/:slug:", error);
      res.status(500).json({ error: "Failed to fetch racket" });
    }
  });

  app.get("/api/rackets/:id", async (req, res) => {
    try {
      const racket = await storage.getRacket(req.params.id);
      if (!racket) {
        return res.status(404).json({ error: "Racket not found" });
      }
      
      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      let result;
      if (locale !== "en" && isValidEntityType("racket_review")) {
        result = await applyTranslationsToEntity(
          racket,
          "racket_review",
          locale,
          RACKET_REVIEW_TRANSLATABLE_FIELDS as any,
        );
      } else {
        result = racket;
      }
      
      // Cache individual rackets for 5 minutes (prices update frequently)
      setCacheHeaders(res, CACHE_RACKET, result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch racket" });
    }
  });

  app.get("/api/rackets/related/:id", async (req, res) => {
    try {
      const related = await storage.getRelatedRackets(req.params.id, 4);
      
      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      let result;
      if (locale !== "en" && isValidEntityType("racket_review")) {
        result = await applyTranslationsToEntities(
          related,
          "racket_review",
          locale,
          RACKET_REVIEW_TRANSLATABLE_FIELDS as any,
        );
      } else {
        result = related;
      }
      
      // Cache related rackets for 30 minutes
      setCacheHeaders(res, CACHE_MEDIUM, result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch related rackets" });
    }
  });

  // Guides endpoints
  app.get("/api/guides", async (req, res) => {
    try {
      const guides = await storage.getAllGuides();
      
      if (!guides || !Array.isArray(guides)) {
        console.error("[guides] Invalid guides data:", guides);
        return res.json([]);
      }
      
      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      let result;
      if (locale !== "en" && isValidEntityType("guide")) {
        try {
          result = await applyTranslationsToEntities(
            guides,
            "guide",
            locale,
            ["title", "excerpt", "content"],
          );
          if (!result || !Array.isArray(result)) {
            console.error("[guides] Translation returned invalid data, using original");
            result = guides;
          }
        } catch (translationError) {
          console.error(`[guides] Translation error for list (${locale}):`, translationError);
          result = guides;
        }
      } else {
        result = guides;
      }
      
      // Cache guides for 30 minutes
      setCacheHeaders(res, CACHE_MEDIUM, result);
      res.json(result);
    } catch (error) {
      console.error("Error in GET /api/guides:", error);
      res.status(500).json({ error: "Failed to fetch guides" });
    }
  });

  app.get("/api/guides/recent", async (req, res) => {
    try {
      const guides = await storage.getRecentGuides(8);
      
      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      let result;
      if (locale !== "en" && isValidEntityType("guide")) {
        try {
          result = await applyTranslationsToEntities(
            guides,
            "guide",
            locale,
            ["title", "excerpt", "content"],
          );
        } catch (translationError) {
          console.error(`[guides] Translation error for recent (${locale}):`, translationError);
          result = guides;
        }
      } else {
        result = guides;
      }
      
      // Cache recent guides for 5 minutes
      setCacheHeaders(res, CACHE_SHORT, result);
      res.json(result);
    } catch (error) {
      console.error("Error in GET /api/guides/recent:", error);
      res.status(500).json({ error: "Failed to fetch recent guides" });
    }
  });

  app.get("/api/guides/:slug", async (req, res) => {
    try {
      const guide = await storage.getGuide(req.params.slug);
      if (!guide) {
        return res.status(404).json({ error: "Guide not found" });
      }
      
      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      let result;
      if (locale !== "en" && isValidEntityType("guide")) {
        try {
          result = await applyTranslationsToEntity(
            guide,
            "guide",
            locale,
            ["title", "excerpt", "content"],
          );
        } catch (translationError) {
          console.error(`[guides] Translation error for ${guide.slug} (${locale}):`, translationError);
          result = guide;
        }
      } else {
        result = guide;
      }
      
      // Cache individual guides for 1 hour
      setCacheHeaders(res, CACHE_LONG, result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch guide" });
    }
  });

  app.get("/api/guides/:slug/related", async (req, res) => {
    try {
      const guide = await storage.getGuide(req.params.slug);
      if (!guide) {
        return res.status(404).json({ error: "Guide not found" });
      }
      const related = await storage.getRelatedGuides(guide.id, guide.category, 3);
      
      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      let result;
      if (locale !== "en" && isValidEntityType("guide")) {
        result = await applyTranslationsToEntities(
          related,
          "guide",
          locale,
          ["title", "excerpt", "content"],
        );
      } else {
        result = related;
      }
      
      // Cache related guides for 30 minutes
      setCacheHeaders(res, CACHE_MEDIUM, result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch related guides" });
    }
  });

  // Brands endpoints
  app.get("/api/brands", async (req, res) => {
    try {
      const brands = await storage.getAllBrands();
      
      // Cache brands for 30 minutes
      setCacheHeaders(res, CACHE_MEDIUM, brands);
      res.json(brands);
    } catch (error) {
      console.error("Error in GET /api/brands:", error);
      res.status(500).json({ error: "Failed to fetch brands" });
    }
  });

  app.get("/api/brands/:slug", async (req, res) => {
    try {
      const brand = await storage.getBrand(req.params.slug);
      if (!brand) {
        return res.status(404).json({ error: "Brand not found" });
      }
      
      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      let result;
      if (locale !== "en" && isValidEntityType("brand")) {
        try {
          result = await applyTranslationsToEntity(
            brand,
            "brand",
            locale,
            ["description", "articleContent"],
          );
        } catch (translationError) {
          console.error(`[brands] Translation error for ${brand.slug} (${locale}):`, translationError);
          result = brand;
        }
      } else {
        result = brand;
      }
      
      // Cache individual brands for 1 hour
      setCacheHeaders(res, CACHE_LONG, result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brand" });
    }
  });

  app.get("/api/brands/:slug/rackets", async (req, res) => {
    try {
      const brand = await storage.getBrand(req.params.slug);
      if (!brand) {
        return res.status(404).json({ error: "Brand not found" });
      }
      const rackets = await storage.getRacketsByBrand(brand.name);
      
      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      let result;
      if (locale !== "en" && isValidEntityType("racket_review")) {
        result = await applyTranslationsToEntities(
          rackets,
          "racket_review",
          locale,
          RACKET_REVIEW_TRANSLATABLE_FIELDS as any,
        );
      } else {
        result = rackets;
      }
      
      // Cache brand rackets for 30 minutes
      setCacheHeaders(res, CACHE_MEDIUM, result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brand rackets" });
    }
  });

  // Blog endpoints
  app.get("/api/blog", async (req, res) => {
    try {
      const posts = await storage.getAllBlogPosts();
      
      if (!posts || !Array.isArray(posts)) {
        console.error("[blog] Invalid posts data:", posts);
        return res.json([]);
      }
      
      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      let result;
      if (locale !== "en" && isValidEntityType("blog_post")) {
        try {
          result = await applyTranslationsToEntities(
            posts,
            "blog_post",
            locale,
            ["title", "excerpt", "content"],
          );
          if (!result || !Array.isArray(result)) {
            console.error("[blog] Translation returned invalid data, using original");
            result = posts;
          }
        } catch (translationError) {
          console.error(`[blog] Translation error for list (${locale}):`, translationError);
          result = posts;
        }
      } else {
        result = posts;
      }
      
      // Cache blog posts for 30 minutes
      setCacheHeaders(res, CACHE_MEDIUM, result);
      res.json(result);
    } catch (error) {
      console.error("Error in GET /api/blog:", error);
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });

  app.get("/api/blog/:slug", async (req, res) => {
    try {
      const post = await storage.getBlogPost(req.params.slug);
      if (!post) {
        return res.status(404).json({ error: "Blog post not found" });
      }
      
      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      let result;
      if (locale !== "en" && isValidEntityType("blog_post")) {
        try {
          result = await applyTranslationsToEntity(
            post,
            "blog_post",
            locale,
            ["title", "excerpt", "content"],
          );
        } catch (translationError) {
          console.error(`[blog] Translation error for ${post.slug} (${locale}):`, translationError);
          result = post;
        }
      } else {
        result = post;
      }
      
      // Cache individual blog posts for 1 hour
      setCacheHeaders(res, CACHE_LONG, result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch blog post" });
    }
  });

  // Author endpoints
  app.get("/api/authors", async (req, res) => {
    try {
      const authors = await storage.getAllAuthors();
      
      // Cache authors for 1 hour (rarely changes)
      setCacheHeaders(res, CACHE_LONG, authors);
      res.json(authors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch authors" });
    }
  });

  app.get("/api/authors/:slug", async (req, res) => {
    try {
      const author = await storage.getAuthor(req.params.slug);
      if (!author) {
        return res.status(404).json({ error: "Author not found" });
      }
      
      // Get author's articles, guides, reviews, and brands
      const [blogPosts, rackets, allGuides, allBrands] = await Promise.all([
        storage.getBlogPostsByAuthor(author.id),
        storage.getRacketsByAuthor(author.id),
        storage.getAllGuides(), // Get all guides since they're all by "Padel Racket Reviews"
        storage.getAllBrands(), // Get all brands since they're all by Carlos Rodriguez
      ]);
      
      // Filter guides and brands - include all if author is Carlos Rodriguez
      // Since guides and brands don't have authorId, we show them for the default author
      const guides = (author.slug === "carlos-rodriguez" || author.name === "Padel Racket Reviews") 
        ? allGuides 
        : [];
      const brands = (author.slug === "carlos-rodriguez") 
        ? allBrands 
        : [];
      
      res.json({
        ...author,
        blogPosts,
        guides,
        rackets,
        brands,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch author" });
    }
  });

  // Helper function to build racket slug (duplicated from client utils for server use)
  function getRacketSlug(racket: { brand: string; model: string }): string {
    const brandSlug = racket.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const modelSlug = racket.model.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${brandSlug}-${modelSlug}`;
  }

  // Sitemap endpoint with hreflang support for multilingual SEO
  const SITEMAP_LOCALES = ['en', 'es', 'pt', 'it', 'fr'];
  
  function buildHrefLangLinks(baseUrl: string, path: string): string {
    let links = '';
    for (const locale of SITEMAP_LOCALES) {
      const href = locale === 'en' ? `${baseUrl}${path}` : `${baseUrl}${path}?lang=${locale}`;
      links += `    <xhtml:link rel="alternate" hreflang="${locale}" href="${href}" />\n`;
    }
    // Add x-default pointing to English version
    links += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${path}" />\n`;
    return links;
  }

  app.get("/sitemap.xml", async (req, res) => {
    try {
      const baseUrl = req.protocol + "://" + req.get("host");
      const rackets = await storage.getAllRackets();
      const brands = await storage.getAllBrands();
      const guides = await storage.getAllGuides();
      const blogPosts = await storage.getAllBlogPosts();

      // Build sitemap XML with xhtml namespace for hreflang
      let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
      sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

      // Homepage (with all language variants)
      for (const locale of SITEMAP_LOCALES) {
        const loc = locale === 'en' ? `${baseUrl}/` : `${baseUrl}/?lang=${locale}`;
        sitemap += `  <url>\n    <loc>${loc}</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n`;
        sitemap += buildHrefLangLinks(baseUrl, '/');
        sitemap += `  </url>\n`;
      }

      // Rackets listing page (with all language variants)
      for (const locale of SITEMAP_LOCALES) {
        const loc = locale === 'en' ? `${baseUrl}/rackets` : `${baseUrl}/rackets?lang=${locale}`;
        sitemap += `  <url>\n    <loc>${loc}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n`;
        sitemap += buildHrefLangLinks(baseUrl, '/rackets');
        sitemap += `  </url>\n`;
      }

      // Individual racket pages (with all language variants)
      for (const racket of rackets) {
        const slug = getRacketSlug(racket);
        const path = `/rackets/${slug}`;
        const lastmod = racket.updatedAt ? new Date(racket.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        for (const locale of SITEMAP_LOCALES) {
          const loc = locale === 'en' ? `${baseUrl}${path}` : `${baseUrl}${path}?lang=${locale}`;
          sitemap += `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n`;
          sitemap += buildHrefLangLinks(baseUrl, path);
          sitemap += `  </url>\n`;
        }
      }

      // Brands listing page (with all language variants)
      for (const locale of SITEMAP_LOCALES) {
        const loc = locale === 'en' ? `${baseUrl}/brands` : `${baseUrl}/brands?lang=${locale}`;
        sitemap += `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n`;
        sitemap += buildHrefLangLinks(baseUrl, '/brands');
        sitemap += `  </url>\n`;
      }

      // Individual brand pages (with all language variants)
      for (const brand of brands) {
        const path = `/brands/${brand.slug}`;
        const lastmod = brand.createdAt ? new Date(brand.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        for (const locale of SITEMAP_LOCALES) {
          const loc = locale === 'en' ? `${baseUrl}${path}` : `${baseUrl}${path}?lang=${locale}`;
          sitemap += `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n`;
          sitemap += buildHrefLangLinks(baseUrl, path);
          sitemap += `  </url>\n`;
        }
      }

      // Guides listing page (with all language variants)
      for (const locale of SITEMAP_LOCALES) {
        const loc = locale === 'en' ? `${baseUrl}/guides` : `${baseUrl}/guides?lang=${locale}`;
        sitemap += `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n`;
        sitemap += buildHrefLangLinks(baseUrl, '/guides');
        sitemap += `  </url>\n`;
      }

      // Individual guide pages (with all language variants)
      for (const guide of guides) {
        const path = `/guides/${guide.slug}`;
        const lastmod = guide.updatedAt ? new Date(guide.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        for (const locale of SITEMAP_LOCALES) {
          const loc = locale === 'en' ? `${baseUrl}${path}` : `${baseUrl}${path}?lang=${locale}`;
          sitemap += `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n`;
          sitemap += buildHrefLangLinks(baseUrl, path);
          sitemap += `  </url>\n`;
        }
      }

      // Blog listing page (with all language variants)
      for (const locale of SITEMAP_LOCALES) {
        const loc = locale === 'en' ? `${baseUrl}/blog` : `${baseUrl}/blog?lang=${locale}`;
        sitemap += `  <url>\n    <loc>${loc}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n`;
        sitemap += buildHrefLangLinks(baseUrl, '/blog');
        sitemap += `  </url>\n`;
      }

      // Individual blog post pages (with all language variants)
      for (const post of blogPosts) {
        const path = `/blog/${post.slug}`;
        const lastmod = post.updatedAt ? new Date(post.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        for (const locale of SITEMAP_LOCALES) {
          const loc = locale === 'en' ? `${baseUrl}${path}` : `${baseUrl}${path}?lang=${locale}`;
          sitemap += `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n`;
          sitemap += buildHrefLangLinks(baseUrl, path);
          sitemap += `  </url>\n`;
        }
      }

      sitemap += '</urlset>';

      res.set('Content-Type', 'application/xml');
      res.send(sitemap);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate sitemap" });
    }
  });

  // Admin CRUD endpoints for rackets
  app.get("/api/admin/rackets", requireAdmin, async (req, res) => {
    try {
      const rackets = await storage.getAllRackets();
      res.json(rackets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rackets" });
    }
  });

  app.get("/api/admin/rackets/:id", requireAdmin, async (req, res) => {
    try {
      const racket = await storage.getRacket(req.params.id);
      if (!racket) {
        return res.status(404).json({ error: "Racket not found" });
      }
      res.json(racket);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch racket" });
    }
  });

  app.post("/api/admin/rackets", requireAdmin, async (req, res) => {
    try {
      const racket = await storage.createRacket(req.body);
      
      // Generate review with ChatGPT if reviewContent is not provided
      if (!racket.reviewContent) {
        try {
          const reviewResult = await generateRacketReview(racket);
          if (reviewResult?.reviewContent) {
            await storage.updateRacket(racket.id, {
              reviewContent: reviewResult.reviewContent,
            });
            // Refetch to get updated racket
            const updatedRacket = await storage.getRacket(racket.id);
            return res.status(201).json(updatedRacket || racket);
          }
        } catch (reviewError) {
          console.error("Failed to generate review, but racket was created:", reviewError);
          // Continue without review - racket creation succeeded
        }
      }
      
      res.status(201).json(racket);
    } catch (error) {
      res.status(500).json({ error: "Failed to create racket" });
    }
  });

  app.put("/api/admin/rackets/:id", requireAdmin, async (req, res) => {
    try {
      const racket = await storage.updateRacket(req.params.id, req.body);
      if (!racket) {
        return res.status(404).json({ error: "Racket not found" });
      }
      
      // Generate review with ChatGPT if reviewContent is not provided or was cleared
      if (!racket.reviewContent) {
        try {
          const reviewResult = await generateRacketReview(racket);
          if (reviewResult?.reviewContent) {
            await storage.updateRacket(racket.id, {
              reviewContent: reviewResult.reviewContent,
            });
            // Refetch to get updated racket
            const updatedRacket = await storage.getRacket(racket.id);
            return res.json(updatedRacket || racket);
          }
        } catch (reviewError) {
          console.error("Failed to generate review, but racket was updated:", reviewError);
          // Continue without review - racket update succeeded
        }
      }
      
      res.json(racket);
    } catch (error) {
      res.status(500).json({ error: "Failed to update racket" });
    }
  });

  app.delete("/api/admin/rackets/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteRacket(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Racket not found" });
      }
      res.json({ message: "Racket deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete racket" });
    }
  });

  // Admin Guides endpoints
  app.get("/api/admin/guides", requireAdmin, async (req, res) => {
    try {
      const guides = await storage.getAllGuides();
      res.json(guides);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch guides" });
    }
  });

  app.put("/api/admin/guides/:id", requireAdmin, async (req, res) => {
    try {
      const guide = await storage.updateGuide(req.params.id, req.body);
      if (!guide) {
        return res.status(404).json({ error: "Guide not found" });
      }
      res.json(guide);
    } catch (error) {
      res.status(500).json({ error: "Failed to update guide" });
    }
  });

  // Admin Blog Posts endpoints
  app.get("/api/admin/blog", requireAdmin, async (req, res) => {
    try {
      const posts = await storage.getAllBlogPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });

  app.put("/api/admin/blog/:id", requireAdmin, async (req, res) => {
    try {
      const post = await storage.updateBlogPost(req.params.id, req.body);
      if (!post) {
        return res.status(404).json({ error: "Blog post not found" });
      }
      res.json(post);
    } catch (error) {
      res.status(500).json({ error: "Failed to update blog post" });
    }
  });

  // Admin Brands endpoints
  app.get("/api/admin/brands", requireAdmin, async (req, res) => {
    try {
      const brands = await storage.getAllBrands();
      res.json(brands);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brands" });
    }
  });

  app.put("/api/admin/brands/:id", requireAdmin, async (req, res) => {
    try {
      const brand = await storage.updateBrand(req.params.id, req.body);
      if (!brand) {
        return res.status(404).json({ error: "Brand not found" });
      }
      res.json(brand);
    } catch (error) {
      res.status(500).json({ error: "Failed to update brand" });
    }
  });

  // Manual review generation endpoint
  app.post("/api/admin/generate-review/:id", requireAdmin, async (req, res) => {
    try {
      const racket = await storage.getRacket(req.params.id);
      if (!racket) {
        return res.status(404).json({ error: "Racket not found" });
      }

      const reviewResult = await generateRacketReview(racket);
      if (!reviewResult) {
        return res.status(500).json({ error: "Failed to generate review" });
      }

      const updatedRacket = await storage.updateRacket(racket.id, {
        reviewContent: reviewResult.reviewContent,
      });

      if (!updatedRacket) {
        return res.status(500).json({ error: "Failed to update racket with review" });
      }

      res.json(updatedRacket);
    } catch (error) {
      console.error("Error generating review:", error);
      res.status(500).json({ error: "Failed to generate review" });
    }
  });

  app.get("/api/admin/translations/:entityType/:entityId", requireAdmin, async (req, res) => {
    const { entityType, entityId } = req.params;
    const localeParam = req.query.locale;

    if (!isValidEntityType(entityType)) {
      return res.status(400).json({ error: "Unsupported entity type" });
    }

    try {
      if (typeof localeParam === "string" && localeParam.trim().length > 0) {
        const fields = await fetchTranslation(entityType, entityId, localeParam);
        return res.json({
          entityType,
          entityId,
          locale: localeParam,
          fields,
        });
      }

      const translations = await fetchTranslationsForEntity(entityType, entityId);
      return res.json({
        entityType,
        entityId,
        translations,
      });
    } catch (error) {
      console.error("Error fetching translations:", error);
      return res.status(500).json({ error: "Failed to fetch translations" });
    }
  });

  app.put("/api/admin/translations", requireAdmin, async (req, res) => {
    const { entityType, entityId, locale, fields } = req.body ?? {};

    if (!isValidEntityType(entityType)) {
      return res.status(400).json({ error: "Unsupported entity type" });
    }

    if (typeof entityId !== "string" || !entityId.trim()) {
      return res.status(400).json({ error: "entityId is required" });
    }

    if (typeof locale !== "string" || locale.trim().length === 0) {
      return res.status(400).json({ error: "locale is required" });
    }

    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      return res.status(400).json({ error: "fields must be an object" });
    }

    const sanitized: Record<string, string> = {};
    Object.entries(fields).forEach(([key, value]) => {
      if (typeof value === "string") {
        sanitized[key] = value;
      } else if (value !== undefined && value !== null) {
        sanitized[key] = String(value);
      }
    });

    if (!Object.keys(sanitized).length) {
      return res.status(400).json({ error: "fields cannot be empty" });
    }

    try {
      await upsertTranslation(entityType, entityId, locale, sanitized);
      const updated = await fetchTranslation(entityType, entityId, locale);
      return res.json({
        entityType,
        entityId,
        locale,
        fields: updated,
      });
    } catch (error) {
      console.error("Error saving translation:", error);
      return res.status(500).json({ error: "Failed to save translation" });
    }
  });

  // CJ Feed Sync Endpoints
  
  // Manual sync trigger - downloads feed from SFTP and processes it
  app.post("/api/admin/cj-sync", requireAdmin, async (req, res) => {
    try {
      const { fetchAndParseCjFeed } = await import("./services/cjFeedSync.js");
      const { processCjFeed } = await import("./services/cjFeedProcessor.js");

      console.log("[CJ-Sync] Starting manual sync...");
      
      // Fetch and parse the feed
      const feedResult = await fetchAndParseCjFeed();
      
      if (!feedResult.success || !feedResult.products) {
        return res.status(500).json({ 
          error: feedResult.error || "Failed to fetch CJ feed",
          details: "Could not download or parse the product feed from CJ SFTP"
        });
      }

      console.log(`[CJ-Sync] Found ${feedResult.padelRackets} padel rackets to process`);

      // Process the products
      const processingResult = await processCjFeed(feedResult.products, {
        generateRatings: true,
        generateReviews: true,
        batchSize: 5,
        delayBetweenBatches: 1000,
      });

      res.json({
        ...processingResult,
        message: `Sync completed: ${processingResult.created} created, ${processingResult.updated} updated, ${processingResult.unchanged} unchanged, ${processingResult.skipped} skipped`,
        totalProducts: feedResult.totalProducts,
        padelRackets: feedResult.padelRackets,
      });
    } catch (error) {
      console.error("[CJ-Sync] Error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to sync CJ feed" 
      });
    }
  });

  // Quick price update - only updates prices, no AI generation (faster)
  app.post("/api/admin/cj-sync/quick", requireAdmin, async (req, res) => {
    try {
      const { fetchAndParseCjFeed } = await import("./services/cjFeedSync.js");
      const { quickPriceUpdate } = await import("./services/cjFeedProcessor.js");

      console.log("[CJ-Sync] Starting quick price update...");
      
      const feedResult = await fetchAndParseCjFeed();
      
      if (!feedResult.success || !feedResult.products) {
        return res.status(500).json({ 
          error: feedResult.error || "Failed to fetch CJ feed"
        });
      }

      const processingResult = await quickPriceUpdate(feedResult.products);

      res.json({
        ...processingResult,
        message: `Quick sync completed: ${processingResult.updated} updated, ${processingResult.unchanged} unchanged`,
      });
    } catch (error) {
      console.error("[CJ-Sync] Quick sync error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to quick sync" 
      });
    }
  });

  // Process local file (for testing or manual import)
  app.post("/api/admin/cj-sync/local", requireAdmin, async (req, res) => {
    try {
      const { parseFeedFromFile } = await import("./services/cjFeedSync.js");
      const { processCjFeed } = await import("./services/cjFeedProcessor.js");

      const filePath = req.body.filePath || "data/PadelNuestro_EU-Padel_Nuestro_Product_Feed_INTERNATIONAL_-shopping.txt";
      
      console.log(`[CJ-Sync] Processing local file: ${filePath}`);
      
      const feedResult = parseFeedFromFile(filePath);
      
      if (!feedResult.success || !feedResult.products) {
        return res.status(400).json({ 
          error: feedResult.error || "Failed to parse local file"
        });
      }

      console.log(`[CJ-Sync] Found ${feedResult.padelRackets} padel rackets in local file`);

      const processingResult = await processCjFeed(feedResult.products, {
        generateRatings: req.body.generateRatings !== false,
        generateReviews: req.body.generateReviews !== false,
        batchSize: req.body.batchSize || 5,
        delayBetweenBatches: req.body.delayBetweenBatches || 1000,
      });

      res.json({
        ...processingResult,
        message: `Local sync completed: ${processingResult.created} created, ${processingResult.updated} updated, ${processingResult.unchanged} unchanged`,
        totalProducts: feedResult.totalProducts,
        padelRackets: feedResult.padelRackets,
      });
    } catch (error) {
      console.error("[CJ-Sync] Local sync error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to process local file" 
      });
    }
  });

  // Get pending (unpublished) rackets
  app.get("/api/admin/pending-rackets", requireAdmin, async (req, res) => {
    try {
      const pendingRackets = await storage.getPendingRackets();
      res.json(pendingRackets);
    } catch (error) {
      console.error("Error fetching pending rackets:", error);
      res.status(500).json({ error: "Failed to fetch pending rackets" });
    }
  });

  // Cleanup duplicate rackets (keeps most recently updated one)
  app.post("/api/admin/cleanup-duplicates", requireAdmin, async (req, res) => {
    try {
      console.log("[Cleanup] Starting duplicate cleanup...");
      
      // Get all rackets
      const allRackets = await storage.getAllRackets();
      
      // Group by brand + model (case-insensitive)
      const groups = new Map<string, typeof allRackets>();
      for (const racket of allRackets) {
        const key = `${racket.brand.toLowerCase()}|${racket.model.toLowerCase()}`;
        const group = groups.get(key) || [];
        group.push(racket);
        groups.set(key, group);
      }
      
      // Find duplicates and delete older ones
      const deleted: { id: string; brand: string; model: string }[] = [];
      const errors: string[] = [];
      
      for (const [key, group] of groups) {
        if (group.length > 1) {
          // Sort by updatedAt descending (newest first)
          group.sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          
          // Keep the first (newest), delete the rest
          const [keep, ...toDelete] = group;
          console.log(`[Cleanup] Keeping: ${keep.brand} ${keep.model} (${keep.id}, updated: ${keep.updatedAt})`);
          
          for (const racket of toDelete) {
            try {
              await storage.deleteRacket(racket.id);
              deleted.push({ id: racket.id, brand: racket.brand, model: racket.model });
              console.log(`[Cleanup] Deleted: ${racket.brand} ${racket.model} (${racket.id})`);
            } catch (err) {
              errors.push(`Failed to delete ${racket.id}: ${err}`);
            }
          }
        }
      }
      
      console.log(`[Cleanup] Complete: ${deleted.length} duplicates removed`);
      
      res.json({
        success: true,
        deleted: deleted.length,
        deletedRackets: deleted,
        errors,
      });
    } catch (error) {
      console.error("[Cleanup] Error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to cleanup duplicates" 
      });
    }
  });

  // Publish a racket (set isPublished to true)
  app.post("/api/admin/publish-racket/:id", requireAdmin, async (req, res) => {
    try {
      const racket = await storage.updateRacket(req.params.id, { isPublished: true });
      if (!racket) {
        return res.status(404).json({ error: "Racket not found" });
      }
      res.json(racket);
    } catch (error) {
      console.error("Error publishing racket:", error);
      res.status(500).json({ error: "Failed to publish racket" });
    }
  });

  // Unpublish a racket (set isPublished to false)
  app.post("/api/admin/unpublish-racket/:id", requireAdmin, async (req, res) => {
    try {
      const racket = await storage.updateRacket(req.params.id, { isPublished: false });
      if (!racket) {
        return res.status(404).json({ error: "Racket not found" });
      }
      res.json(racket);
    } catch (error) {
      console.error("Error unpublishing racket:", error);
      res.status(500).json({ error: "Failed to unpublish racket" });
    }
  });

  // Bulk publish multiple rackets
  app.post("/api/admin/publish-rackets", requireAdmin, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }

      const results = await Promise.all(
        ids.map(id => storage.updateRacket(id, { isPublished: true }))
      );

      const published = results.filter(r => r !== undefined).length;
      res.json({ 
        message: `Published ${published} rackets`,
        published,
        total: ids.length 
      });
    } catch (error) {
      console.error("Error bulk publishing rackets:", error);
      res.status(500).json({ error: "Failed to publish rackets" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
