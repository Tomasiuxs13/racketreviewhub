import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "./middleware/auth.js";
import { createSupabaseClient } from "./lib/supabaseClient.js";
import { generateRacketReview } from "./lib/openai.js";
import {
  applyTranslationsToEntity,
  applyTranslationsToEntities,
  fetchTranslation,
  fetchTranslationsForEntity,
  isValidEntityType,
  upsertTranslation,
} from "./lib/i18n.js";
import { uploadJobManager } from "./services/uploadJobManager.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (increased for .numbers files)
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.numbers'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) or Numbers (.numbers) files are allowed.'));
    }
  },
});

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
  // Authentication endpoints
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const supabase = createSupabaseClient(req);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return res.status(401).json({ error: error.message });
      }

      res.json({
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        session: data.session,
      });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const supabase = createSupabaseClient(req);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.json({
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
        session: data.session,
      });
    } catch (error) {
      res.status(500).json({ error: "Signup failed" });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    try {
      const supabase = createSupabaseClient(req);
      await supabase.auth.signOut();
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      res.status(500).json({ error: "Logout failed" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      res.json({
        user: {
          id: req.user?.id,
          email: req.user?.email,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Rackets endpoints
  app.get("/api/rackets", async (req, res) => {
    try {
      const rackets = await storage.getAllRackets();
      
      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      if (locale !== "en" && isValidEntityType("racket_review")) {
        const translated = await applyTranslationsToEntities(
          rackets,
          "racket_review",
          locale,
          RACKET_REVIEW_TRANSLATABLE_FIELDS as any,
        );
        res.json(translated);
      } else {
        res.json(rackets);
      }
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
      if (locale !== "en" && isValidEntityType("racket_review")) {
        const translated = await applyTranslationsToEntities(
          rackets,
          "racket_review",
          locale,
          RACKET_REVIEW_TRANSLATABLE_FIELDS as any,
        );
        res.json(translated);
      } else {
        res.json(rackets);
      }
    } catch (error) {
      console.error("Error in GET /api/rackets/recent:", error);
      res.status(500).json({ error: "Failed to fetch recent rackets" });
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
      if (locale !== "en" && isValidEntityType("racket_review")) {
        const translated = await applyTranslationsToEntity(
          racket,
          "racket_review",
          locale,
          RACKET_REVIEW_TRANSLATABLE_FIELDS as any,
        );
        res.json(translated);
      } else {
        res.json(racket);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch racket" });
    }
  });

  app.get("/api/rackets/related/:id", async (req, res) => {
    try {
      const related = await storage.getRelatedRackets(req.params.id, 4);
      
      // Apply translations if locale is provided
      const locale = (req.query.lang as string) || "en";
      if (locale !== "en" && isValidEntityType("racket_review")) {
        const translated = await applyTranslationsToEntities(
          related,
          "racket_review",
          locale,
          RACKET_REVIEW_TRANSLATABLE_FIELDS as any,
        );
        res.json(translated);
      } else {
        res.json(related);
      }
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
      if (locale !== "en" && isValidEntityType("guide")) {
        try {
          const translated = await applyTranslationsToEntities(
            guides,
            "guide",
            locale,
            ["title", "excerpt", "content"],
          );
          if (!translated || !Array.isArray(translated)) {
            console.error("[guides] Translation returned invalid data, using original");
            return res.json(guides);
          }
          res.json(translated);
        } catch (translationError) {
          console.error(`[guides] Translation error for list (${locale}):`, translationError);
          // Fallback to original if translation fails
          res.json(guides);
        }
      } else {
        res.json(guides);
      }
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
      if (locale !== "en" && isValidEntityType("guide")) {
        try {
          const translated = await applyTranslationsToEntities(
            guides,
            "guide",
            locale,
            ["title", "excerpt", "content"],
          );
          res.json(translated);
        } catch (translationError) {
          console.error(`[guides] Translation error for recent (${locale}):`, translationError);
          // Fallback to original if translation fails
          res.json(guides);
        }
      } else {
        res.json(guides);
      }
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
      if (locale !== "en" && isValidEntityType("guide")) {
        try {
          const translated = await applyTranslationsToEntity(
            guide,
            "guide",
            locale,
            ["title", "excerpt", "content"],
          );
          res.json(translated);
        } catch (translationError) {
          console.error(`[guides] Translation error for ${guide.slug} (${locale}):`, translationError);
          // Fallback to original if translation fails
          res.json(guide);
        }
      } else {
        res.json(guide);
      }
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
      if (locale !== "en" && isValidEntityType("guide")) {
        const translated = await applyTranslationsToEntities(
          related,
          "guide",
          locale,
          ["title", "excerpt", "content"],
        );
        res.json(translated);
      } else {
        res.json(related);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch related guides" });
    }
  });

  // Brands endpoints
  app.get("/api/brands", async (req, res) => {
    try {
      const brands = await storage.getAllBrands();
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
      if (locale !== "en" && isValidEntityType("brand")) {
        try {
          const translated = await applyTranslationsToEntity(
            brand,
            "brand",
            locale,
            ["description", "articleContent"],
          );
          res.json(translated);
        } catch (translationError) {
          console.error(`[brands] Translation error for ${brand.slug} (${locale}):`, translationError);
          // Fallback to original if translation fails
          res.json(brand);
        }
      } else {
        res.json(brand);
      }
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
      if (locale !== "en" && isValidEntityType("racket_review")) {
        const translated = await applyTranslationsToEntities(
          rackets,
          "racket_review",
          locale,
          RACKET_REVIEW_TRANSLATABLE_FIELDS as any,
        );
        res.json(translated);
      } else {
        res.json(rackets);
      }
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
      if (locale !== "en" && isValidEntityType("blog_post")) {
        try {
          const translated = await applyTranslationsToEntities(
            posts,
            "blog_post",
            locale,
            ["title", "excerpt", "content"],
          );
          if (!translated || !Array.isArray(translated)) {
            console.error("[blog] Translation returned invalid data, using original");
            return res.json(posts);
          }
          res.json(translated);
        } catch (translationError) {
          console.error(`[blog] Translation error for list (${locale}):`, translationError);
          // Fallback to original if translation fails
          res.json(posts);
        }
      } else {
        res.json(posts);
      }
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
      if (locale !== "en" && isValidEntityType("blog_post")) {
        try {
          const translated = await applyTranslationsToEntity(
            post,
            "blog_post",
            locale,
            ["title", "excerpt", "content"],
          );
          res.json(translated);
        } catch (translationError) {
          console.error(`[blog] Translation error for ${post.slug} (${locale}):`, translationError);
          // Fallback to original if translation fails
          res.json(post);
        }
      } else {
        res.json(post);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch blog post" });
    }
  });

  // Author endpoints
  app.get("/api/authors", async (req, res) => {
    try {
      const authors = await storage.getAllAuthors();
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

  // Sitemap endpoint
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const baseUrl = req.protocol + "://" + req.get("host");
      const rackets = await storage.getAllRackets();
      const brands = await storage.getAllBrands();
      const guides = await storage.getAllGuides();
      const blogPosts = await storage.getAllBlogPosts();

      // Build sitemap XML
      let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
      sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      // Homepage
      sitemap += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

      // Rackets listing page
      sitemap += `  <url>\n    <loc>${baseUrl}/rackets</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;

      // Individual racket pages
      for (const racket of rackets) {
        const slug = getRacketSlug(racket);
        const lastmod = racket.updatedAt ? new Date(racket.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        sitemap += `  <url>\n    <loc>${baseUrl}/rackets/${slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }

      // Brands listing page
      sitemap += `  <url>\n    <loc>${baseUrl}/brands</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;

      // Individual brand pages
      for (const brand of brands) {
        const lastmod = brand.createdAt ? new Date(brand.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        sitemap += `  <url>\n    <loc>${baseUrl}/brands/${brand.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      }

      // Guides listing page
      sitemap += `  <url>\n    <loc>${baseUrl}/guides</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;

      // Individual guide pages
      for (const guide of guides) {
        const lastmod = guide.updatedAt ? new Date(guide.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        sitemap += `  <url>\n    <loc>${baseUrl}/guides/${guide.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      }

      // Blog listing page
      sitemap += `  <url>\n    <loc>${baseUrl}/blog</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;

      // Individual blog post pages
      for (const post of blogPosts) {
        const lastmod = post.updatedAt ? new Date(post.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        sitemap += `  <url>\n    <loc>${baseUrl}/blog/${post.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
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

  // Admin endpoints
  app.post(
    "/api/admin/upload-rackets",
    requireAdmin,
    upload.single("file"),
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const job = uploadJobManager.enqueue(
          Buffer.from(req.file.buffer),
          req.file.originalname,
          req.user?.id,
        );

        res.json(job);
      } catch (error) {
        console.error("Failed to enqueue upload job:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "Failed to start upload job",
        });
      }
    },
  );

  app.get("/api/admin/upload-jobs", requireAdmin, async (_req, res) => {
    res.json(uploadJobManager.listJobs());
  });

  app.get("/api/admin/upload-jobs/:id", requireAdmin, async (req, res) => {
    const job = uploadJobManager.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
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

  const httpServer = createServer(app);

  return httpServer;
}
