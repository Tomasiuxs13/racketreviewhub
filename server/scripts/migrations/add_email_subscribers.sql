-- Add email subscribers table for newsletter signup
CREATE TABLE IF NOT EXISTS email_subscribers (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  subscribed_at TIMESTAMP DEFAULT NOW() NOT NULL,
  unsubscribed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_subscribers_email ON email_subscribers (email);
