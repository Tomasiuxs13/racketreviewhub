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
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Rackets
  getAllRackets(): Promise<Racket[]>;
  getRacket(id: string): Promise<Racket | undefined>;
  getRacketByBrandAndModel(brand: string, model: string): Promise<Racket | undefined>;
  getRacketByTitleUrl(titleUrl: string): Promise<Racket | undefined>;
  getRecentRackets(limit: number): Promise<Racket[]>;
  getRelatedRackets(racketId: string, limit: number): Promise<Racket[]>;
  getRacketsByBrand(brand: string): Promise<Racket[]>;
  createRacket(racket: InsertRacket): Promise<Racket>;
  updateRacket(id: string, racket: Partial<InsertRacket>): Promise<Racket | undefined>;
  deleteRacket(id: string): Promise<boolean>;
  
  // Guides
  getAllGuides(): Promise<Guide[]>;
  getGuide(slug: string): Promise<Guide | undefined>;
  getGuideById(id: string): Promise<Guide | undefined>;
  getRecentGuides(limit: number): Promise<Guide[]>;
  getRelatedGuides(guideId: string, category: string, limit: number): Promise<Guide[]>;
  createGuide(guide: InsertGuide): Promise<Guide>;
  updateGuide(id: string, guide: Partial<InsertGuide>): Promise<Guide | undefined>;
  
  // Blog Posts
  getAllBlogPosts(): Promise<BlogPost[]>;
  getBlogPost(slug: string): Promise<BlogPost | undefined>;
  getBlogPostById(id: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: string, post: Partial<InsertBlogPost>): Promise<BlogPost | undefined>;
  
  // Brands
  getAllBrands(): Promise<Brand[]>;
  getBrand(slug: string): Promise<Brand | undefined>;
  getBrandById(id: string): Promise<Brand | undefined>;
  createBrand(brand: InsertBrand): Promise<Brand>;
  updateBrand(id: string, brand: Partial<InsertBrand>): Promise<Brand | undefined>;
  
  // Authors
  getAllAuthors(): Promise<Author[]>;
  getAuthor(slug: string): Promise<Author | undefined>;
  getAuthorById(id: string): Promise<Author | undefined>;
  getRacketsByAuthor(authorId: string): Promise<Racket[]>;
  getBlogPostsByAuthor(authorId: string): Promise<BlogPost[]>;
  createAuthor(author: InsertAuthor): Promise<Author>;
}

export class MemStorage implements IStorage {
  private rackets: Map<string, Racket>;
  private guides: Map<string, Guide>;
  private blogPosts: Map<string, BlogPost>;
  private brands: Map<string, Brand>;
  private authors: Map<string, Author>;

  constructor() {
    this.rackets = new Map();
    this.guides = new Map();
    this.blogPosts = new Map();
    this.brands = new Map();
    this.authors = new Map();
    
    // Initialize with some sample data
    this.seedData();
  }

