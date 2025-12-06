import { http, createConfig, createStorage } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { injected } from 'wagmi/connectors';

// Use Alchemy RPC (or fallback to public RPC)
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org';
const baseSepoliaRpc = http(rpcUrl, {
  batch: {
    batchSize: 100,
    wait: 50, // Wait 50ms to batch requests
  },
  retryCount: 3,
  retryDelay: 1000, // Wait 1s between retries
});

// Wagmi config for Base Sepolia with multiple connectors:
// 1. farcasterMiniApp - for Farcaster Mini App (auto-connects in Warpcast)
// 2. injected - for web testing with MetaMask/browser wallets
export const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: baseSepoliaRpc,
  },
  connectors: [
    farcasterMiniApp(),  // Farcaster Mini App connector
    injected(),          // MetaMask/browser wallet for web testing
  ],
  storage: createStorage({
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }),
  ssr: true,
  pollingInterval: 30_000, // Poll every 30 seconds instead of default 4 seconds
});
