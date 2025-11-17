import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import AdmZip from "adm-zip";
import { storage } from "./storage";
import { excelRacketSchema, type ExcelRacket } from "@shared/schema";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "./middleware/auth.js";
import { createSupabaseClient } from "./lib/supabaseClient.js";
import { generateRacketReview } from "./lib/openai.js";

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
      res.json(rackets);
    } catch (error) {
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
      
      const results = allRackets
        .filter((racket) => {
          const brandMatch = racket.brand.toLowerCase().includes(searchTerm);
          const modelMatch = racket.model.toLowerCase().includes(searchTerm);
          return brandMatch || modelMatch;
        })
        .slice(0, 8); // Limit to 8 results for preview

      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to search rackets" });
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

  app.get("/api/guides/:slug/related", async (req, res) => {
    try {
      const guide = await storage.getGuide(req.params.slug);
      if (!guide) {
        return res.status(404).json({ error: "Guide not found" });
      }
      const related = await storage.getRelatedGuides(guide.id, guide.category, 3);
      res.json(related);
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
  app.post("/api/admin/upload-rackets", requireAdmin, upload.single("file"), async (req, res) => {
    const uploadStartTime = Date.now();
    const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log(`[${uploadId}] Starting upload: ${req.file.originalname}, size: ${req.file.size} bytes`);

      // Check file extension
      const fileExt = req.file.originalname.toLowerCase().slice(req.file.originalname.lastIndexOf('.'));
      
      let rawData: any[] = [];
      
      if (fileExt === '.numbers') {
        // Handle .numbers files
        try {
          const { parseNumbersFile } = await import("./numbersParser.js");
          rawData = await parseNumbersFile(req.file.buffer);
        } catch (numbersError) {
          console.error("Error parsing .numbers file:", numbersError);
          return res.status(400).json({ 
            error: numbersError instanceof Error ? numbersError.message : "Failed to parse .numbers file. Please export as Excel (.xlsx) format." 
          });
        }
      } else {
        // Parse Excel files (.xlsx, .xls)
        try {
          const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          rawData = XLSX.utils.sheet_to_json(worksheet);
        } catch (excelError) {
          console.error("Error parsing Excel file:", excelError);
          return res.status(400).json({ 
            error: excelError instanceof Error ? excelError.message : "Failed to parse Excel file. Please ensure the file is a valid .xlsx or .xls file." 
          });
        }
      }

      const results = {
        created: 0,
        updated: 0,
        errors: [] as string[],
        preview: [] as ExcelRacket[],
        totalRows: rawData.length,
        processedRows: 0,
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
          
          // Increment processed rows counter
          results.processedRows++;

          // Create a normalized key map for easier lookup
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            normalizedRow[normalizeKey(key)] = row[key];
          });
          
          // Debug: Log available column names on first row
          if (i === 0) {
            console.log('Available column names (normalized):', Object.keys(normalizedRow).join(', '));
          }

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
          const getOriginalPrice = () => {
            // Try to find previous/original price in multiple ways
            // First check normalized keys - try each one and parse immediately
            const normalizedKeys = [
              'previous_price',    // "Previous price" column (most common)
              'price1',            // "Price1" column (alternative format)
              'original_price',    // "Original price" column
              'originalprice',     // "OriginalPrice" (no space)
              'precio_original',  // Spanish
              'rrp',               // Recommended retail price
              'previousprice',     // "PreviousPrice" (no space)
              'previous',          // Just "Previous"
              'old_price',         // "Old price"
              'oldprice',          // "OldPrice"
              'old',               // Just "Old"
              'list_price',        // "List price"
              'listprice',         // "ListPrice"
              'list',              // Just "List"
              'msrp',              // MSRP
              'retail_price',      // "Retail price"
              'retailprice',       // "RetailPrice"
            ];
            
            // Try normalized keys first
            for (const key of normalizedKeys) {
              const value = normalizedRow[key];
              if (value !== null && value !== undefined && value !== '') {
                const parsedValue = parseLocalizedNumber(value);
                if (parsedValue !== undefined && parsedValue !== null) {
                  if (i === 0 || i < 3) {
                    console.log(`✓ Found original/previous price in normalized key "${key}": "${value}" -> ${parsedValue}`);
                  }
                  return parsedValue;
                }
              }
            }
            
            // If not found in normalized keys, search through original row keys
            // This handles edge cases where normalization might not work as expected
            if (i === 0) {
              console.log('=== Searching for previous/original price column in original keys ===');
              console.log('All row keys:', Object.keys(row));
              console.log('All normalized keys:', Object.keys(normalizedRow));
            }
            
            for (const key in row) {
              const lowerKey = key.toLowerCase().trim();
              const normalizedKey = normalizeKey(key);
              const rowValue = row[key];
              
              // Skip if empty
              if (rowValue === null || rowValue === undefined || rowValue === '') {
                continue;
              }
              
              // Check if this normalized key matches any of our target keys
              const matchesNormalizedKey = normalizedKeys.includes(normalizedKey);
              
              // Also check if the original key contains price-related terms
              const isPriceColumn = lowerKey.includes('previous') || 
                                   lowerKey.includes('original') || 
                                   lowerKey.includes('old') || 
                                   lowerKey.includes('rrp') || 
                                   lowerKey.includes('list') || 
                                   lowerKey.includes('msrp') || 
                                   lowerKey.includes('retail') ||
                                   lowerKey.includes('before');
              
              const hasPriceTerm = lowerKey.includes('price') || lowerKey.includes('cost');
              
              // Check for "Price1" specifically
              if (lowerKey === 'price1' || lowerKey === 'price_1' || normalizedKey === 'price1') {
                const foundValue = parseLocalizedNumber(rowValue);
                if (foundValue !== undefined && foundValue !== null) {
                  console.log(`✓ Found original/previous price in column "${key}" (Price1): "${rowValue}" -> ${foundValue}`);
                  return foundValue;
                }
              }
              
              // Match if: normalized key matches OR (has price term AND is price-related) OR (is clearly a previous/original price column)
              if (matchesNormalizedKey || 
                  (isPriceColumn && hasPriceTerm) || 
                  (isPriceColumn && !lowerKey.includes('current'))) {
                
                if (i === 0) {
                  console.log(`Checking column "${key}" (normalized: "${normalizedKey}"): value = "${rowValue}"`);
                }
                
                const foundValue = parseLocalizedNumber(rowValue);
                if (foundValue !== undefined && foundValue !== null) {
                  console.log(`✓ Found original/previous price in column "${key}": "${rowValue}" -> ${foundValue}`);
                  return foundValue;
                } else if (rowValue !== null && rowValue !== undefined && rowValue !== '') {
                  if (i === 0) {
                    console.log(`✗ Column "${key}" has value "${rowValue}" but failed to parse as number`);
                  }
                }
              }
            }
            
            if (i === 0) {
              console.log('=== No previous/original price found ===');
            }
            
            return undefined;
          };
          
          // Optional fields
          const getImageUrl = () => normalizedRow.image_url || normalizedRow.imageurl || normalizedRow.image || normalizedRow.photo;
          const getAffiliateLink = () => normalizedRow.affiliate_link || normalizedRow.affiliatelink || normalizedRow.link || normalizedRow.url;
          const getTitleUrl = () => normalizedRow.title_url || normalizedRow.titleurl || normalizedRow.title;
          const getReview = () => normalizedRow.review_content || normalizedRow.reviewcontent || normalizedRow.review || normalizedRow.description;
          
          // Specification fields - convert empty strings to undefined
          const getColor = () => {
            const val = normalizedRow.color || normalizedRow.colour;
            return val && String(val).trim() !== '' ? String(val).trim() : undefined;
          };
          const getBalance = () => {
            const val = normalizedRow.balance;
            return val && String(val).trim() !== '' ? String(val).trim() : undefined;
          };
          const getSurface = () => {
            const val = normalizedRow.surface;
            return val && String(val).trim() !== '' ? String(val).trim() : undefined;
          };
          const getHardness = () => {
            const val = normalizedRow.hardness;
            return val && String(val).trim() !== '' ? String(val).trim() : undefined;
          };
          const getFinish = () => {
            const val = normalizedRow.finish;
            return val && String(val).trim() !== '' ? String(val).trim() : undefined;
          };
          const getPlayersCollection = () => {
            const val = normalizedRow.players_collection || normalizedRow.playerscollection || normalizedRow.collection;
            return val && String(val).trim() !== '' ? String(val).trim() : undefined;
          };
          const getProduct = () => {
            const val = normalizedRow.product;
            return val && String(val).trim() !== '' ? String(val).trim() : undefined;
          };
          const getCore = () => {
            const val = normalizedRow.core;
            return val && String(val).trim() !== '' ? String(val).trim() : undefined;
          };
          const getFormat = () => {
            const val = normalizedRow.format;
            return val && String(val).trim() !== '' ? String(val).trim() : undefined;
          };
          const getGameLevel = () => {
            const val = normalizedRow.game_level || normalizedRow.gamelevel || normalizedRow.level;
            return val && String(val).trim() !== '' ? String(val).trim() : undefined;
          };
          const getGameType = () => {
            const val = normalizedRow.game_type || normalizedRow.gametype;
            return val && String(val).trim() !== '' ? String(val).trim() : undefined;
          };
          const getPlayer = () => {
            const playerValue = normalizedRow.player || normalizedRow.gender;
            if (!playerValue) return undefined;
            const normalized = String(playerValue).toLowerCase().trim();
            if (normalized === 'man' || normalized === 'male' || normalized === 'men') return 'man';
            if (normalized === 'woman' || normalized === 'female' || normalized === 'women' || normalized === 'lady') return 'woman';
            if (normalized === 'both' || normalized === 'unisex' || normalized === 'all') return 'both';
            return undefined;
          };

          // Get brand and model for rating estimation
          const brand = getBrand();
          const model = getModel();
          
          // Check if we have ratings in the file
          const hasRatings = getPower() !== undefined || getControl() !== undefined;
          
          // If no ratings in file, estimate based on brand and model (deterministic)
          const estimatedRatings = !hasRatings && brand && model ? estimateRatingsByBrand(brand, model) : null;

          const titleUrl = getTitleUrl();
          const affiliateLink = getAffiliateLink() || titleUrl; // Use titleUrl as fallback for affiliateLink
          
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
            affiliateLink: affiliateLink,
            titleUrl: titleUrl,
            reviewContent: getReview(),
            // Specification fields
            color: getColor(),
            balance: getBalance(),
            surface: getSurface(),
            hardness: getHardness(),
            finish: getFinish(),
            playersCollection: getPlayersCollection(),
            product: getProduct(),
            core: getCore(),
            format: getFormat(),
            gameLevel: getGameLevel(),
            gameType: getGameType(),
            player: getPlayer(),
          };

          // Validate with Zod
          const originalPrice = getOriginalPrice();
          const currentPrice = getCurrentPrice();
          console.log(`Row ${i + 2}: Processing racket - Brand: ${brand}, Model: ${getModel()}, Current Price: ${currentPrice || 'not found'}, Original Price: ${originalPrice || 'not found'}`);
          console.log(`Row ${i + 2}: racketData.originalPrice before validation: ${racketData.originalPrice} (type: ${typeof racketData.originalPrice})`);
          
          // Debug: Log all price-related columns for first row
          if (i === 0) {
            console.log('Price-related columns in first row:');
            Object.keys(row).forEach(key => {
              const lowerKey = key.toLowerCase();
              if (lowerKey.includes('price') || lowerKey.includes('cost')) {
                console.log(`  - "${key}": ${row[key]} (normalized: ${normalizeKey(key)})`);
              }
            });
          }
          
          const validated = excelRacketSchema.parse(racketData);
          console.log(`Row ${i + 2}: validated.originalPrice after validation: ${validated.originalPrice} (type: ${typeof validated.originalPrice})`);
          results.preview.push(validated);

          // Check if racket already exists.
          // Prefer matching by Title_URL (product URL) when available,
          // as this is the most stable identifier across brand/model name changes.
          let existing = undefined;
          if (validated.titleUrl) {
            existing = await storage.getRacketByTitleUrl(validated.titleUrl);
          }
          if (!existing) {
            existing = await storage.getRacketByBrandAndModel(validated.brand, validated.model);
          }
          console.log(`Row ${i + 2}: ${existing ? 'Found existing racket' : 'Creating new racket'}`);

          if (existing) {
            // Helper function to check if a field is missing (null, undefined, or empty string)
            const isFieldMissing = (value: any): boolean => {
              return value === null || value === undefined || value === '';
            };
            
            // Update existing racket - only update prices and missing fields
            // Always update prices (they change frequently)
            const updateData: any = {
              currentPrice: validated.currentPrice.toString(),
            };
            
            // Update originalPrice if provided OR if it's missing in existing racket
            if (validated.originalPrice !== undefined) {
              updateData.originalPrice = validated.originalPrice.toString();
              console.log(`Row ${i + 2}: Updating originalPrice to ${validated.originalPrice}`);
            } else {
              // Log if we're not updating originalPrice
              console.log(`Row ${i + 2}: originalPrice not found in file (validated.originalPrice=${validated.originalPrice}), existing value: ${existing.originalPrice || 'null'}`);
            }
            
            // Only update other fields if they are missing in the existing racket
            // This preserves manually edited fields
            if (isFieldMissing(existing.year)) updateData.year = validated.year;
            if (isFieldMissing(existing.powerRating)) updateData.powerRating = validated.powerRating;
            if (isFieldMissing(existing.controlRating)) updateData.controlRating = validated.controlRating;
            if (isFieldMissing(existing.reboundRating)) updateData.reboundRating = validated.reboundRating;
            if (isFieldMissing(existing.maneuverabilityRating)) updateData.maneuverabilityRating = validated.maneuverabilityRating;
            if (isFieldMissing(existing.sweetSpotRating)) updateData.sweetSpotRating = validated.sweetSpotRating;
            if (isFieldMissing(existing.imageUrl) && validated.imageUrl) updateData.imageUrl = validated.imageUrl;
            if (isFieldMissing(existing.affiliateLink) && validated.affiliateLink) updateData.affiliateLink = validated.affiliateLink;
            if (isFieldMissing(existing.titleUrl) && validated.titleUrl) updateData.titleUrl = validated.titleUrl;
            if (isFieldMissing(existing.reviewContent) && validated.reviewContent) updateData.reviewContent = validated.reviewContent;
            
            // Specification fields - only update if missing
            if (isFieldMissing(existing.color) && validated.color !== undefined) updateData.color = validated.color;
            if (isFieldMissing(existing.balance) && validated.balance !== undefined) updateData.balance = validated.balance;
            if (isFieldMissing(existing.surface) && validated.surface !== undefined) updateData.surface = validated.surface;
            if (isFieldMissing(existing.hardness) && validated.hardness !== undefined) updateData.hardness = validated.hardness;
            if (isFieldMissing(existing.finish) && validated.finish !== undefined) updateData.finish = validated.finish;
            if (isFieldMissing(existing.playersCollection) && validated.playersCollection !== undefined) updateData.playersCollection = validated.playersCollection;
            if (isFieldMissing(existing.product) && validated.product !== undefined) updateData.product = validated.product;
            if (isFieldMissing(existing.core) && validated.core !== undefined) updateData.core = validated.core;
            if (isFieldMissing(existing.format) && validated.format !== undefined) updateData.format = validated.format;
            if (isFieldMissing(existing.gameLevel) && validated.gameLevel !== undefined) updateData.gameLevel = validated.gameLevel;
            if (isFieldMissing(existing.gameType) && validated.gameType !== undefined) updateData.gameType = validated.gameType;
            if (isFieldMissing(existing.player) && validated.player !== undefined) updateData.player = validated.player;
            
            console.log(`Row ${i + 2}: Updating existing racket - updating fields:`, Object.keys(updateData));
            
            await storage.updateRacket(existing.id, updateData);
            
            // Generate review if not present
            const updatedRacket = await storage.getRacket(existing.id);
            if (updatedRacket && !updatedRacket.reviewContent) {
              console.log(`Row ${i + 2}: Generating review for updated racket ${updatedRacket.id}`);
              try {
                const reviewResult = await generateRacketReview(updatedRacket);
                if (reviewResult?.reviewContent) {
                  console.log(`Row ${i + 2}: Review generated successfully (${reviewResult.reviewContent.length} chars)`);
                  await storage.updateRacket(existing.id, {
                    reviewContent: reviewResult.reviewContent,
                  });
                } else {
                  console.warn(`Row ${i + 2}: Review generation returned no content`);
                }
              } catch (reviewError) {
                console.error(`Row ${i + 2}: Failed to generate review for updated racket:`, reviewError);
                if (reviewError instanceof Error) {
                  console.error(`Row ${i + 2}: Review error details:`, reviewError.message, reviewError.stack);
                }
              }
            } else {
              console.log(`Row ${i + 2}: Skipping review generation - ${updatedRacket ? 'review already exists' : 'racket not found'}`);
            }
            
            results.updated++;
          } else {
            // Create new racket
            const newRacket = await storage.createRacket({
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
              titleUrl: validated.titleUrl || null,
              reviewContent: validated.reviewContent || null,
              // Specification fields
              color: validated.color || null,
              balance: validated.balance || null,
              surface: validated.surface || null,
              hardness: validated.hardness || null,
              finish: validated.finish || null,
              playersCollection: validated.playersCollection || null,
              product: validated.product || null,
              core: validated.core || null,
              format: validated.format || null,
              gameLevel: validated.gameLevel || null,
              gameType: validated.gameType || null,
              player: validated.player || null,
            });
            
            // Generate review if not present
            if (!newRacket.reviewContent) {
              console.log(`Row ${i + 2}: Generating review for new racket ${newRacket.id}`);
              try {
                const reviewResult = await generateRacketReview(newRacket);
                if (reviewResult?.reviewContent) {
                  console.log(`Row ${i + 2}: Review generated successfully (${reviewResult.reviewContent.length} chars)`);
                  await storage.updateRacket(newRacket.id, {
                    reviewContent: reviewResult.reviewContent,
                  });
                } else {
                  console.warn(`Row ${i + 2}: Review generation returned no content`);
                }
              } catch (reviewError) {
                console.error(`Row ${i + 2}: Failed to generate review for new racket:`, reviewError);
                if (reviewError instanceof Error) {
                  console.error(`Row ${i + 2}: Review error details:`, reviewError.message, reviewError.stack);
                }
              }
            } else {
              console.log(`Row ${i + 2}: Skipping review generation - review already exists`);
            }
            
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

      const uploadDuration = Date.now() - uploadStartTime;
      console.log(`[${uploadId}] Upload complete in ${(uploadDuration / 1000).toFixed(2)}s: ${results.processedRows}/${results.totalRows} rows processed, ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);
      if (Object.keys(errorSummary).length > 0) {
        console.log(`[${uploadId}] Error summary:`, errorSummary);
      }
      if (results.errors.length > 0) {
        console.log(`[${uploadId}] Detailed errors:`, results.errors);
      }

      res.json(results);
    } catch (error) {
      const uploadDuration = Date.now() - uploadStartTime;
      console.error(`[${uploadId}] Upload error after ${(uploadDuration / 1000).toFixed(2)}s:`, error);
      if (error instanceof Error) {
        console.error(`[${uploadId}] Error stack:`, error.stack);
      }
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to process file" 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