  private seedData() {
    // Sample author - a padel expert
    const defaultAuthor: InsertAuthor = {
      name: "Carlos Rodriguez",
      slug: "carlos-rodriguez",
      bio: "Professional padel player and equipment reviewer with over 15 years of experience. Carlos has tested hundreds of rackets and provides expert insights to help players find the perfect equipment for their game.",
      avatarUrl: null,
    };
    const authorId = randomUUID();
    this.authors.set(authorId, { ...defaultAuthor, id: authorId, createdAt: new Date() });
    
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
        authorId: authorId, // Assign default author
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
        authorId: authorId, // Assign default author
        overallRating,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Add new comprehensive guides (2025) - after rackets are created
    // Helper function to find racket ID by brand and model
    const findRacketId = (brand: string, model: string): string | null => {
      for (const [id, racket] of this.rackets.entries()) {
        if (racket.brand.toLowerCase() === brand.toLowerCase() && 
            racket.model.toLowerCase() === model.toLowerCase()) {
          return id;
        }
      }
      return null;
    };

    // Helper to convert markdown-like content to HTML and replace racket placeholders
    const processGuideContent = (content: string): string => {
      // First replace racket placeholders with actual IDs
      let html = content
        .replace(/\[BABOLAT-CONTACT-ID\]/g, findRacketId('Babolat', 'Contact') || '#')
        .replace(/\[HEAD-ZEPHYR-PRO-ID\]/g, findRacketId('Head', 'Zephyr Pro') || '#')
        .replace(/\[ADIDAS-ESSNOVA-CTRL-ID\]/g, findRacketId('Adidas', 'Essnova Ctrl') || '#')
        .replace(/\[NOX-EQUATION-LADY-ID\]/g, findRacketId('Nox', 'Equation Lady') || '#')
        .replace(/\[BABOLAT-AIR-VIPER-ID\]/g, findRacketId('Babolat', 'Air Viper') || '#')
        .replace(/\[BULLPADEL-FLOW-ID\]/g, findRacketId('Bullpadel', 'Flow') || '#')
        .replace(/\[HEAD-DELTA-MOTION-ID\]/g, findRacketId('Head', 'Delta Motion') || '#')
        .replace(/\[BULLPADEL-VERTEX-04-ID\]/g, findRacketId('Bullpadel', 'Vertex 04') || '#')
        .replace(/\[BABOLAT-TECHNICAL-VIPER-ID\]/g, findRacketId('Babolat', 'Technical Viper') || '#')
        .replace(/\[HEAD-ALPHA-ELITE-ID\]/g, findRacketId('Head', 'Alpha Elite') || '#');

      // Split into lines for processing
      const lines = html.split('\n');
      const processed: string[] = [];
      let inList = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (!line) {
          if (inList) {
            processed.push('</ul>');
            inList = false;
          }
          continue;
        }

        // Headers
        if (line.startsWith('### ')) {
          if (inList) {
            processed.push('</ul>');
            inList = false;
          }
          processed.push(`<h3>${line.substring(4)}</h3>`);
          continue;
        }
        
        if (line.startsWith('## ')) {
          if (inList) {
            processed.push('</ul>');
            inList = false;
          }
          processed.push(`<h2>${line.substring(3)}</h2>`);
          continue;
        }

        // List items
        if (line.startsWith('- ')) {
          if (!inList) {
            processed.push('<ul>');
            inList = true;
          }
          const listContent = line.substring(2)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          processed.push(`<li>${listContent}</li>`);
          continue;
        }

        // Close list if we hit a non-list item
        if (inList) {
          processed.push('</ul>');
          inList = false;
        }

        // Regular paragraph - process bold and links
        let paraContent = line
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
        
        processed.push(`<p>${paraContent}</p>`);
      }

      // Close any open list
      if (inList) {
        processed.push('</ul>');
      }

      return processed.join('\n');
    };

