import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  type Racket,
  type InsertRacket,
  type Guide,
  type InsertGuide,
  type BlogPost,
  type InsertBlogPost,
  type Brand,
  type InsertBrand,
  type Author,
  type InsertAuthor,
  rackets,
  guides,
  blogPosts,
  brands,
  authors,
} from "@shared/schema";
import { eq, desc, and, ne, or, sql } from "drizzle-orm";
import type { IStorage } from "../storage.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create postgres connection with SSL for Render databases
const databaseUrl = process.env.DATABASE_URL;
const isRenderDatabase = databaseUrl.includes("render.com") || databaseUrl.includes("dpg-");
const client = postgres(databaseUrl, {
  ssl: isRenderDatabase ? { rejectUnauthorized: false } : undefined,
});
const db = drizzle(client);

export class SupabaseStorage implements IStorage {
  // Racket methods
  async getAllRackets(): Promise<Racket[]> {
    const result = await db.select().from(rackets).orderBy(desc(rackets.createdAt));
    return result;
  }

  async getPublishedRackets(): Promise<Racket[]> {
    const result = await db
      .select()
      .from(rackets)
      .where(and(eq(rackets.isPublished, true), eq(rackets.inStock, true)))
      .orderBy(desc(rackets.createdAt));
    return result;
  }

  async getPublishedRacketsCompact(): Promise<Omit<Racket, 'reviewContent'>[]> {
    const result = await db
      .select({
        id: rackets.id,
        brand: rackets.brand,
        model: rackets.model,
        year: rackets.year,
        shape: rackets.shape,
        powerRating: rackets.powerRating,
        controlRating: rackets.controlRating,
        reboundRating: rackets.reboundRating,
        maneuverabilityRating: rackets.maneuverabilityRating,
        sweetSpotRating: rackets.sweetSpotRating,
        overallRating: rackets.overallRating,
        originalPrice: rackets.originalPrice,
        currentPrice: rackets.currentPrice,
        imageUrl: rackets.imageUrl,
        affiliateLink: rackets.affiliateLink,
        titleUrl: rackets.titleUrl,
        authorId: rackets.authorId,
        color: rackets.color,
        balance: rackets.balance,
        surface: rackets.surface,
        hardness: rackets.hardness,
        finish: rackets.finish,
        playersCollection: rackets.playersCollection,
        product: rackets.product,
        core: rackets.core,
        format: rackets.format,
        gameLevel: rackets.gameLevel,
        gameType: rackets.gameType,
        player: rackets.player,
        feedProductId: rackets.feedProductId,
        isPublished: rackets.isPublished,
        inStock: rackets.inStock,
        feedLastUpdated: rackets.feedLastUpdated,
        padelMarketAffiliateLink: rackets.padelMarketAffiliateLink,
        padelMarketInStock: rackets.padelMarketInStock,
        padelMarketFeedProductId: rackets.padelMarketFeedProductId,
        padelMarketFeedLastUpdated: rackets.padelMarketFeedLastUpdated,
        createdAt: rackets.createdAt,
        updatedAt: rackets.updatedAt,
      })
      .from(rackets)
      .where(and(eq(rackets.isPublished, true), eq(rackets.inStock, true)))
      .orderBy(desc(rackets.createdAt));
    return result;
  }

  async getPendingRackets(): Promise<Racket[]> {
    const result = await db
      .select()
      .from(rackets)
      .where(eq(rackets.isPublished, false))
      .orderBy(desc(rackets.createdAt));
    return result;
  }

  async getRacket(id: string): Promise<Racket | undefined> {
    const result = await db.select().from(rackets).where(eq(rackets.id, id)).limit(1);
    return result[0];
  }

  async getRacketBySlug(slug: string): Promise<Racket | undefined> {
    // Compute slug on the fly, avoiding duplicate brand if model already starts with brand name
    // Example: "Adidas" + "ADIDAS METALBONE" -> "adidas-metalbone" (not "adidas-adidas-metalbone")
    const result = await db
      .select()
      .from(rackets)
      .where(
        and(
          eq(rackets.isPublished, true),
          sql`regexp_replace(
            regexp_replace(
              CASE 
                WHEN lower(${rackets.model}) LIKE lower(${rackets.brand}) || '%' 
                THEN lower(${rackets.model})
                ELSE lower(${rackets.brand} || ' ' || ${rackets.model})
              END,
              '[^a-z0-9]+', '-', 'g'
            ),
            '^-+|-+$', '', 'g'
          ) = ${slug}`
        )
      )
      .limit(1);
    return result[0];
  }

  async getRacketByBrandAndModel(brand: string, model: string): Promise<Racket | undefined> {
    // Use case-insensitive matching with ilike
    const result = await db
      .select()
      .from(rackets)
      .where(and(
        sql`LOWER(${rackets.brand}) = LOWER(${brand})`,
        sql`LOWER(${rackets.model}) = LOWER(${model})`
      ))
      .limit(1);
    return result[0];
  }

