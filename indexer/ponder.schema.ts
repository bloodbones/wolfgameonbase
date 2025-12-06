import { onchainTable } from "ponder";

// Track current staked token ownership (updated on stake/claim/unstake)
export const stakedTokens = onchainTable("staked_tokens", (t) => ({
  tokenId: t.integer().primaryKey(),   // Token ID as primary key
  owner: t.hex().notNull(),            // Current owner
  isSheep: t.boolean().notNull(),      // Is this a sheep or wolf
  stakedAt: t.bigint().notNull(),      // When staked (block timestamp)
}));

// Track when sheep are stolen by wolves
export const steals = onchainTable("steals", (t) => ({
  id: t.text().primaryKey(),           // tx_hash + log_index
  sheepTokenId: t.integer().notNull(),  // The stolen sheep's token ID
  wolfOwner: t.hex().notNull(),         // Who received the sheep (wolf owner)
  previousOwner: t.hex().notNull(),     // Who lost the sheep
  txHash: t.hex().notNull(),            // Transaction hash
  blockNumber: t.bigint().notNull(),    // Block number
  timestamp: t.bigint().notNull(),      // Unix timestamp
}));

// Track all sheep claim events (both survived and eaten)
export const sheepClaims = onchainTable("sheep_claims", (t) => ({
  id: t.text().primaryKey(),           // tx_hash + log_index
  tokenId: t.integer().notNull(),      // Sheep token ID
  owner: t.hex().notNull(),            // Owner who unstaked
  woolEarned: t.bigint().notNull(),    // WOOL earned
  wasEaten: t.boolean().notNull(),     // Did the sheep get stolen?
  txHash: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

// Track staking events
export const stakes = onchainTable("stakes", (t) => ({
  id: t.text().primaryKey(),           // tx_hash + log_index
  tokenId: t.integer().notNull(),
  owner: t.hex().notNull(),
  isSheep: t.boolean().notNull(),
  txHash: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

// Track mints
export const mints = onchainTable("mints", (t) => ({
  id: t.text().primaryKey(),           // tx_hash + log_index
  tokenId: t.integer().notNull(),
  owner: t.hex().notNull(),
  isSheep: t.boolean().notNull(),
  txHash: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));