    const newGuides: InsertGuide[] = [
      {
        title: "Best Padel Rackets for Beginners 2025",
        slug: "best-padel-rackets-beginners-2025",
        excerpt: "Starting your padel journey? Discover the best rackets for beginners, with expert recommendations and detailed buying advice to help you choose the perfect first racket.",
        content: processGuideContent(`## Introduction

Starting your padel journey is exciting, but choosing your first racket can feel overwhelming. With hundreds of models available, each promising different benefits, how do you know which one will help you learn and improve?

This comprehensive guide will walk you through everything you need to know about selecting your first padel racket. We'll explain what makes a racket beginner-friendly, which features matter most for new players, and recommend specific models that offer the best value for those just starting out.

## Understanding Beginner Needs

When you're just starting out in padel, your priorities are different from experienced players. While advanced players might seek maximum power or precision, beginners need something entirely different: forgiveness and ease of use.

### Why Control Matters More Than Power

As a beginner, you're still developing your technique. You're learning how to position yourself, how to swing, and how to make contact with the ball consistently. At this stage, a racket that offers too much power can actually hinder your development. Powerful rackets require precise technique to control—something you're still building.

Instead, you need a racket that helps you place the ball where you want it, even when your technique isn't perfect. High control ratings mean the racket responds predictably to your swing, helping you learn what works and what doesn't. Every successful shot builds confidence, and confidence accelerates learning.

### The Importance of Forgiveness

A forgiving racket has a large sweet spot—the area on the racket face where you get the best results. When you're learning, you won't hit the ball in the perfect spot every time. A large sweet spot means even slightly off-center hits still produce decent shots. This forgiveness keeps you in rallies longer, giving you more practice time and more opportunities to improve.

## Best Racket Shapes for Beginners

Padel rackets come in three main shapes: round, teardrop, and diamond. Each shape offers different characteristics, and for beginners, the choice is clear.

### Round Shapes: Why They're Ideal for Beginners

Round-shaped rackets are the best choice for beginners, and here's why:

**Largest Sweet Spot**: Round rackets have the largest sweet spot of all three shapes. This means you have more room for error when making contact with the ball. Even if your timing isn't perfect, you'll still get decent results, which keeps you playing and learning.

**Best Control and Forgiveness**: The round shape places the sweet spot higher on the racket face, making it easier to control your shots. You'll find it simpler to place the ball where you want it, even with developing technique.

## Top Recommended Rackets for Beginners

Based on our analysis of beginner needs and current market offerings, here are our top recommended rackets for players just starting their padel journey.

### Babolat Contact

**Why we recommend it**: The Babolat Contact is specifically designed for control and precision, making it an excellent choice for beginners. With a control rating of 92 and a round shape, it offers the forgiveness and ease of use that new players need.

**Key features**:
- Round shape with large sweet spot (sweet spot rating: 88)
- Excellent control rating (92) for precise shot placement
- High maneuverability (90) for quick reactions
- Moderate power (70) that's easy to control

**Specifications**:
- Shape: Round
- Power Rating: 70
- Control Rating: 92
- Price: €149.99

[View full details →](/rackets/[BABOLAT-CONTACT-ID])

### Head Zephyr Pro

**Why we recommend it**: The Head Zephyr Pro combines excellent control with beginner-friendly pricing. Its round shape and high control rating make it perfect for developing technique.

**Key features**:
- Round shape optimized for control
- High control rating (90) for accurate shots
- Excellent maneuverability (88) for net play
- Large sweet spot (87) for forgiveness

**Specifications**:
- Shape: Round
- Power Rating: 72
- Control Rating: 90
- Price: €139.99

[View full details →](/rackets/[HEAD-ZEPHYR-PRO-ID])

### Adidas Essnova Ctrl

**Why we recommend it**: The Essnova Ctrl lives up to its name with exceptional control characteristics. Designed for players developing their technique, it features a round shape and soft core that make learning enjoyable and effective.

**Key features**:
- Round shape with control focus
- Outstanding control rating (91)
- High maneuverability (87) for quick play
- Large sweet spot (86) for error forgiveness

**Specifications**:
- Shape: Round
- Power Rating: 75
- Control Rating: 91
- Price: €159.99

[View full details →](/rackets/[ADIDAS-ESSNOVA-CTRL-ID])

### Nox Equation Lady

**Why we recommend it**: Despite its name, the Nox Equation Lady works excellently for all beginners, not just women. Its round shape and high control rating make it ideal for anyone prioritizing precision and comfort in their first racket.

**Key features**:
- Round shape for maximum control
- High control rating (89) for accurate placement
- Excellent maneuverability (86) for responsive play
- Large sweet spot (85) for forgiveness

**Specifications**:
- Shape: Round
- Power Rating: 73
- Control Rating: 89
- Price: €149.99

[View full details →](/rackets/[NOX-EQUATION-LADY-ID])

## Key Takeaways

- **Round shapes offer the best learning experience**: They provide the largest sweet spot and highest control, making them ideal for developing technique
- **Prioritize control and comfort over power**: As a beginner, you need forgiveness and ease of use, not maximum power
- **Lighter, balanced rackets are easier to learn with**: Aim for 360-370g with low to medium balance
- **Don't overspend on your first racket**: €80-€150 is the sweet spot for beginner rackets
- **Test rackets when possible before buying**: Personal feel matters, and trying before buying helps you find the right match

## Conclusion

Choosing your first padel racket is an important decision, but it doesn't need to be complicated. Focus on control, comfort, and forgiveness—features that support learning rather than showcase advanced technology. Round-shaped rackets with high control ratings offer the best foundation for developing your game.

The rackets we've recommended—the Babolat Contact, Head Zephyr Pro, Adidas Essnova Ctrl, and Nox Equation Lady—all excel in these beginner-friendly characteristics. Each offers excellent control, large sweet spots, and comfortable feel that will make your learning journey enjoyable and effective.

Ready to find your perfect beginner racket? Browse our [complete racket collection](/rackets) to see all available options, or check out our [other buying guides](/guides) for more expert advice as your game develops.`),
        category: "beginners",
        featuredImage: null,
      },
      {
        title: "Complete Guide to Padel Racket Shapes: Round vs Teardrop vs Diamond",
        slug: "complete-guide-padel-racket-shapes",
        excerpt: "Understand how racket shape affects every aspect of gameplay. Learn the differences between round, teardrop, and diamond shapes, and discover which one matches your skill level and playing style.",
        content: processGuideContent(`## Introduction

The shape of your padel racket is the single most important factor affecting how it performs. Unlike other sports where racket technology focuses on strings or materials, padel racket shape fundamentally changes every aspect of gameplay—from power and control to where the sweet spot is located and how the racket feels in your hands.

Understanding racket shapes is essential for choosing the right equipment for your skill level and playing style. This comprehensive guide will explain everything you need to know about the three main padel racket shapes: round, teardrop, and diamond.

## Round Shape Rackets

Round-shaped rackets are characterized by their circular or near-circular head shape, with the widest point near the middle of the racket face.

### Characteristics

**Largest Head Size**: Round rackets have the largest hitting surface of all three shapes, providing more room for contact with the ball.

**Highest Sweet Spot Location**: The sweet spot is positioned high on the racket face, making it easier to reach and use during normal swings.

**Most Balanced Weight Distribution**: Weight is distributed more evenly throughout the racket, creating a balanced feel.

**Largest Sweet Spot Area**: The optimal hitting zone is larger than in other shapes, providing more forgiveness on off-center hits.

### Performance Profile

Round rackets excel in control and forgiveness while offering moderate power:

- **Maximum Control (90-100 rating)**: The large sweet spot and balanced weight distribution make it easier to place shots accurately.
- **Moderate Power (40-60 rating)**: While not the most powerful, round rackets make power generation easier with less effort required.
- **Excellent Maneuverability (80-95 rating)**: The balanced weight and lower balance point make these rackets quick and easy to swing.
- **Largest Sweet Spot (90-100 rating)**: The forgiving nature means even slightly imperfect contact produces good results.

### Real Racket Examples

The [Babolat Contact](/rackets/[BABOLAT-CONTACT-ID]) exemplifies round shape characteristics with its control rating of 92 and sweet spot rating of 88. Similarly, the [Head Zephyr Pro](/rackets/[HEAD-ZEPHYR-PRO-ID]) demonstrates how round shapes provide excellent maneuverability (88 rating) while maintaining high control (90 rating).

## Teardrop Shape Rackets

Teardrop-shaped rackets feature a head that's wider at the top and narrower toward the bottom, creating a balanced middle ground between round and diamond shapes.

### Performance Profile

Teardrop rackets offer balanced performance across all categories:

- **Good Control (70-85 rating)**: Better control than diamond shapes, though not as precise as round.
- **Good Power (65-80 rating)**: More power potential than round shapes without the extremes of diamond.
- **Good Maneuverability (70-85 rating)**: Generally quick and responsive, though not as maneuverable as round.
- **Medium-Large Sweet Spot (75-90 rating)**: Offers reasonable forgiveness while encouraging better contact.

### Real Racket Examples

The [Babolat Air Viper](/rackets/[BABOLAT-AIR-VIPER-ID]) showcases teardrop versatility with balanced ratings: power 82, control 88, and maneuverability 85. The [Bullpadel Flow](/rackets/[BULLPADEL-FLOW-ID]) demonstrates how teardrop shapes provide excellent all-around performance with ratings in the 80-85 range across all categories.

## Diamond Shape Rackets

Diamond-shaped rackets feature a head that's wider at the bottom and narrower at the top, concentrating weight in the lower portion of the racket head.

### Performance Profile

Diamond rackets prioritize power above all else:

- **Lower Control (50-70 rating)**: The small sweet spot and high balance make control more challenging.
- **Maximum Power (85-100 rating)**: The weight distribution and shape create explosive power potential.
- **Lower Maneuverability (50-70 rating)**: The high balance point makes these rackets feel heavier and slower to swing.
- **Smaller Sweet Spot (50-75 rating)**: Requires consistent, precise contact to achieve optimal results.

### Real Racket Examples

The [Bullpadel Vertex 04](/rackets/[BULLPADEL-VERTEX-04-ID]) exemplifies diamond shape power with a power rating of 98 and control rating of 72. The [Babolat Technical Viper](/rackets/[BABOLAT-TECHNICAL-VIPER-ID]) demonstrates how diamond shapes deliver maximum power (95 rating) while requiring advanced technique to control effectively.

## Key Takeaways

- **Shape is the most important racket characteristic**: It fundamentally affects power, control, sweet spot, and balance
- **Round = control, Teardrop = balance, Diamond = power**: Each shape has a primary strength
- **Choose shape based on skill level and playing style**: There's no universal "best" shape
- **Sweet spot location varies significantly by shape**: High for round, medium-high for teardrop, low for diamond
- **There's no "best" shape—only the best for you**: Your ideal shape depends on your individual needs and abilities

## Conclusion

Understanding padel racket shapes is fundamental to choosing the right equipment. Round shapes offer maximum control and forgiveness, making them ideal for beginners. Teardrop shapes provide balanced performance for intermediate players seeking versatility. Diamond shapes deliver maximum power for advanced players with solid technique.

Ready to find rackets in your preferred shape? Browse our [complete racket collection](/rackets) and filter by shape to see all available options.`),
        category: "general",
        featuredImage: null,
      },
    ];

