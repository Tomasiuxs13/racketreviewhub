-- Migration: Add in_stock field to rackets table
-- This field tracks whether a racket is currently available for purchase
-- Rackets not found in the CJ feed during sync will be marked as out of stock

-- Add the column with default value of true (existing rackets are assumed in stock)
ALTER TABLE rackets 
ADD COLUMN IF NOT EXISTS in_stock BOOLEAN NOT NULL DEFAULT true;

-- Create an index for faster filtering
CREATE INDEX IF NOT EXISTS idx_rackets_in_stock ON rackets(in_stock);

-- Optionally, create a composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_rackets_published_in_stock ON rackets(is_published, in_stock);

