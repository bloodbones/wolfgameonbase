'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { useWoolBalance } from '@/hooks/useWool';
import { formatEther } from 'viem';
import Link from 'next/link';
import sdk from '@farcaster/miniapp-sdk';

export function Header() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: woolBalance, refetch: refetchWool } = useWoolBalance(address);
  const { data: ethBalance, refetch: refetchEth } = useBalance({ address });

  const [showWalletOverlay, setShowWalletOverlay] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userProfile, setUserProfile] = useState<{ pfpUrl?: string; username?: string } | null>(null);

  // Get Farcaster user profile from SDK context
  useEffect(() => {
    const getProfile = async () => {
      try {
        const context = await sdk.context;
        if (context?.user) {
          setUserProfile({
            pfpUrl: context.user.pfpUrl,
            username: context.user.username,
          });
        }
      } catch {
        // Not in Farcaster context
      }
    };
    getProfile();
  }, []);

  // Refetch balances when wallet overlay opens
  useEffect(() => {
    if (showWalletOverlay) {
      refetchWool();
      refetchEth();
    }
  }, [showWalletOverlay, refetchWool, refetchEth]);

  const formatWool = (balance: bigint | undefined) => {
    if (!balance) return '0';
    const formatted = formatEther(balance);
    return parseFloat(formatted).toFixed(2);
  };

  const formatEth = (balance: bigint | undefined) => {
    if (!balance) return '0';
    const formatted = formatEther(balance);
    return parseFloat(formatted).toFixed(4);
  };

  const handleConnect = () => {
    const injectedConnector = connectors.find(c => c.id === 'injected') || connectors[1];
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
  };

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <header className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
        <Link href="/" className="text-lg sm:text-xl font-bold hover:opacity-80 transition">
          Wolf Game
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {isConnected ? (
            <>
              {/* Address with dropdown arrow */}
              <button
                onClick={() => setShowWalletOverlay(true)}
                className="flex items-center gap-1 text-xs sm:text-sm bg-muted px-2 sm:px-3 py-1 rounded-full hover:bg-muted/80 transition"
              >
                <span>{address?.slice(0, 4)}...{address?.slice(-4)}</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Hamburger menu */}
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 sm:p-2 bg-muted rounded-full hover:bg-muted/80 transition"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition"
            >
              Connect
            </button>
          )}
        </div>
      </header>

      {/* Wallet Overlay */}
      {showWalletOverlay && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowWalletOverlay(false)}
        >
          <div
            className="bg-card border border-border rounded-lg p-6 max-w-sm w-full shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowWalletOverlay(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Profile icon and address centered */}
            <div className="flex flex-col items-center mb-6">
              {/* Profile icon */}
              <div className="w-16 h-16 rounded-full overflow-hidden mb-3 bg-muted flex items-center justify-center">
                {userProfile?.pfpUrl ? (
                  <img
                    src={userProfile.pfpUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>

              {/* Username if available */}
              {userProfile?.username && (
                <div className="text-sm font-medium mb-1">@{userProfile.username}</div>
              )}

              {/* Address with copy */}
              <button
                onClick={copyAddress}
                className="flex items-center gap-2 text-sm font-mono bg-muted px-3 py-1.5 rounded-full hover:bg-muted/80 transition"
                title="Copy address"
              >
                <span>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                {copied ? (
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Balances */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">ETH Balance</span>
                <span className="font-semibold">{formatEth(ethBalance?.value)} ETH</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">WOOL Balance</span>
                <span className="font-semibold">{formatWool(woolBalance)} WOOL</span>
              </div>
            </div>

            {/* Disconnect */}
            <button
              onClick={() => {
                disconnect();
                setShowWalletOverlay(false);
              }}
              className="w-full py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition"
            >
              Disconnect Wallet
            </button>
          </div>
        </div>
      )}

      {/* Menu Dropdown */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="absolute top-14 right-3 sm:right-4 bg-card border border-border rounded-lg shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <Link
              href="/how-to-play"
              className="block px-4 py-3 text-sm hover:bg-muted transition border-b border-border"
              onClick={() => setShowMenu(false)}
            >
              How to Play
            </Link>
            <Link
              href="/faq"
              className="block px-4 py-3 text-sm hover:bg-muted transition"
              onClick={() => setShowMenu(false)}
            >
              FAQ
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
