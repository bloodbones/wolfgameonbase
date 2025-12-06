'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, useConnect, useAccount, useReconnect } from 'wagmi';
import { config } from '@/lib/wagmi';
import { useEffect, useState, useRef } from 'react';
import sdk from '@farcaster/miniapp-sdk';

// Create a React Query client for data caching
const queryClient = new QueryClient();

// Auto-connect component that runs inside WagmiProvider
function AutoConnect({ children }: { children: React.ReactNode }) {
  const { connect, connectors } = useConnect();
  const { reconnect } = useReconnect();
  const { isConnected, address } = useAccount();
  const hasAttemptedRef = useRef(false);
  const hasRegisteredWalletRef = useRef(false);

  useEffect(() => {
    // Try reconnect first (from localStorage)
    reconnect();
  }, [reconnect]);

  useEffect(() => {
    // Auto-connect in Farcaster Mini App context
    const autoConnect = async () => {
      if (isConnected || hasAttemptedRef.current || connectors.length === 0) {
        return;
      }

      try {
        const context = await sdk.context;

        // Check for client property to confirm we're in a Mini App
        if (context?.client) {
          console.log('[AutoConnect] In Mini App, connecting...');
          hasAttemptedRef.current = true;
          // Use non-async connect - more reliable with frame connector
          connect({ connector: connectors[0] });
        }
      } catch {
        // Not in mini app
      }
    };

    // Small delay to let reconnect try first
    const timer = setTimeout(autoConnect, 500);
    return () => clearTimeout(timer);
  }, [isConnected, connect, connectors]);

  // Register wallet address with FID when connected in Mini App
  useEffect(() => {
    const registerWallet = async () => {
      if (!isConnected || !address || hasRegisteredWalletRef.current) {
        return;
      }

      try {
        const context = await sdk.context;
        const fid = context?.user?.fid;

        if (fid && address) {
          console.log(`[RegisterWallet] Registering FID ${fid} -> ${address}`);
          hasRegisteredWalletRef.current = true;

          await fetch('/api/register-wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fid, walletAddress: address }),
          });
        }
      } catch (error) {
        console.error('[RegisterWallet] Error:', error);
      }
    };

    registerWallet();
  }, [isConnected, address]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // CRITICAL: Call sdk.actions.ready() immediately to hide splash screen
    // Must be called unconditionally - don't wrap in try/catch or await context
    sdk.actions.ready();
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AutoConnect>{children}</AutoConnect>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
