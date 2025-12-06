-- Wolf Game Database Schema
-- Links Farcaster users (FID) to wallets for notifications

-- Users table (links wallet to FID)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  fid BIGINT UNIQUE NOT NULL,
  wallet_address TEXT,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_fid ON users(fid);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(LOWER(wallet_address));

-- Notification tokens table
CREATE TABLE IF NOT EXISTS notification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fid BIGINT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  url VARCHAR(512) NOT NULL DEFAULT 'https://api.farcaster.xyz/v1/frame-notifications',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_tokens_fid ON notification_tokens(fid);
CREATE INDEX IF NOT EXISTS idx_notification_tokens_enabled ON notification_tokens(enabled);
