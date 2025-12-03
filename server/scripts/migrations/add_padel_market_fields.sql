-- Migration: Add Padel Market fields to rackets table
-- This migration adds support for alternative affiliate links from Padel Market
-- Fields track affiliate links, stock status, and feed synchronization data

-- Add affiliate link column (nullable, only set when product is available)
ALTER TABLE rackets 
ADD COLUMN IF NOT EXISTS padel_market_affiliate_link TEXT;

-- Add stock status column (defaults to false, set to true when product is in stock)
ALTER TABLE rackets 
ADD COLUMN IF NOT EXISTS padel_market_in_stock BOOLEAN NOT NULL DEFAULT false;

-- Add feed product ID for matching products in future syncs
ALTER TABLE rackets 
ADD COLUMN IF NOT EXISTS padel_market_feed_product_id TEXT;

-- Add timestamp for tracking last feed sync
ALTER TABLE rackets 
ADD COLUMN IF NOT EXISTS padel_market_feed_last_updated TIMESTAMP;

-- Create index for faster filtering by Padel Market stock status
CREATE INDEX IF NOT EXISTS idx_rackets_padel_market_in_stock 
ON rackets(padel_market_in_stock);

-- Create composite index for common query patterns (published + stock status from both sources)
CREATE INDEX IF NOT EXISTS idx_rackets_published_pm_stock 
ON rackets(is_published, in_stock, padel_market_in_stock);

