-- Add price history table for tracking racket price changes over time
CREATE TABLE IF NOT EXISTS price_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  racket_id VARCHAR NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  source TEXT NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_price_history_racket_id ON price_history (racket_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history (recorded_at);
