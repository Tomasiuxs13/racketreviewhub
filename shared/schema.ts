import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Authors table
export const authors = pgTable("authors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuthorSchema = createInsertSchema(authors).omit({
  id: true,
  createdAt: true,
});

export type InsertAuthor = z.infer<typeof insertAuthorSchema>;
export type Author = typeof authors.$inferSelect;

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
  titleUrl: text("title_url"), // Title_URL from Excel
  reviewContent: text("review_content"),
  authorId: varchar("author_id"), // Foreign key to authors table
  // Specification fields from Excel
  color: text("color"),
  balance: text("balance"),
  surface: text("surface"),
  hardness: text("hardness"),
  finish: text("finish"),
  playersCollection: text("players_collection"),
  product: text("product"),
  core: text("core"),
  format: text("format"),
  gameLevel: text("game_level"),
  gameType: text("game_type"),
  player: text("player"), // man, woman, or both
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
  author: text("author").notNull(), // Keep for backward compatibility
  authorId: varchar("author_id"), // Foreign key to authors table
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
  titleUrl: z.string().optional(),
  reviewContent: z.string().optional(),
  // Specification fields (all optional)
  color: z.string().optional(),
  balance: z.string().optional(),
  surface: z.string().optional(),
  hardness: z.string().optional(),
  finish: z.string().optional(),
  playersCollection: z.string().optional(),
  product: z.string().optional(),
  core: z.string().optional(),
  format: z.string().optional(),
  gameLevel: z.string().optional(),
  gameType: z.string().optional(),
  player: z.enum(["man", "woman", "both"]).optional(),
});

export type ExcelRacket = z.infer<typeof excelRacketSchema>;

// Content translations table
export const contentTranslations = pgTable(
  "content_translations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    entityType: text("entity_type").notNull(),
    entityId: varchar("entity_id").notNull(),
    locale: varchar("locale", { length: 5 }).notNull(),
    fields: jsonb("fields").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    entityLocaleIdx: uniqueIndex("content_translations_entity_locale_idx").on(
      table.entityType,
      table.entityId,
      table.locale,
    ),
  }),
);

export const insertContentTranslationSchema = createInsertSchema(contentTranslations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContentTranslation = z.infer<typeof insertContentTranslationSchema>;
export type ContentTranslation = typeof contentTranslations.$inferSelect;
