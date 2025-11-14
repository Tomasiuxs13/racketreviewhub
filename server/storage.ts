import {
  type Racket,
  type InsertRacket,
  type Guide,
  type InsertGuide,
  type BlogPost,
  type InsertBlogPost,
  type Brand,
  type InsertBrand,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Rackets
  getAllRackets(): Promise<Racket[]>;
  getRacket(id: string): Promise<Racket | undefined>;
  getRacketByBrandAndModel(brand: string, model: string): Promise<Racket | undefined>;
  getRecentRackets(limit: number): Promise<Racket[]>;
  getRelatedRackets(racketId: string, limit: number): Promise<Racket[]>;
  getRacketsByBrand(brand: string): Promise<Racket[]>;
  createRacket(racket: InsertRacket): Promise<Racket>;
  updateRacket(id: string, racket: Partial<InsertRacket>): Promise<Racket | undefined>;
  
  // Guides
  getAllGuides(): Promise<Guide[]>;
  getGuide(slug: string): Promise<Guide | undefined>;
  getRecentGuides(limit: number): Promise<Guide[]>;
  createGuide(guide: InsertGuide): Promise<Guide>;
  
  // Blog Posts
  getAllBlogPosts(): Promise<BlogPost[]>;
  getBlogPost(slug: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  
  // Brands
  getAllBrands(): Promise<Brand[]>;
  getBrand(slug: string): Promise<Brand | undefined>;
  createBrand(brand: InsertBrand): Promise<Brand>;
}

export class MemStorage implements IStorage {
  private rackets: Map<string, Racket>;
  private guides: Map<string, Guide>;
  private blogPosts: Map<string, BlogPost>;
  private brands: Map<string, Brand>;

  constructor() {
    this.rackets = new Map();
    this.guides = new Map();
    this.blogPosts = new Map();
    this.brands = new Map();
    
    // Initialize with some sample data
    this.seedData();
  }

  private seedData() {
    // Sample brands
    const sampleBrands: InsertBrand[] = [
      {
        name: "Babolat",
        slug: "babolat",
        description: "French sports equipment manufacturer known for innovation in racket sports, offering premium padel rackets with cutting-edge technology.",
        logoUrl: null,
        articleContent: "<p>Babolat has been at the forefront of racket sports innovation for over 140 years. Their padel rackets combine French craftsmanship with modern technology to deliver exceptional performance.</p>",
      },
      {
        name: "Bullpadel",
        slug: "bullpadel",
        description: "Spanish padel racket specialist with a strong presence in professional tournaments, delivering high-performance rackets for serious players.",
        logoUrl: null,
        articleContent: "<p>Bullpadel is one of the leading Spanish brands in padel, sponsoring top professional players and consistently pushing the boundaries of racket technology.</p>",
      },
      {
        name: "Head",
        slug: "head",
        description: "Austrian sports equipment company with a rich heritage in tennis, bringing premium quality and innovation to the padel market.",
        logoUrl: null,
        articleContent: "<p>Head's expertise in racket sports translates perfectly to padel, offering players precision-engineered equipment trusted by professionals worldwide.</p>",
      },
      {
        name: "Adidas",
        slug: "adidas",
        description: "Global sports brand offering stylish and performance-driven padel rackets that combine athletic heritage with modern design.",
        logoUrl: null,
        articleContent: "<p>Adidas brings its world-class sporting DNA to padel, creating rackets that blend style, innovation, and performance for players at all levels.</p>",
      },
      {
        name: "Nox",
        slug: "nox",
        description: "Spanish padel brand known for innovative designs and partnerships with top professional players, offering cutting-edge racket technology.",
        logoUrl: null,
        articleContent: "<p>Nox is a purely padel-focused brand that has quickly risen to prominence through innovative technology and sponsorship of elite players.</p>",
      },
    ];

    sampleBrands.forEach(brand => {
      const id = randomUUID();
      this.brands.set(id, { ...brand, id, createdAt: new Date() });
    });

    // Sample guides
    const sampleGuides: InsertGuide[] = [
      {
        title: "Best Padel Rackets for Beginners 2024",
        slug: "best-padel-rackets-beginners",
        excerpt: "Discover the top padel rackets perfect for players just starting their padel journey. Learn what features to look for and which models offer the best value.",
        content: "<h2>Introduction</h2><p>Starting padel can be overwhelming with so many racket choices. This guide helps beginners find the perfect racket to develop their game.</p><h2>What to Look For</h2><p>Beginners should prioritize control and comfort over power. Round-shaped rackets with soft cores offer the best learning experience.</p>",
        category: "beginners",
        featuredImage: null,
      },
      {
        title: "Best Padel Rackets for Intermediate Players",
        slug: "best-padel-rackets-intermediate",
        excerpt: "Level up your game with these top-rated padel rackets designed for intermediate players seeking the perfect balance of power and control.",
        content: "<h2>Moving to the Next Level</h2><p>Intermediate players need rackets that can grow with their improving technique. Look for versatile teardrop shapes that balance power and control.</p>",
        category: "intermediate",
        featuredImage: null,
      },
      {
        title: "Ultimate Padel Racket Buying Guide 2024",
        slug: "ultimate-padel-racket-buying-guide",
        excerpt: "Everything you need to know about choosing the right padel racket, from understanding shapes and materials to finding your perfect match.",
        content: "<h2>Understanding Racket Shapes</h2><p>Padel rackets come in three main shapes: round, teardrop, and diamond. Each offers different benefits for various playing styles.</p><h2>Materials Matter</h2><p>Modern rackets use advanced materials like carbon fiber, fiberglass, and EVA foam to optimize performance.</p>",
        category: "general",
        featuredImage: null,
      },
      {
        title: "How to Choose a Padel Racket for Advanced Players",
        slug: "padel-rackets-advanced-players",
        excerpt: "Advanced players need precision tools. Learn how to select a high-performance racket that matches your aggressive playing style.",
        content: "<h2>Advanced Player Needs</h2><p>Advanced players typically prefer diamond-shaped rackets for maximum power, but the right choice depends on your specific playing style and physical capabilities.</p>",
        category: "advanced",
        featuredImage: null,
      },
    ];

    sampleGuides.forEach(guide => {
      const id = randomUUID();
      this.guides.set(id, {
        ...guide,
        id,
        publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      });
    });

    // Sample blog posts
    const samplePosts: InsertBlogPost[] = [
      {
        title: "Top 5 Padel Trends to Watch in 2024",
        slug: "top-padel-trends-2024",
        excerpt: "From smart rackets to sustainable materials, discover the innovations shaping the future of padel equipment.",
        content: "<p>The padel industry is evolving rapidly with new technologies and materials. Here are the top trends to watch this year.</p>",
        author: "Alex Martinez",
        featuredImage: null,
      },
      {
        title: "How to Maintain Your Padel Racket",
        slug: "maintain-your-padel-racket",
        excerpt: "Extend the life of your padel racket with these essential maintenance tips and care techniques.",
        content: "<p>Proper maintenance can significantly extend your racket's lifespan and performance. Learn the best practices for keeping your equipment in top condition.</p>",
        author: "Sarah Johnson",
        featuredImage: null,
      },
    ];

    samplePosts.forEach(post => {
      const id = randomUUID();
      this.blogPosts.set(id, {
        ...post,
        id,
        publishedAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      });
    });
  }

  // Racket methods
  async getAllRackets(): Promise<Racket[]> {
    return Array.from(this.rackets.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getRacket(id: string): Promise<Racket | undefined> {
    return this.rackets.get(id);
  }

  async getRacketByBrandAndModel(brand: string, model: string): Promise<Racket | undefined> {
    return Array.from(this.rackets.values()).find(
      r => r.brand.toLowerCase() === brand.toLowerCase() && 
           r.model.toLowerCase() === model.toLowerCase()
    );
  }

  async getRecentRackets(limit: number): Promise<Racket[]> {
    const all = await this.getAllRackets();
    return all.slice(0, limit);
  }

  async getRelatedRackets(racketId: string, limit: number): Promise<Racket[]> {
    const racket = await this.getRacket(racketId);
    if (!racket) return [];

    return Array.from(this.rackets.values())
      .filter(r => r.id !== racketId && r.brand === racket.brand)
      .sort((a, b) => b.overallRating - a.overallRating)
      .slice(0, limit);
  }

  async getRacketsByBrand(brand: string): Promise<Racket[]> {
    return Array.from(this.rackets.values())
      .filter(r => r.brand.toLowerCase() === brand.toLowerCase())
      .sort((a, b) => b.overallRating - a.overallRating);
  }

  async createRacket(insertRacket: InsertRacket): Promise<Racket> {
    const id = randomUUID();
    const now = new Date();
    
    // Calculate overall rating
    const overallRating = Math.round((
      insertRacket.powerRating +
      insertRacket.controlRating +
      insertRacket.reboundRating +
      insertRacket.maneuverabilityRating +
      insertRacket.sweetSpotRating
    ) / 5);

    const racket: Racket = {
      ...insertRacket,
      id,
      overallRating,
      createdAt: now,
      updatedAt: now,
    };

    this.rackets.set(id, racket);
    return racket;
  }

  async updateRacket(id: string, updates: Partial<InsertRacket>): Promise<Racket | undefined> {
    const racket = this.rackets.get(id);
    if (!racket) return undefined;

    const updated: Racket = {
      ...racket,
      ...updates,
      updatedAt: new Date(),
    };

    // Recalculate overall rating if any rating changed
    if (
      updates.powerRating !== undefined ||
      updates.controlRating !== undefined ||
      updates.reboundRating !== undefined ||
      updates.maneuverabilityRating !== undefined ||
      updates.sweetSpotRating !== undefined
    ) {
      updated.overallRating = Math.round((
        updated.powerRating +
        updated.controlRating +
        updated.reboundRating +
        updated.maneuverabilityRating +
        updated.sweetSpotRating
      ) / 5);
    }

    this.rackets.set(id, updated);
    return updated;
  }

  // Guide methods
  async getAllGuides(): Promise<Guide[]> {
    return Array.from(this.guides.values()).sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }

  async getGuide(slug: string): Promise<Guide | undefined> {
    return Array.from(this.guides.values()).find(g => g.slug === slug);
  }

  async getRecentGuides(limit: number): Promise<Guide[]> {
    const all = await this.getAllGuides();
    return all.slice(0, limit);
  }

  async createGuide(insertGuide: InsertGuide): Promise<Guide> {
    const id = randomUUID();
    const now = new Date();

    const guide: Guide = {
      ...insertGuide,
      id,
      publishedAt: now,
      updatedAt: now,
    };

    this.guides.set(id, guide);
    return guide;
  }

  // Blog post methods
  async getAllBlogPosts(): Promise<BlogPost[]> {
    return Array.from(this.blogPosts.values()).sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }

  async getBlogPost(slug: string): Promise<BlogPost | undefined> {
    return Array.from(this.blogPosts.values()).find(p => p.slug === slug);
  }

  async createBlogPost(insertPost: InsertBlogPost): Promise<BlogPost> {
    const id = randomUUID();
    const now = new Date();

    const post: BlogPost = {
      ...insertPost,
      id,
      publishedAt: now,
      updatedAt: now,
    };

    this.blogPosts.set(id, post);
    return post;
  }

  // Brand methods
  async getAllBrands(): Promise<Brand[]> {
    return Array.from(this.brands.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  async getBrand(slug: string): Promise<Brand | undefined> {
    return Array.from(this.brands.values()).find(b => b.slug === slug);
  }

  async createBrand(insertBrand: InsertBrand): Promise<Brand> {
    const id = randomUUID();

    const brand: Brand = {
      ...insertBrand,
      id,
      createdAt: new Date(),
    };

    this.brands.set(id, brand);
    return brand;
  }
}

export const storage = new MemStorage();
