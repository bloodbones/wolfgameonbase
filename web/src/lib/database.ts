/**
 * database.ts - PostgreSQL connection for Wolf Game
 *
 * Stores user FID <-> wallet mappings and notification tokens.
 */
import { Pool, PoolClient } from 'pg';

// PostgreSQL connection pool
// Optimized for serverless environments (Vercel)
const poolConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'wolfgame',
  user: process.env.POSTGRES_USER || 'wolfgame_user',
  password: process.env.POSTGRES_PASSWORD || 'wolfgame_password',
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 1, // Limit pool size in serverless
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
};

// Debug logging
console.log('[Database] Creating pool with config:', {
  host: poolConfig.host,
  port: poolConfig.port,
  database: poolConfig.database,
  user: poolConfig.user,
});

const pool = new Pool(poolConfig);

/**
 * Get a client from the pool for database operations.
 */
export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

/**
 * Execute a query with parameters.
 */
export async function query(text: string, params?: unknown[]): Promise<any> {
  const client = await getClient();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries in a transaction.
 */
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ======================
// User Operations
// ======================

export interface User {
  id: number;
  fid: number;
  wallet_address: string | null;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get user by FID.
 */
export async function getUserByFid(fid: number): Promise<User | null> {
  const result = await query(
    `SELECT id, fid, wallet_address, notifications_enabled, created_at, updated_at
     FROM users
     WHERE fid = $1`,
    [fid]
  );
  return result.rows[0] || null;
}

/**
 * Get user by wallet address.
 */
export async function getUserByWallet(walletAddress: string): Promise<User | null> {
  const result = await query(
    `SELECT id, fid, wallet_address, notifications_enabled, created_at, updated_at
     FROM users
     WHERE LOWER(wallet_address) = LOWER($1)`,
    [walletAddress]
  );
  return result.rows[0] || null;
}

/**
 * Create or update a user.
 */
export async function upsertUser(userData: {
  fid: number;
  wallet_address?: string;
}): Promise<User> {
  const result = await query(
    `INSERT INTO users (fid, wallet_address, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (fid) DO UPDATE SET
       wallet_address = COALESCE(EXCLUDED.wallet_address, users.wallet_address),
       updated_at = NOW()
     RETURNING *`,
    [userData.fid, userData.wallet_address || null]
  );

  return result.rows[0];
}

/**
 * Check if a user has notifications enabled (has a valid notification token).
 */
export async function hasNotificationsEnabled(fid: number): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM notification_tokens WHERE fid = $1 AND enabled = TRUE LIMIT 1`,
    [fid]
  );
  return result.rows.length > 0;
}

// ======================
// Notification Token Operations
// ======================

export interface NotificationToken {
  id: number;
  user_id: number;
  fid: number;
  token: string;
  url: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get notification tokens for a user by FID.
 */
export async function getTokensByFid(fid: number): Promise<NotificationToken[]> {
  const result = await query(
    `SELECT * FROM notification_tokens WHERE fid = $1 AND enabled = TRUE`,
    [fid]
  );
  return result.rows;
}

/**
 * Get notification tokens for a user by wallet address.
 * Looks up user by wallet, then gets their tokens.
 */
export async function getTokensByWallet(walletAddress: string): Promise<NotificationToken[]> {
  const result = await query(
    `SELECT nt.* FROM notification_tokens nt
     JOIN users u ON nt.user_id = u.id
     WHERE LOWER(u.wallet_address) = LOWER($1)
       AND nt.enabled = TRUE
       AND u.notifications_enabled = TRUE`,
    [walletAddress]
  );
  return result.rows;
}

/**
 * Save or update a notification token.
 */
export async function saveNotificationToken(
  userId: number,
  fid: number,
  token: string,
  url: string
): Promise<void> {
  await query(
    `INSERT INTO notification_tokens (user_id, fid, token, url, enabled, created_at, updated_at)
     VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
     ON CONFLICT (token) DO UPDATE SET enabled = TRUE, url = $4, updated_at = NOW()`,
    [userId, fid, token, url]
  );
}

/**
 * Disable notification tokens for a user.
 */
export async function disableTokensForUser(userId: number): Promise<void> {
  await query(
    `UPDATE notification_tokens SET enabled = FALSE, updated_at = NOW() WHERE user_id = $1`,
    [userId]
  );
}

/**
 * Delete notification tokens for a user.
 */
export async function deleteTokensForUser(userId: number): Promise<void> {
  await query(`DELETE FROM notification_tokens WHERE user_id = $1`, [userId]);
}

/**
 * Update user's notifications_enabled flag.
 */
export async function setUserNotificationsEnabled(userId: number, enabled: boolean): Promise<void> {
  await query(
    `UPDATE users SET notifications_enabled = $1, updated_at = NOW() WHERE id = $2`,
    [enabled, userId]
  );
}

/**
 * Close the database pool (call on app shutdown).
 */
export async function closePool(): Promise<void> {
  await pool.end();
}

export default pool;