    newGuides.forEach(guide => {
      const id = randomUUID();
      this.guides.set(id, {
        ...guide,
        id,
        publishedAt: new Date(),
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

  async getRacketByTitleUrl(titleUrl: string): Promise<Racket | undefined> {
    return Array.from(this.rackets.values()).find(
      (r) => r.titleUrl !== null && r.titleUrl === titleUrl
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

  // Guide methods
  async getAllGuides(): Promise<Guide[]> {
    return Array.from(this.guides.values()).sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }

  async getGuide(slug: string): Promise<Guide | undefined> {
    return Array.from(this.guides.values()).find(g => g.slug === slug);
  }

  async getGuideById(id: string): Promise<Guide | undefined> {
    return this.guides.get(id);
  }

  async getRecentGuides(limit: number): Promise<Guide[]> {
    const all = await this.getAllGuides();
    return all.slice(0, limit);
  }

  async getRelatedGuides(guideId: string, category: string, limit: number): Promise<Guide[]> {
    const all = await this.getAllGuides();
    return all
      .filter(g => g.id !== guideId && g.category.toLowerCase() === category.toLowerCase())
      .slice(0, limit);
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

  async updateGuide(id: string, updates: Partial<InsertGuide>): Promise<Guide | undefined> {
    const guide = this.guides.get(id);
    if (!guide) return undefined;

    const updated: Guide = {
      ...guide,
      ...updates,
      updatedAt: new Date(),
    };

    this.guides.set(id, updated);
    return updated;
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

  async getBlogPostById(id: string): Promise<BlogPost | undefined> {
    return this.blogPosts.get(id);
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

  async updateBlogPost(id: string, updates: Partial<InsertBlogPost>): Promise<BlogPost | undefined> {
    const post = this.blogPosts.get(id);
    if (!post) return undefined;

    const updated: BlogPost = {
      ...post,
      ...updates,
      updatedAt: new Date(),
    };

    this.blogPosts.set(id, updated);
    return updated;
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

  async getBrandById(id: string): Promise<Brand | undefined> {
    return this.brands.get(id);
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

  async updateBrand(id: string, updates: Partial<InsertBrand>): Promise<Brand | undefined> {
    const brand = this.brands.get(id);
    if (!brand) return undefined;

    const updated: Brand = {
      ...brand,
      ...updates,
    };

    this.brands.set(id, updated);
    return updated;
  }

  // Author methods
  async getAllAuthors(): Promise<Author[]> {
    return Array.from(this.authors.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  async getAuthor(slug: string): Promise<Author | undefined> {
    return Array.from(this.authors.values()).find(a => a.slug === slug);
  }

  async getAuthorById(id: string): Promise<Author | undefined> {
    return this.authors.get(id);
  }

  async getRacketsByAuthor(authorId: string): Promise<Racket[]> {
    return Array.from(this.rackets.values())
      .filter(r => r.authorId === authorId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getBlogPostsByAuthor(authorId: string): Promise<BlogPost[]> {
    // Get author name for matching
    const author = Array.from(this.authors.values()).find(a => a.id === authorId);
    const authorName = author?.name;
    
    return Array.from(this.blogPosts.values())
      .filter(p => {
        // Match by authorId OR author name OR "Padel Racket Reviews" (default organization name)
        return p.authorId === authorId || 
               (authorName && p.author === authorName) ||
               p.author === "Padel Racket Reviews";
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  async createAuthor(insertAuthor: InsertAuthor): Promise<Author> {
    const id = randomUUID();

    const author: Author = {
      ...insertAuthor,
      id,
      createdAt: new Date(),
    };

    this.authors.set(id, author);
    return author;
  }
}

// Use SupabaseStorage if DATABASE_URL is set, otherwise fall back to MemStorage
let storage: IStorage;

if (process.env.DATABASE_URL) {
  const { SupabaseStorage } = await import("./storage/supabaseStorage.js");
  storage = new SupabaseStorage();
} else {
  storage = new MemStorage();
}

export { storage };
