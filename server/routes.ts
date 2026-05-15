import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import sharp from "sharp";
import { storage } from "./storage";
import type { Racket } from "@shared/schema";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "./middleware/jwtAuth.js";
import { validateAdminCredentials, generateToken, verifyToken, isAdminEmail } from "./lib/jwt.js";
import { generateRacketReview, estimateRacketRatings, generateBrandArticle } from "./lib/openai.js";
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
  res.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${Math.round(maxAge * 0.5)}, must-revalidate`);
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
  const SITE_URL = process.env.SITE_URL || "https://racketreviewhub.com";

  // Normalize legacy racket slugs that duplicated the brand prefix.
  // Handles single-word brands ("siux-siux-...") and multi-word brands
  // up to 3 words ("royal-padel-royal-padel-...", "drop-shot-drop-shot-...").
  const DUP_BRAND_RE = /^((?:[a-z0-9]+-){0,2}[a-z0-9]+)-\1-(.+)$/i;

  const normalizeRacketSlug = (slug: string): string => {
    let lower = slug.toLowerCase().replace(/^-+|-+$/g, "").replace(/--+/g, "-");
    // Apply repeatedly in case of nested duplication (rare but safe)
    for (let i = 0; i < 3; i++) {
      const m = lower.match(DUP_BRAND_RE);
      if (!m) break;
      lower = `${m[1]}-${m[2]}`.replace(/--+/g, "-");
    }
    return lower;
  };

  // Redirect legacy duplicated-brand racket URLs to the canonical slug.
  // Supports both /rackets/<slug> and /:locale/rackets/<slug>.
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    const racketMatch = req.path.match(/^(\/[a-z]{2})?\/rackets\/([^/]+)$/i);
    if (!racketMatch) return next();
    const localePrefix = racketMatch[1] || "";
    const rawSlug = racketMatch[2];
    const normalized = normalizeRacketSlug(rawSlug);
    if (normalized === rawSlug.toLowerCase()) return next();
    const query = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
    return res.redirect(301, `${localePrefix}/rackets/${normalized}${query}`);
  });

  // robots.txt - directs crawlers away from API/admin routes and points to sitemap
  app.get("/robots.txt", (req, res) => {
    const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;
    const content = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /admin",
      "Disallow: /login",
      "Disallow: /signup",
      "Disallow: /compare",
      "",
      `Sitemap: ${siteUrl}/sitemap.xml`,
    ].join("\n");
    res.set("Content-Type", "text/plain");
    res.set("Cache-Control", "public, max-age=86400"); // cache 24h
    res.send(content);
  });

  // Image Optimization Proxy
  app.get("/api/images/optimize", async (req, res) => {
    try {
      const url = req.query.url as string;
      const width = parseInt(req.query.w as string, 10);

      if (!url) {
        return res.status(400).json({ error: "Missing url parameter" });
      }

      // Fetch the original image
      const fetchReq = await fetch(url);
      if (!fetchReq.ok) {
        throw new Error(`Failed to fetch image: ${fetchReq.statusText}`);
      }

      const arrayBuffer = await fetchReq.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Process with Sharp
      let pipeline = sharp(buffer);
      if (width && !isNaN(width)) {
        pipeline = pipeline.resize({ width, withoutEnlargement: true });
      }

      // Convert to WebP
      const optimizedBuffer = await pipeline.webp({ quality: 80 }).toBuffer();

      // Send the response with caching headers
      res.set("Content-Type", "image/webp");
      res.set("Cache-Control", "public, max-age=31536000, immutable"); // Cache for 1 year since feed URLs are essentially immutable
      res.send(optimizedBuffer);
    } catch (error) {
      console.error("Image optimization error:", error);
      // Fallback: redirect to original URL if processing fails
      const url = req.query.url as string;
      if (url) {
        return res.redirect(302, url);
      }
      res.status(500).json({ error: "Failed to optimize image" });
    }
  });

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
  app.get("/api/rackets/best/:category", async (req, res) => {
    try {
      const category = req.params.category;
      const limit = parseInt(req.query.limit as string) || 10;

      const rackets = await storage.getBestOfRackets(category, limit);

      const locale = req.query.lang as string;
      let responseRackets = rackets;
      if (locale && locale !== "en") {
        responseRackets = await applyTranslationsToEntities(
          rackets,
          "racket",
          locale,
          RACKET_REVIEW_TRANSLATABLE_FIELDS as any
        ) as any;
      }

      setCacheHeaders(res, CACHE_SHORT);
      res.json(responseRackets);
    } catch (error) {
      console.error("Error fetching best of rackets:", error);
      res.status(500).json({ error: "Failed to fetch best of rackets" });
    }
  });

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
      const requestedSlug = (req.params.slug || "").toLowerCase();
      const normalizedSlug = normalizeRacketSlug(requestedSlug);

      let racket = await storage.getRacketBySlug(normalizedSlug);
      if (!racket && normalizedSlug !== requestedSlug) {
        // Fallback to the raw slug in case other legacy variants exist
        racket = await storage.getRacketBySlug(requestedSlug);
      }

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

      // Hint canonical if the requested slug differs from the computed one
      const canonicalSlug = getRacketSlug(racket);
      if (canonicalSlug !== requestedSlug) {
        const query = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
        res.set("Link", `<${req.protocol}://${req.get("host")}/rackets/${canonicalSlug}${query}>; rel="canonical"`);
      }

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

  // Price history endpoint
  app.get("/api/rackets/:id/price-history", async (req, res) => {
    try {
      const history = await storage.getPriceHistory(req.params.id);
      setCacheHeaders(res, CACHE_RACKET, history);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price history" });
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
    const modelStartsWithBrand = modelSlug.startsWith(brandSlug);
    const base = modelStartsWithBrand ? modelSlug : `${brandSlug}-${modelSlug}`;
    return base.replace(/--+/g, "-").replace(/^-|-$/g, "");
  }

  // Sitemap with hreflang support, split into sub-sitemaps with 6-hour caching
  const SITEMAP_LOCALES = ['en', 'es', 'pt', 'it', 'fr'];
  const SITEMAP_CACHE_SECONDS = 6 * 60 * 60; // 6 hours
  const sitemapCache = new Map<string, { xml: string; timestamp: number }>();

  function buildHrefLangLinks(baseUrl: string, path: string): string {
    let links = '';
    for (const locale of SITEMAP_LOCALES) {
      // Use path-based locale URLs for non-English: /es/rackets/slug
      const localePath = locale === 'en' ? path : `/${locale}${path}`;
      const href = `${baseUrl}${localePath}`;
      links += `    <xhtml:link rel="alternate" hreflang="${locale}" href="${href}" />\n`;
    }
    // x-default points to English (no prefix)
    links += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${path}" />\n`;
    return links;
  }

  function urlsetHeader(): string {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  }

  function buildUrlEntry(baseUrl: string, path: string, changefreq: string, priority: string, lastmod?: string): string {
    let entries = '';
    for (const locale of SITEMAP_LOCALES) {
      // Use path-based locale URLs: /es/rackets/slug (not ?lang=es)
      const localePath = locale === 'en' ? path : `/${locale}${path}`;
      const loc = `${baseUrl}${localePath}`;
      entries += `  <url>\n    <loc>${loc}</loc>\n`;
      if (lastmod) entries += `    <lastmod>${lastmod}</lastmod>\n`;
      entries += `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n`;
      entries += buildHrefLangLinks(baseUrl, path);
      entries += `  </url>\n`;
    }
    return entries;
  }

  function sendCachedSitemap(res: Response, cacheKey: string, generator: () => Promise<string>) {
    const cached = sitemapCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SITEMAP_CACHE_SECONDS * 1000) {
      res.set('Content-Type', 'application/xml');
      res.set('Cache-Control', `public, max-age=${SITEMAP_CACHE_SECONDS}`);
      return res.send(cached.xml);
    }
    return generator().then(xml => {
      sitemapCache.set(cacheKey, { xml, timestamp: Date.now() });
      res.set('Content-Type', 'application/xml');
      res.set('Cache-Control', `public, max-age=${SITEMAP_CACHE_SECONDS}`);
      res.send(xml);
    });
  }

  // Sitemap index - points to sub-sitemaps
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const baseUrl = SITE_URL;
      const now = new Date().toISOString().split('T')[0];
      let index = '<?xml version="1.0" encoding="UTF-8"?>\n';
      index += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      for (const type of ['pages', 'rackets', 'brands', 'compare', 'guides', 'blog', 'authors']) {
        index += `  <sitemap>\n    <loc>${baseUrl}/sitemap-${type}.xml</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>\n`;
      }
      index += '</sitemapindex>';
      res.set('Content-Type', 'application/xml');
      res.set('Cache-Control', `public, max-age=${SITEMAP_CACHE_SECONDS}`);
      res.send(index);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate sitemap index" });
    }
  });

  // Sub-sitemap: static pages
  app.get("/sitemap-pages.xml", async (req, res) => {
    sendCachedSitemap(res, 'pages', async () => {
      const baseUrl = SITE_URL;
      let xml = urlsetHeader();
      xml += buildUrlEntry(baseUrl, '/', 'daily', '1.0');
      xml += buildUrlEntry(baseUrl, '/rackets', 'daily', '0.9');
      xml += buildUrlEntry(baseUrl, '/brands', 'weekly', '0.8');
      xml += buildUrlEntry(baseUrl, '/guides', 'weekly', '0.8');
      xml += buildUrlEntry(baseUrl, '/blog', 'daily', '0.8');
      xml += buildUrlEntry(baseUrl, '/best/power', 'weekly', '0.8');
      xml += buildUrlEntry(baseUrl, '/best/control', 'weekly', '0.8');
      xml += buildUrlEntry(baseUrl, '/best/beginner', 'weekly', '0.8');
      xml += buildUrlEntry(baseUrl, '/best/advanced', 'weekly', '0.8');
      xml += buildUrlEntry(baseUrl, '/best/budget', 'weekly', '0.8');
      xml += buildUrlEntry(baseUrl, '/best/overall', 'weekly', '0.8');
      xml += buildUrlEntry(baseUrl, '/quiz', 'monthly', '0.6');
      xml += buildUrlEntry(baseUrl, '/about', 'monthly', '0.5');
      xml += buildUrlEntry(baseUrl, '/methodology', 'monthly', '0.5');
      xml += buildUrlEntry(baseUrl, '/contact', 'monthly', '0.4');
      xml += buildUrlEntry(baseUrl, '/privacy', 'yearly', '0.2');
      xml += buildUrlEntry(baseUrl, '/terms', 'yearly', '0.2');
      xml += buildUrlEntry(baseUrl, '/disclosure', 'yearly', '0.2');
      xml += '</urlset>';
      return xml;
    });
  });

  // Sub-sitemap: rackets — only include pages with real review content and a
  // valid overall rating. Thin auto-generated pages without editorial signal
  // are intentionally excluded so Google focuses crawl budget on high-quality URLs.
  // Override via env to tune without a code change.
  const SITEMAP_MIN_REVIEW_LENGTH = Number(process.env.SEO_MIN_REVIEW_LENGTH) || 800;
  const SITEMAP_MIN_RATING = Number(process.env.SEO_MIN_RATING) || 60;

  app.get("/sitemap-rackets.xml", async (req, res) => {
    sendCachedSitemap(res, 'rackets', async () => {
      const baseUrl = SITE_URL;
      const allRackets = await storage.getPublishedRackets();
      const eligible = allRackets.filter(r => {
        const reviewLen = (r.reviewContent || "").trim().length;
        const rating = Number(r.overallRating) || 0;
        return reviewLen >= SITEMAP_MIN_REVIEW_LENGTH && rating >= SITEMAP_MIN_RATING;
      });
      let xml = urlsetHeader();
      for (const racket of eligible) {
        const slug = getRacketSlug(racket);
        const lastmod = racket.updatedAt ? new Date(racket.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        xml += buildUrlEntry(baseUrl, `/rackets/${slug}`, 'weekly', '0.8', lastmod);
      }
      xml += '</urlset>';
      return xml;
    });
  });

  // Sub-sitemap: comparison pages. Generates A-vs-B URLs for sensible pairs
  // (same brand, both eligible by sitemap quality thresholds). Capped so we
  // don't flood the sitemap with combinatorial junk.
  const COMPARE_SITEMAP_MAX_PER_BRAND = 10; // top N rackets per brand
  const COMPARE_SITEMAP_MAX_TOTAL = 500;     // overall cap

  app.get("/sitemap-compare.xml", async (req, res) => {
    sendCachedSitemap(res, 'compare', async () => {
      const baseUrl = SITE_URL;
      const allRackets = await storage.getPublishedRackets();
      const eligible = allRackets.filter(r => {
        const reviewLen = (r.reviewContent || "").trim().length;
        const rating = Number(r.overallRating) || 0;
        return reviewLen >= SITEMAP_MIN_REVIEW_LENGTH && rating >= SITEMAP_MIN_RATING;
      });

      // Group by brand, keep top N per brand, then build all pairs within a brand.
      const byBrand = new Map<string, typeof eligible>();
      for (const r of eligible) {
        const list = byBrand.get(r.brand) || [];
        list.push(r);
        byBrand.set(r.brand, list);
      }

      const pairs: Array<[any, any]> = [];
      for (const [, list] of Array.from(byBrand.entries())) {
        const sorted = list.sort((a, b) => (Number(b.overallRating) || 0) - (Number(a.overallRating) || 0));
        const top = sorted.slice(0, COMPARE_SITEMAP_MAX_PER_BRAND);
        for (let i = 0; i < top.length; i++) {
          for (let j = i + 1; j < top.length; j++) {
            pairs.push([top[i], top[j]]);
            if (pairs.length >= COMPARE_SITEMAP_MAX_TOTAL) break;
          }
          if (pairs.length >= COMPARE_SITEMAP_MAX_TOTAL) break;
        }
        if (pairs.length >= COMPARE_SITEMAP_MAX_TOTAL) break;
      }

      let xml = urlsetHeader();
      for (const [a, b] of pairs) {
        const slugA = getRacketSlug(a);
        const slugB = getRacketSlug(b);
        // Deterministic ordering so a-vs-b and b-vs-a don't both appear
        const [first, second] = slugA < slugB ? [slugA, slugB] : [slugB, slugA];
        const lastmod = new Date().toISOString().split('T')[0];
        xml += buildUrlEntry(baseUrl, `/compare/${first}-vs-${second}`, 'monthly', '0.6', lastmod);
      }
      xml += '</urlset>';
      return xml;
    });
  });

  // Sub-sitemap: brands
  app.get("/sitemap-brands.xml", async (req, res) => {
    sendCachedSitemap(res, 'brands', async () => {
      const baseUrl = SITE_URL;
      const allBrands = await storage.getAllBrands();
      let xml = urlsetHeader();
      for (const brand of allBrands) {
        const lastmod = brand.createdAt ? new Date(brand.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        xml += buildUrlEntry(baseUrl, `/brands/${brand.slug}`, 'weekly', '0.7', lastmod);
      }
      xml += '</urlset>';
      return xml;
    });
  });

  // Sub-sitemap: guides
  app.get("/sitemap-guides.xml", async (req, res) => {
    sendCachedSitemap(res, 'guides', async () => {
      const baseUrl = SITE_URL;
      const allGuides = await storage.getAllGuides();
      let xml = urlsetHeader();
      for (const guide of allGuides) {
        const lastmod = guide.updatedAt ? new Date(guide.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        xml += buildUrlEntry(baseUrl, `/guides/${guide.slug}`, 'monthly', '0.7', lastmod);
      }
      xml += '</urlset>';
      return xml;
    });
  });

  // Sub-sitemap: blog posts
  app.get("/sitemap-blog.xml", async (req, res) => {
    sendCachedSitemap(res, 'blog', async () => {
      const baseUrl = SITE_URL;
      const allPosts = await storage.getAllBlogPosts();
      let xml = urlsetHeader();
      for (const post of allPosts) {
        const lastmod = post.updatedAt ? new Date(post.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        xml += buildUrlEntry(baseUrl, `/blog/${post.slug}`, 'monthly', '0.7', lastmod);
      }
      xml += '</urlset>';
      return xml;
    });
  });

  // Sub-sitemap: authors
  app.get("/sitemap-authors.xml", async (req, res) => {
    sendCachedSitemap(res, 'authors', async () => {
      const baseUrl = SITE_URL;
      const allAuthors = await storage.getAllAuthors();
      let xml = urlsetHeader();
      for (const author of allAuthors) {
        xml += buildUrlEntry(baseUrl, `/authors/${author.slug}`, 'monthly', '0.5');
      }
      xml += '</urlset>';
      return xml;
    });
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

  // Generate brand article with AI
  app.post("/api/admin/brands/:id/generate-article", requireAdmin, async (req, res) => {
    try {
      const brand = await storage.getBrandById(req.params.id);
      if (!brand) {
        return res.status(404).json({ error: "Brand not found" });
      }

      const brandRackets = await storage.getRacketsByBrand(brand.name);
      const article = await generateBrandArticle(brand, brandRackets);
      if (!article) {
        return res.status(500).json({ error: "Failed to generate article" });
      }

      const updated = await storage.updateBrand(brand.id, { articleContent: article });
      res.json({ success: true, brand: updated });
    } catch (error) {
      console.error("Error generating brand article:", error);
      res.status(500).json({ error: "Failed to generate brand article" });
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

  // Padel Market Feed Sync Endpoints

  // Manual sync trigger - downloads feed from Awin URL and processes it
  app.post("/api/admin/padel-market-sync", requireAdmin, async (req, res) => {
    try {
      const { fetchAndParsePadelMarketFeed } = await import("./services/padelMarketFeedSync.js");
      const { processPadelMarketFeed } = await import("./services/padelMarketFeedProcessor.js");

      console.log("[PadelMarket-Sync] Starting manual sync...");

      // Fetch and parse the feed
      const feedResult = await fetchAndParsePadelMarketFeed();

      if (!feedResult.success || !feedResult.products) {
        return res.status(500).json({
          error: feedResult.error || "Failed to fetch Padel Market feed",
          details: "Could not download or parse the product feed from Awin"
        });
      }

      console.log(`[PadelMarket-Sync] Found ${feedResult.rackets} rackets in stock to process`);

      // Process the products
      const processingResult = await processPadelMarketFeed(feedResult.products);

      res.json({
        ...processingResult,
        message: `Sync completed: ${processingResult.matched} matched, ${processingResult.updated} updated, ${processingResult.unchanged} unchanged, ${processingResult.skipped} skipped`,
        totalProducts: feedResult.totalProducts,
        rackets: feedResult.rackets,
      });
    } catch (error) {
      console.error("[PadelMarket-Sync] Error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to sync Padel Market feed"
      });
    }
  });

  // Process local file (for testing or manual import)
  app.post("/api/admin/padel-market-sync/local", requireAdmin, async (req, res) => {
    try {
      const { parsePadelMarketFeedFromFile } = await import("./services/padelMarketFeedSync.js");
      const { processPadelMarketFeed } = await import("./services/padelMarketFeedProcessor.js");

      const filePath = req.body.filePath || "data/padel-market-feed.csv.gz";

      console.log(`[PadelMarket-Sync] Processing local file: ${filePath}`);

      const feedResult = parsePadelMarketFeedFromFile(filePath);

      if (!feedResult.success || !feedResult.products) {
        return res.status(500).json({
          error: feedResult.error || "Failed to parse local file",
          details: "Could not parse the product feed from local file"
        });
      }

      console.log(`[PadelMarket-Sync] Found ${feedResult.rackets} rackets in stock to process`);

      // Process the products
      const processingResult = await processPadelMarketFeed(feedResult.products);

      res.json({
        ...processingResult,
        message: `Local sync completed: ${processingResult.matched} matched, ${processingResult.updated} updated, ${processingResult.unchanged} unchanged`,
        totalProducts: feedResult.totalProducts,
        rackets: feedResult.rackets,
      });
    } catch (error) {
      console.error("[PadelMarket-Sync] Local sync error:", error);
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

  // Admin statistics endpoint
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const allRackets = await storage.getAllRackets();
      const publishedRackets = await storage.getPublishedRackets();
      const pendingRackets = await storage.getPendingRackets();
      const guides = await storage.getAllGuides();
      const brands = await storage.getAllBrands();
      const blogPosts = await storage.getAllBlogPosts();

      // Calculate statistics
      const stats = {
        rackets: {
          total: allRackets.length,
          published: publishedRackets.length,
          pending: pendingRackets.length,
          inStock: allRackets.filter(r => r.inStock).length,
          outOfStock: allRackets.filter(r => !r.inStock).length,
          withPadelMarket: allRackets.filter(r => r.padelMarketInStock && r.padelMarketAffiliateLink).length,
          withPadelNuestro: allRackets.filter(r => r.inStock && (r.affiliateLink || r.titleUrl)).length,
        },
        guides: {
          total: guides.length,
        },
        brands: {
          total: brands.length,
        },
        blogPosts: {
          total: blogPosts.length,
        },
        recentActivity: {
          recentRackets: allRackets
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5)
            .map(r => ({
              id: r.id,
              brand: r.brand,
              model: r.model,
              createdAt: r.createdAt,
              isPublished: r.isPublished,
            })),
        },
      };

      res.json(stats);
    } catch (error) {
      console.error("[Admin] Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
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

  // Newsletter subscribe endpoint
  app.post("/api/subscribe", async (req, res) => {
    try {
      const { email, source } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ error: "Invalid email address" });
      }

      const validSources = ["homepage", "review_page", "footer"];
      const subscriberSource = validSources.includes(source) ? source : "homepage";

      // Check if already subscribed
      const existing = await storage.getEmailSubscriberByEmail(email.trim().toLowerCase());
      if (existing) {
        return res.json({ success: true, message: "Already subscribed" });
      }

      await storage.createEmailSubscriber({
        email: email.trim().toLowerCase(),
        source: subscriberSource,
      });

      res.json({ success: true, message: "Successfully subscribed" });
    } catch (error) {
      console.error("Error subscribing:", error);
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
