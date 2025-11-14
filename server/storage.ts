import {
  type Racket,
  type InsertRacket,
  type Guide,
  type InsertGuide,
  type BlogPost,
  type InsertBlogPost,
  type Brand,
  type InsertBrand,
  type User,
  type UpsertUser,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Rackets
  getAllRackets(): Promise<Racket[]>;
  getRacket(id: string): Promise<Racket | undefined>;
  getRacketByBrandAndModel(brand: string, model: string): Promise<Racket | undefined>;
  getRecentRackets(limit: number): Promise<Racket[]>;
  getRelatedRackets(racketId: string, limit: number): Promise<Racket[]>;
  getRacketsByBrand(brand: string): Promise<Racket[]>;
  createRacket(racket: InsertRacket): Promise<Racket>;
  updateRacket(id: string, racket: Partial<InsertRacket>): Promise<Racket | undefined>;
  deleteRacket(id: string): Promise<boolean>;
  
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
  private users: Map<string, User>;

  constructor() {
    this.rackets = new Map();
    this.guides = new Map();
    this.blogPosts = new Map();
    this.brands = new Map();
    this.users = new Map();
    
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

    // Sample rackets
    const sampleRackets: InsertRacket[] = [
      // Babolat rackets
      {
        brand: "Babolat",
        model: "Technical Viper",
        year: 2024,
        shape: "diamond",
        powerRating: 95,
        controlRating: 75,
        reboundRating: 85,
        maneuverabilityRating: 70,
        sweetSpotRating: 72,
        currentPrice: "189.99",
        originalPrice: "229.99",
        imageUrl: null,
        affiliateLink: null,
        reviewContent: "<p>The Babolat Technical Viper is a high-performance diamond-shaped racket designed for advanced players seeking maximum power. Its carbon fiber construction delivers exceptional rigidity and explosive shots.</p>",
      },
      {
        brand: "Babolat",
        model: "Air Viper",
        year: 2024,
        shape: "teardrop",
        powerRating: 82,
        controlRating: 88,
        reboundRating: 80,
        maneuverabilityRating: 85,
        sweetSpotRating: 83,
        currentPrice: "169.99",
        originalPrice: null,
        imageUrl: null,
        affiliateLink: null,
        reviewContent: "<p>Perfect balance between power and control, the Air Viper features a lightweight teardrop design ideal for intermediate to advanced players who value versatility.</p>",
      },
      {
        brand: "Babolat",
        model: "Contact",
        year: 2023,
        shape: "round",
        powerRating: 70,
        controlRating: 92,
        reboundRating: 75,
        maneuverabilityRating: 90,
        sweetSpotRating: 88,
        currentPrice: "149.99",
        originalPrice: "179.99",
        imageUrl: null,
        affiliateLink: null,
        reviewContent: "<p>The Contact is Babolat's premier control racket, featuring a round shape with a large sweet spot. Perfect for beginners and players prioritizing precision over power.</p>",
      },
      // Bullpadel rackets
      {
        brand: "Bullpadel",
        model: "Vertex 04",
        year: 2024,
        shape: "diamond",
        powerRating: 98,
        controlRating: 72,
        reboundRating: 88,
        maneuverabilityRating: 68,
        sweetSpotRating: 70,
        currentPrice: "219.99",
        originalPrice: null,
        imageUrl: null,
        affiliateLink: null,
        reviewContent: "<p>Used by professional players, the Vertex 04 delivers unmatched power with its diamond shape and Xtend Carbon technology. Designed for aggressive, attacking play.</p>",
      },
      {
        brand: "Bullpadel",
        model: "Hack 03",
        year: 2024,
        shape: "diamond",
        powerRating: 94,
        controlRating: 76,
        reboundRating: 86,
        maneuverabilityRating: 72,
        sweetSpotRating: 74,
        currentPrice: "199.99",
        originalPrice: "239.99",
        imageUrl: null,
        affiliateLink: null,
        reviewContent: "<p>The Hack 03 combines power and versatility, featuring innovative Hack Core technology for enhanced performance. A favorite among competitive players.</p>",
      },
      {
        brand: "Bullpadel",
        model: "Flow",
        year: 2024,
        shape: "teardrop",
        powerRating: 80,
        controlRating: 85,
        reboundRating: 82,
        maneuverabilityRating: 84,
        sweetSpotRating: 82,
        currentPrice: "159.99",
        originalPrice: null,
        imageUrl: null,
        affiliateLink: null,
        reviewContent: "<p>Balanced teardrop design offering excellent all-around performance. The Flow features Bullpadel's signature Vibradrive system for enhanced comfort.</p>",
      },
      // Head rackets
      {
        brand: "Head",
        model: "Alpha Elite",
        year: 2024,
        shape: "diamond",
        powerRating: 96,
        controlRating: 74,
        reboundRating: 87,
        maneuverabilityRating: 71,
        sweetSpotRating: 73,
        currentPrice: "209.99",
        originalPrice: null,
        imageUrl: null,
        affiliateLink: null,
        reviewContent: "<p>Head's flagship power racket, the Alpha Elite features Auxetic technology for superior feel and explosive power. Built for advanced offensive players.</p>",
      },
      {
        brand: "Head",
        model: "Delta Motion",
        year: 2024,
        shape: "teardrop",
        powerRating: 83,
        controlRating: 86,
        reboundRating: 81,
        maneuverabilityRating: 83,
        sweetSpotRating: 84,
        currentPrice: "179.99",
        originalPrice: "199.99",
        imageUrl: null,
        affiliateLink: null,
        reviewContent: "<p>Versatile teardrop racket with Head's Smart Bridge technology. Perfect for players transitioning from intermediate to advanced levels.</p>",
      },
      {
        brand: "Head",
        model: "Zephyr Pro",
        year: 2023,
        shape: "round",
        powerRating: 72,
        controlRating: 90,
        reboundRating: 76,
        maneuverabilityRating: 88,
        sweetSpotRating: 87,
        currentPrice: "139.99",
        originalPrice: "169.99",
        imageUrl: null,
        affiliateLink: null,
        reviewContent: "<p>Control-oriented round racket ideal for beginners. The Zephyr Pro offers a comfortable, forgiving sweet spot and excellent maneuverability.</p>",
      },
      // Adidas rackets
      {
        brand: "Adidas",
        model: "Metalbone Team",
        year: 2024,
        shape: "diamond",
        powerRating: 92,
        controlRating: 78,
        reboundRating: 85,
        maneuverabilityRating: 74,
        sweetSpotRating: 76,
        currentPrice: "199.99",
        originalPrice: null,
        imageUrl: null,
        affiliateLink: null,
        reviewContent: "<p>The Metalbone Team features Adidas's signature octagonal frame shape for enhanced durability and power. Perfect for aggressive players.</p>",
      },
      {
        brand: "Adidas",
        model: "Adipower Multiweight",
        year: 2024,
        shape: "teardrop",
        powerRating: 85,
        controlRating: 84,
        reboundRating: 83,
        maneuverabilityRating: 82,
        sweetSpotRating: 81,
        currentPrice: "189.99",
        originalPrice: "219.99",
        imageUrl: null,
        affiliateLink: null,
        reviewContent: "<p>Customizable weight system allows players to adjust the racket's balance. Versatile teardrop shape suits multiple playing styles.</p>",
      },
      {
        brand: "Adidas",
        model: "Essnova Ctrl",
        year: 2024,
        shape: "round",
        powerRating: 75,
        controlRating: 91,
        reboundRating: 77,
        maneuverabilityRating: 87,
        sweetSpotRating: 86,
        currentPrice: "159.99",
        originalPrice: null,
        imageUrl: null,
        affiliateLink: null,
        reviewContent: "<p>Control-focused round racket with Eva Soft Performance rubber for excellent touch and comfort. Great for players developing their technique.</p>",
      },
      // Nox rackets
      {
        brand: "Nox",
        model: "AT10 Genius",
        year: 2024,
        shape: "diamond",
        powerRating: 97,
        controlRating: 73,
        reboundRating: 89,
        maneuverabilityRating: 69,
        sweetSpotRating: 71,
        currentPrice: "229.99",
        originalPrice: null,
        imageUrl: null,
        affiliateLink: null,
        reviewContent: "<p>Nox's premium power racket used by professional player Agustín Tapia. Features cutting-edge multilayer carbon construction for maximum performance.</p>",
      },
      {
        brand: "Nox",
        model: "ML10 Pro Cup",
        year: 2024,
        shape: "teardrop",
        powerRating: 88,
        controlRating: 83,
        reboundRating: 84,
        maneuverabilityRating: 81,
        sweetSpotRating: 80,
        currentPrice: "199.99",
        originalPrice: "229.99",
        imageUrl: null,
        affiliateLink: null,
        reviewContent: "<p>Professional-grade teardrop racket with Dynamic Composite Structure. Offers excellent power-control balance for competitive players.</p>",
      },
      {
        brand: "Nox",
        model: "Equation Lady",
        year: 2023,
        shape: "round",
        powerRating: 73,
        controlRating: 89,
        reboundRating: 78,
        maneuverabilityRating: 86,
        sweetSpotRating: 85,
        currentPrice: "149.99",
        originalPrice: "179.99",
        imageUrl: null,
        affiliateLink: null,
        reviewContent: "<p>Designed for control and precision, the Equation Lady features a round shape with HR3 core technology for superior comfort and ball feel.</p>",
      },
    ];

    sampleRackets.forEach(racket => {
      const id = randomUUID();
      const overallRating = Math.round((
        racket.powerRating +
        racket.controlRating +
        racket.reboundRating +
        racket.maneuverabilityRating +
        racket.sweetSpotRating
      ) / 5);
      
      const now = new Date(Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000);
      
      this.rackets.set(id, {
        ...racket,
        id,
        overallRating,
        createdAt: now,
        updatedAt: now,
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

  async deleteRacket(id: string): Promise<boolean> {
    return this.rackets.delete(id);
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const now = new Date();
    
    // If user has an id and exists, update it
    if (user.id && this.users.has(user.id)) {
      const existingUser = this.users.get(user.id)!;
      const updatedUser: User = {
        ...existingUser,
        ...user,
        id: user.id,
        updatedAt: now,
      };
      this.users.set(user.id, updatedUser);
      return updatedUser;
    }
    
    // Otherwise, create a new user
    const id = user.id || randomUUID();
    const newUser: User = {
      email: user.email || null,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      profileImageUrl: user.profileImageUrl || null,
      ...user,
      id,
      createdAt: now,
      updatedAt: now,
    };
    
    this.users.set(id, newUser);
    return newUser;
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
