import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Rackets table
export const rackets = pgTable("rackets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  year: integer("year").notNull(),
  shape: text("shape").notNull(), // diamond, round, teardrop
  powerRating: integer("power_rating").notNull(), // 0-100
  controlRating: integer("control_rating").notNull(), // 0-100
  reboundRating: integer("rebound_rating").notNull(), // 0-100
  maneuverabilityRating: integer("maneuverability_rating").notNull(), // 0-100
  sweetSpotRating: integer("sweet_spot_rating").notNull(), // 0-100
  overallRating: integer("overall_rating").notNull(), // calculated average
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  affiliateLink: text("affiliate_link"),
  reviewContent: text("review_content"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRacketSchema = createInsertSchema(rackets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  overallRating: true, // calculated field
});

export type InsertRacket = z.infer<typeof insertRacketSchema>;
export type Racket = typeof rackets.$inferSelect;

// Guides table
export const guides = pgTable("guides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(), // beginners, intermediate, advanced, general
  featuredImage: text("featured_image"),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGuideSchema = createInsertSchema(guides).omit({
  id: true,
  publishedAt: true,
  updatedAt: true,
});

export type InsertGuide = z.infer<typeof insertGuideSchema>;
export type Guide = typeof guides.$inferSelect;

// Blog posts table
export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  author: text("author").notNull(),
  featuredImage: text("featured_image"),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  publishedAt: true,
  updatedAt: true,
});

export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;

// Brands table
export const brands = pgTable("brands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  logoUrl: text("logo_url"),
  articleContent: text("article_content"), // brand story/article
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBrandSchema = createInsertSchema(brands).omit({
  id: true,
  createdAt: true,
});

export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brands.$inferSelect;

// Excel upload schema for batch operations
export const excelRacketSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(2000).max(2030),
  shape: z.enum(["diamond", "round", "teardrop"]),
  // Ratings are optional with default value of 50 (neutral)
  powerRating: z.number().int().min(0).max(100).default(50),
  controlRating: z.number().int().min(0).max(100).default(50),
  reboundRating: z.number().int().min(0).max(100).default(50),
  maneuverabilityRating: z.number().int().min(0).max(100).default(50),
  sweetSpotRating: z.number().int().min(0).max(100).default(50),
  originalPrice: z.number().optional(),
  currentPrice: z.number(),
  imageUrl: z.string().optional(),
  affiliateLink: z.string().optional(),
  reviewContent: z.string().optional(),
});

export type ExcelRacket = z.infer<typeof excelRacketSchema>;
