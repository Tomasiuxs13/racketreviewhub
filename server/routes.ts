import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import AdmZip from "adm-zip";
import { storage } from "./storage";
import { excelRacketSchema, type ExcelRacket } from "@shared/schema";

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

  // Helper function to normalize column names
  function normalizeKey(key: string): string {
    return key
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, '_')     // Replace spaces with underscore
      .trim();
  }

  // Helper function to parse numbers from localized strings
  function parseLocalizedNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'number') return value;
    
    // Convert to string and clean
    const str = String(value)
      .replace(/[€$£¥\s]/g, '')  // Remove currency symbols and spaces
      .replace(/,/g, '.')          // Replace comma with dot for EU format
      .trim();
    
    if (str === '') return undefined;
    const num = Number(str);
    return isNaN(num) ? undefined : num;
  }

  // Helper function to normalize shape values
  function normalizeShape(value: any): string {
    if (!value) return '';
    const normalized = String(value).toLowerCase().trim();
    // Map common variations
    if (normalized.includes('diamond') || normalized.includes('diamante')) return 'diamond';
    if (normalized.includes('round') || normalized.includes('redonda')) return 'round';
    if (normalized.includes('teardrop') || normalized.includes('tear') || normalized.includes('lágrima')) return 'teardrop';
    return normalized;
  }

  // Admin endpoints
  app.post("/api/admin/upload-rackets", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Parse Excel files (.xlsx, .xls)
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

      // Log found columns for debugging
      if (rawData.length > 0) {
        const firstRow = rawData[0] as any;
        const foundColumns = Object.keys(firstRow);
        console.log('Found Excel columns:', foundColumns);
        console.log('Normalized columns:', foundColumns.map(normalizeKey));
      }

      // Process each row
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i] as any;
        
        try {
          // Create a normalized key map for easier lookup
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            normalizedRow[normalizeKey(key)] = row[key];
          });

          // Map columns using normalized keys with fallbacks
          const getBrand = () => normalizedRow.brand || normalizedRow.brand_name || normalizedRow.marca;
          const getModel = () => normalizedRow.model || normalizedRow.model_name || normalizedRow.modelo;
          const getYear = () => parseLocalizedNumber(normalizedRow.year || normalizedRow.ano || normalizedRow.year_released);
          const getShape = () => normalizeShape(normalizedRow.shape || normalizedRow.forma || normalizedRow.shape_type);
          
          // Ratings - try multiple column name patterns
          const getPower = () => parseLocalizedNumber(
            normalizedRow.power_rating || normalizedRow.powerrating || normalizedRow.power || 
            normalizedRow.potencia || normalizedRow.rating_power
          );
          const getControl = () => parseLocalizedNumber(
            normalizedRow.control_rating || normalizedRow.controlrating || normalizedRow.control ||
            normalizedRow.rating_control
          );
          const getRebound = () => parseLocalizedNumber(
            normalizedRow.rebound_rating || normalizedRow.reboundrating || normalizedRow.rebound ||
            normalizedRow.salida || normalizedRow.rating_rebound
          );
          const getManeuverability = () => parseLocalizedNumber(
            normalizedRow.maneuverability_rating || normalizedRow.maneuverabilityrating || 
            normalizedRow.maneuverability || normalizedRow.maniobrabilidad || 
            normalizedRow.rating_maneuverability
          );
          const getSweetSpot = () => parseLocalizedNumber(
            normalizedRow.sweet_spot_rating || normalizedRow.sweetspotrating || 
            normalizedRow.sweetspot || normalizedRow.sweet_spot || normalizedRow.punto_dulce ||
            normalizedRow.rating_sweetspot
          );
          
          // Prices - handle EU format and currency symbols
          const getCurrentPrice = () => parseLocalizedNumber(
            normalizedRow.current_price || normalizedRow.currentprice || normalizedRow.price ||
            normalizedRow.precio || normalizedRow.precio_actual
          );
          const getOriginalPrice = () => parseLocalizedNumber(
            normalizedRow.original_price || normalizedRow.originalprice || 
            normalizedRow.precio_original || normalizedRow.rrp
          );
          
          // Optional fields
          const getImageUrl = () => normalizedRow.image_url || normalizedRow.imageurl || normalizedRow.image || normalizedRow.photo;
          const getAffiliateLink = () => normalizedRow.affiliate_link || normalizedRow.affiliatelink || normalizedRow.link || normalizedRow.url;
          const getReview = () => normalizedRow.review_content || normalizedRow.reviewcontent || normalizedRow.review || normalizedRow.description;

          const racketData: any = {
            brand: getBrand(),
            model: getModel(),
            year: getYear() || new Date().getFullYear(), // Default to current year if missing
            shape: getShape(),
            powerRating: getPower(),
            controlRating: getControl(),
            reboundRating: getRebound(),
            maneuverabilityRating: getManeuverability(),
            sweetSpotRating: getSweetSpot(),
            currentPrice: getCurrentPrice(),
            originalPrice: getOriginalPrice(),
            imageUrl: getImageUrl(),
            affiliateLink: getAffiliateLink(),
            reviewContent: getReview(),
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
          // Better error reporting for Zod validation errors
          if (error && typeof error === 'object' && 'issues' in error) {
            const zodError = error as any;
            const issues = zodError.issues.map((issue: any) => 
              `${issue.path.join('.')}: ${issue.message}`
            ).join(', ');
            results.errors.push(`Row ${i + 2}: ${issues}`);
          } else {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            results.errors.push(`Row ${i + 2}: ${errorMessage}`);
          }
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