  async getRacketByBrandModelAndYear(brand: string, model: string, year: number): Promise<Racket | undefined> {
    // Use case-insensitive matching for brand and model, exact match for year
    const result = await db
      .select()
      .from(rackets)
      .where(and(
        sql`LOWER(${rackets.brand}) = LOWER(${brand})`,
        sql`LOWER(${rackets.model}) = LOWER(${model})`,
        eq(rackets.year, year)
      ))
      .limit(1);
    return result[0];
  }

  async getRacketByTitleUrl(titleUrl: string): Promise<Racket | undefined> {
    const result = await db
      .select()
      .from(rackets)
      .where(eq(rackets.titleUrl, titleUrl))
      .limit(1);
    return result[0];
  }

  async getRacketByFeedProductId(feedProductId: string): Promise<Racket | undefined> {
    const result = await db
      .select()
      .from(rackets)
      .where(eq(rackets.feedProductId, feedProductId))
      .limit(1);
    return result[0];
  }

  async getRecentRackets(limit: number): Promise<Racket[]> {
    const result = await db
      .select()
      .from(rackets)
      .where(and(eq(rackets.isPublished, true), eq(rackets.inStock, true)))
      .orderBy(desc(rackets.createdAt))
      .limit(limit);
    return result;
  }

  async getRelatedRackets(racketId: string, limit: number): Promise<Racket[]> {
    // First get the racket to find its brand
    const racket = await this.getRacket(racketId);
    if (!racket) return [];

    // Get other published and in-stock rackets from the same brand, sorted by overall rating
    const result = await db
      .select()
      .from(rackets)
      .where(and(
        eq(rackets.brand, racket.brand), 
        ne(rackets.id, racketId),
        eq(rackets.isPublished, true),
        eq(rackets.inStock, true)
      ))
      .orderBy(desc(rackets.overallRating))
      .limit(limit);
    return result;
  }

  async getRacketsByBrand(brand: string): Promise<Racket[]> {
    const result = await db
      .select()
      .from(rackets)
      .where(and(
        eq(rackets.brand, brand),
        eq(rackets.isPublished, true),
        eq(rackets.inStock, true)
      ))
      .orderBy(desc(rackets.overallRating));
    return result;
  }

  async createRacket(insertRacket: InsertRacket): Promise<Racket> {
    // Calculate overall rating
    const overallRating = Math.round(
      (insertRacket.powerRating +
        insertRacket.controlRating +
        insertRacket.reboundRating +
        insertRacket.maneuverabilityRating +
        insertRacket.sweetSpotRating) /
        5
    );

    const result = await db
      .insert(rackets)
      .values({
        ...insertRacket,
        overallRating,
      })
      .returning();
    return result[0];
  }

  async updateRacket(id: string, updates: Partial<InsertRacket>): Promise<Racket | undefined> {
    // Get current racket to calculate new overall rating if needed
    const current = await this.getRacket(id);
    if (!current) return undefined;

    // Recalculate overall rating if any rating changed
    let overallRating = current.overallRating;
    if (
      updates.powerRating !== undefined ||
      updates.controlRating !== undefined ||
      updates.reboundRating !== undefined ||
      updates.maneuverabilityRating !== undefined ||
      updates.sweetSpotRating !== undefined
    ) {
      const power = updates.powerRating ?? current.powerRating;
      const control = updates.controlRating ?? current.controlRating;
      const rebound = updates.reboundRating ?? current.reboundRating;
      const maneuverability = updates.maneuverabilityRating ?? current.maneuverabilityRating;
      const sweetSpot = updates.sweetSpotRating ?? current.sweetSpotRating;
      overallRating = Math.round((power + control + rebound + maneuverability + sweetSpot) / 5);
    }

    const result = await db
      .update(rackets)
      .set({
        ...updates,
        overallRating,
        updatedAt: new Date(),
      })
      .where(eq(rackets.id, id))
      .returning();
    return result[0];
  }

  async deleteRacket(id: string): Promise<boolean> {
    const result = await db.delete(rackets).where(eq(rackets.id, id)).returning();
    return result.length > 0;
  }

  async markOutOfStockExcept(feedProductIds: string[]): Promise<number> {
    // Mark all rackets with feedProductId that are NOT in the provided list as out of stock
    if (feedProductIds.length === 0) {
      // If no products in feed, mark all feed-linked rackets as out of stock
      const result = await db
        .update(rackets)
        .set({ inStock: false, updatedAt: new Date() })
        .where(and(
          sql`${rackets.feedProductId} IS NOT NULL`,
          eq(rackets.inStock, true)
        ))
        .returning();
      return result.length;
    }
    
    // Mark rackets with feedProductId not in the list as out of stock
    const result = await db
      .update(rackets)
      .set({ inStock: false, updatedAt: new Date() })
      .where(and(
        sql`${rackets.feedProductId} IS NOT NULL`,
        sql`${rackets.feedProductId} NOT IN (${sql.join(feedProductIds.map(id => sql`${id}`), sql`, `)})`,
        eq(rackets.inStock, true)
      ))
      .returning();
    return result.length;
  }

