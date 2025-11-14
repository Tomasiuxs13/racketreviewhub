import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { excelRacketSchema, type ExcelRacket } from "@shared/schema";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Rackets endpoints
  app.get("/api/rackets", async (req, res) => {
    try {
      const rackets = await storage.getAllRackets();
      res.json(rackets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rackets" });
    }
  });

  app.get("/api/rackets/recent", async (req, res) => {
    try {
      const rackets = await storage.getRecentRackets(10);
      res.json(rackets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent rackets" });
    }
  });

  app.get("/api/rackets/:id", async (req, res) => {
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

  app.get("/api/rackets/related/:id", async (req, res) => {
    try {
      const related = await storage.getRelatedRackets(req.params.id, 4);
      res.json(related);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch related rackets" });
    }
  });

  // Guides endpoints
  app.get("/api/guides", async (req, res) => {
    try {
      const guides = await storage.getAllGuides();
      res.json(guides);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch guides" });
    }
  });

  app.get("/api/guides/recent", async (req, res) => {
    try {
      const guides = await storage.getRecentGuides(8);
      res.json(guides);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent guides" });
    }
  });

  app.get("/api/guides/:slug", async (req, res) => {
    try {
      const guide = await storage.getGuide(req.params.slug);
      if (!guide) {
        return res.status(404).json({ error: "Guide not found" });
      }
      res.json(guide);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch guide" });
    }
  });

  // Brands endpoints
  app.get("/api/brands", async (req, res) => {
    try {
      const brands = await storage.getAllBrands();
      res.json(brands);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brands" });
    }
  });

  app.get("/api/brands/:slug", async (req, res) => {
    try {
      const brand = await storage.getBrand(req.params.slug);
      if (!brand) {
        return res.status(404).json({ error: "Brand not found" });
      }
      res.json(brand);
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
      res.json(rackets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brand rackets" });
    }
  });

  // Blog endpoints
  app.get("/api/blog", async (req, res) => {
    try {
      const posts = await storage.getAllBlogPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });

  app.get("/api/blog/:slug", async (req, res) => {
    try {
      const post = await storage.getBlogPost(req.params.slug);
      if (!post) {
        return res.status(404).json({ error: "Blog post not found" });
      }
      res.json(post);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch blog post" });
    }
  });

  // Admin endpoints
  app.post("/api/admin/upload-rackets", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      const results = {
        created: 0,
        updated: 0,
        errors: [] as string[],
        preview: [] as ExcelRacket[],
      };

      // Process each row
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i] as any;
        
        try {
          // Map Excel columns to our schema (handle both camelCase and PascalCase)
          const racketData: any = {
            brand: row.brand || row.Brand,
            model: row.model || row.Model,
            year: Number(row.year || row.Year),
            shape: (row.shape || row.Shape || "").toLowerCase(),
            powerRating: Number(row.powerRating || row.PowerRating || row.power_rating || row.power),
            controlRating: Number(row.controlRating || row.ControlRating || row.control_rating || row.control),
            reboundRating: Number(row.reboundRating || row.ReboundRating || row.rebound_rating || row.rebound),
            maneuverabilityRating: Number(row.maneuverabilityRating || row.ManeuverabilityRating || row.maneuverability_rating || row.maneuverability),
            sweetSpotRating: Number(row.sweetSpotRating || row.SweetSpotRating || row.sweet_spot_rating || row.sweetSpot || row.sweetspot),
            currentPrice: Number(row.currentPrice || row.CurrentPrice || row.current_price || row.price),
            originalPrice: row.originalPrice || row.OriginalPrice || row.original_price ? Number(row.originalPrice || row.OriginalPrice || row.original_price) : undefined,
            imageUrl: row.imageUrl || row.ImageUrl || row.image_url || row.image || undefined,
            affiliateLink: row.affiliateLink || row.AffiliateLink || row.affiliate_link || row.link || undefined,
            reviewContent: row.reviewContent || row.ReviewContent || row.review_content || row.review || undefined,
          };

          // Validate with Zod
          const validated = excelRacketSchema.parse(racketData);
          results.preview.push(validated);

          // Check if racket already exists
          const existing = await storage.getRacketByBrandAndModel(validated.brand, validated.model);

          if (existing) {
            // Update existing racket (primarily for price updates)
            await storage.updateRacket(existing.id, {
              currentPrice: validated.currentPrice.toString(),
              originalPrice: validated.originalPrice?.toString(),
              year: validated.year,
              powerRating: validated.powerRating,
              controlRating: validated.controlRating,
              reboundRating: validated.reboundRating,
              maneuverabilityRating: validated.maneuverabilityRating,
              sweetSpotRating: validated.sweetSpotRating,
              imageUrl: validated.imageUrl,
              affiliateLink: validated.affiliateLink,
              reviewContent: validated.reviewContent,
            });
            results.updated++;
          } else {
            // Create new racket
            await storage.createRacket({
              brand: validated.brand,
              model: validated.model,
              year: validated.year,
              shape: validated.shape,
              powerRating: validated.powerRating,
              controlRating: validated.controlRating,
              reboundRating: validated.reboundRating,
              maneuverabilityRating: validated.maneuverabilityRating,
              sweetSpotRating: validated.sweetSpotRating,
              currentPrice: validated.currentPrice.toString(),
              originalPrice: validated.originalPrice?.toString(),
              imageUrl: validated.imageUrl || null,
              affiliateLink: validated.affiliateLink || null,
              reviewContent: validated.reviewContent || null,
            });
            results.created++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          results.errors.push(`Row ${i + 2}: ${errorMessage}`);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Excel upload error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to process Excel file" 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
