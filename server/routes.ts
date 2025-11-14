import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import AdmZip from "adm-zip";
import { storage } from "./storage";
import { excelRacketSchema, type ExcelRacket, insertRacketSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateRacketReview } from "./aiService";

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
  // Setup authentication
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Public rackets endpoints
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
    if (!value) return 'round'; // Default to round if no shape specified
    const normalized = String(value).toLowerCase().trim();
    // Map common variations
    if (normalized.includes('diamond') || normalized.includes('diamante') || normalized.includes('diaman')) return 'diamond';
    if (normalized.includes('round') || normalized.includes('redonda') || normalized.includes('circular')) return 'round';
    if (normalized.includes('teardrop') || normalized.includes('tear') || normalized.includes('lágrima') || normalized.includes('hybrid')) return 'teardrop';
    // Default to round for unknown shapes (most versatile)
    return 'round';
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
          // Skip completely empty rows
          const hasAnyData = Object.values(row).some(val => val !== null && val !== undefined && val !== '');
          if (!hasAnyData) {
            continue;
          }

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

          // Get brand and model for rating estimation
          const brand = getBrand();
          const model = getModel();
          
          // Check if we have ratings in the file
          const hasRatings = getPower() !== undefined || getControl() !== undefined;
          
          // If no ratings in file, estimate based on brand and model (deterministic)
          const estimatedRatings = !hasRatings && brand && model ? estimateRatingsByBrand(brand, model) : null;

          const racketData: any = {
            brand,
            model: getModel(),
            year: getYear() || new Date().getFullYear(), // Default to current year if missing
            shape: getShape(),
            powerRating: getPower() || estimatedRatings?.powerRating,
            controlRating: getControl() || estimatedRatings?.controlRating,
            reboundRating: getRebound() || estimatedRatings?.reboundRating,
            maneuverabilityRating: getManeuverability() || estimatedRatings?.maneuverabilityRating,
            sweetSpotRating: getSweetSpot() || estimatedRatings?.sweetSpotRating,
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

      // Add error summary for better user feedback
      const errorSummary: Record<string, number> = {};
      results.errors.forEach(error => {
        if (error.includes('shape:')) errorSummary['Invalid shape value'] = (errorSummary['Invalid shape value'] || 0) + 1;
        else if (error.includes('currentPrice:')) errorSummary['Missing or invalid price'] = (errorSummary['Missing or invalid price'] || 0) + 1;
        else if (error.includes('brand:')) errorSummary['Missing brand'] = (errorSummary['Missing brand'] || 0) + 1;
        else if (error.includes('model:')) errorSummary['Missing model'] = (errorSummary['Missing model'] || 0) + 1;
        else errorSummary['Other errors'] = (errorSummary['Other errors'] || 0) + 1;
      });

      console.log(`Upload complete: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);
      if (Object.keys(errorSummary).length > 0) {
        console.log('Error summary:', errorSummary);
      }

      res.json(results);
    } catch (error) {
      console.error("Excel upload error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to process Excel file" 
      });
    }
  });

  // Protected Admin CRUD endpoints for rackets
  app.post("/api/admin/rackets", isAuthenticated, async (req, res) => {
    try {
      const validated = insertRacketSchema.parse(req.body);
      const racket = await storage.createRacket(validated);
      res.json(racket);
    } catch (error) {
      console.error("Error creating racket:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create racket" });
    }
  });

  app.put("/api/admin/rackets/:id", isAuthenticated, async (req, res) => {
    try {
      const racket = await storage.updateRacket(req.params.id, req.body);
      if (!racket) {
        return res.status(404).json({ error: "Racket not found" });
      }
      res.json(racket);
    } catch (error) {
      console.error("Error updating racket:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update racket" });
    }
  });

  app.delete("/api/admin/rackets/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteRacket(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Racket not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting racket:", error);
      res.status(500).json({ error: "Failed to delete racket" });
    }
  });

  // AI generation endpoint
  app.post("/api/admin/generate-review", isAuthenticated, async (req, res) => {
    try {
      const { brand, model, year, shape, currentPrice, originalPrice } = req.body;
      
      if (!brand || !model || !year || !shape || !currentPrice) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const generatedContent = await generateRacketReview({
        brand,
        model,
        year,
        shape,
        currentPrice,
        originalPrice,
      });

      res.json(generatedContent);
    } catch (error) {
      console.error("Error generating review:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate review" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