  // Guide methods
  async getAllGuides(): Promise<Guide[]> {
    const result = await db.select().from(guides).orderBy(desc(guides.publishedAt));
    return result;
  }

  async getGuide(slug: string): Promise<Guide | undefined> {
    const result = await db.select().from(guides).where(eq(guides.slug, slug)).limit(1);
    return result[0];
  }

  async getRecentGuides(limit: number): Promise<Guide[]> {
    const result = await db
      .select()
      .from(guides)
      .orderBy(desc(guides.publishedAt))
      .limit(limit);
    return result;
  }

  async getRelatedGuides(guideId: string, category: string, limit: number): Promise<Guide[]> {
    const result = await db
      .select()
      .from(guides)
      .where(and(
        ne(guides.id, guideId),
        eq(guides.category, category)
      ))
      .orderBy(desc(guides.publishedAt))
      .limit(limit);
    return result;
  }

  async getGuideById(id: string): Promise<Guide | undefined> {
    const result = await db.select().from(guides).where(eq(guides.id, id)).limit(1);
    return result[0];
  }

  async createGuide(insertGuide: InsertGuide): Promise<Guide> {
    const result = await db.insert(guides).values(insertGuide).returning();
    return result[0];
  }

  async updateGuide(id: string, updates: Partial<InsertGuide>): Promise<Guide | undefined> {
    const result = await db
      .update(guides)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(guides.id, id))
      .returning();
    return result[0];
  }

  // Blog post methods
  async getAllBlogPosts(): Promise<BlogPost[]> {
    const result = await db.select().from(blogPosts).orderBy(desc(blogPosts.publishedAt));
    return result;
  }

  async getBlogPost(slug: string): Promise<BlogPost | undefined> {
    const result = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
    return result[0];
  }

  async getBlogPostById(id: string): Promise<BlogPost | undefined> {
    const result = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
    return result[0];
  }

  async createBlogPost(insertPost: InsertBlogPost): Promise<BlogPost> {
    const result = await db.insert(blogPosts).values(insertPost).returning();
    return result[0];
  }

  async updateBlogPost(id: string, updates: Partial<InsertBlogPost>): Promise<BlogPost | undefined> {
    const result = await db
      .update(blogPosts)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(blogPosts.id, id))
      .returning();
    return result[0];
  }

  // Brand methods
  async getAllBrands(): Promise<Brand[]> {
    const result = await db.select().from(brands).orderBy(brands.name);
    return result;
  }

  async getBrand(slug: string): Promise<Brand | undefined> {
    const result = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);
    return result[0];
  }

  async getBrandById(id: string): Promise<Brand | undefined> {
    const result = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
    return result[0];
  }

  async createBrand(insertBrand: InsertBrand): Promise<Brand> {
    const result = await db.insert(brands).values(insertBrand).returning();
    return result[0];
  }

  async updateBrand(id: string, updates: Partial<InsertBrand>): Promise<Brand | undefined> {
    const result = await db
      .update(brands)
      .set(updates)
      .where(eq(brands.id, id))
      .returning();
    return result[0];
  }

  // Author methods
  async getAllAuthors(): Promise<Author[]> {
    const result = await db.select().from(authors).orderBy(authors.name);
    return result;
  }

  async getAuthor(slug: string): Promise<Author | undefined> {
    const result = await db.select().from(authors).where(eq(authors.slug, slug)).limit(1);
    return result[0];
  }

  async getAuthorById(id: string): Promise<Author | undefined> {
    const result = await db.select().from(authors).where(eq(authors.id, id)).limit(1);
    return result[0];
  }

  async getRacketsByAuthor(authorId: string): Promise<Racket[]> {
    const result = await db
      .select()
      .from(rackets)
      .where(eq(rackets.authorId, authorId))
      .orderBy(desc(rackets.createdAt));
    return result;
  }

  async getBlogPostsByAuthor(authorId: string): Promise<BlogPost[]> {
    // First get the author to match by name as well
    const author = await db
      .select()
      .from(authors)
      .where(eq(authors.id, authorId))
      .limit(1);
    
    const authorName = author[0]?.name;
    
    // Query by authorId OR author name (for backward compatibility)
    // Also match "Padel Racket Reviews" as a fallback since many posts use this as the author name
    const conditions = [eq(blogPosts.authorId, authorId)];
    if (authorName) {
      conditions.push(eq(blogPosts.author, authorName));
    }
    // Match "Padel Racket Reviews" for any author (since this is the default organization name)
    conditions.push(eq(blogPosts.author, "Padel Racket Reviews"));
    
    const result = await db
      .select()
      .from(blogPosts)
      .where(or(...conditions))
      .orderBy(desc(blogPosts.publishedAt));
    
    // Remove duplicates (in case a post has both authorId and matching author name)
    const seen = new Set<string>();
    return result.filter(post => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
  }

  async createAuthor(insertAuthor: InsertAuthor): Promise<Author> {
    const result = await db.insert(authors).values(insertAuthor).returning();
    return result[0];
  }
}

