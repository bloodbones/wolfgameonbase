'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import {
  useMinted,
  usePaidTokens,
  useMintPrice,
  useMaxGen0PerWallet,
  useGen0MintCount,
  useMint,
} from '@/hooks/useWoolf';

interface MintSectionProps {
  onMintStart?: (amount: number) => void;
  onMintSubmitted?: (amount: number) => void;
  onMintError?: () => void;
  disabled?: boolean;
  refreshKey?: number;
}

export function MintSection({ onMintStart, onMintSubmitted, onMintError, disabled, refreshKey }: MintSectionProps) {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState(1);

  // Read contract data
  const { data: minted, refetch: refetchMinted } = useMinted();
  const { data: paidTokens } = usePaidTokens();
  const { data: mintPrice } = useMintPrice();
  const { data: maxPerWallet } = useMaxGen0PerWallet();
  const { data: userMintCount, refetch: refetchUserMintCount } = useGen0MintCount(address);

  // Refetch data when refreshKey changes
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      refetchMinted();
      refetchUserMintCount();
    }
  }, [refreshKey, refetchMinted, refetchUserMintCount]);

  // Mint function
  const { mint, isPending, isConfirming, isSuccess, error } = useMint();

  const mintedCount = minted ? Number(minted) : 0;
  const gen0Supply = paidTokens ? Number(paidTokens) : 10000;
  const price = mintPrice || BigInt(0);
  const maxPerUser = maxPerWallet ? Number(maxPerWallet) : 10;
  const userMints = userMintCount ? Number(userMintCount) : 0;
  const remainingMints = maxPerUser - userMints;

  const isGen0 = mintedCount < gen0Supply;
  const totalCost = price * BigInt(amount);

  // Track mint state changes to trigger callbacks
  // Note: onMintStart is called directly in handleMint for immediate clearing

  useEffect(() => {
    if (isSuccess) {
      onMintSubmitted?.(amount);
    }
  }, [isSuccess, amount, onMintSubmitted]);

  useEffect(() => {
    if (error) {
      onMintError?.();
    }
  }, [error, onMintError]);

  const handleMint = () => {
    if (!isConnected || !price || disabled) return;
    // Call onMintStart immediately when button is clicked to clear previous state
    onMintStart?.(amount);
    mint(amount, false, price);
  };

  const decreaseAmount = () => {
    if (amount > 1) setAmount(amount - 1);
  };

  const increaseAmount = () => {
    if (amount < Math.min(remainingMints, 10)) setAmount(amount + 1);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-4">Mint</h2>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-muted-foreground mb-1">
          <span>Gen 0 Progress</span>
          <span>{mintedCount.toLocaleString()} / {gen0Supply.toLocaleString()}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${(mintedCount / gen0Supply) * 100}%` }}
          />
        </div>
      </div>

      {/* User's mint count */}
      {isConnected && isGen0 && (
        <div className="text-sm text-muted-foreground mb-4">
          Your mints: {userMints} / {maxPerUser}
          {remainingMints === 0 && (
            <span className="text-red-500 ml-2">(Limit reached)</span>
          )}
        </div>
      )}

      {/* Amount selector */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={decreaseAmount}
          disabled={amount <= 1}
          className="w-10 h-10 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          -
        </button>
        <span className="text-xl font-semibold w-8 text-center">{amount}</span>
        <button
          onClick={increaseAmount}
          disabled={amount >= Math.min(remainingMints, 10)}
          className="w-10 h-10 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          +
        </button>
      </div>

      {/* Cost display */}
      <div className="text-sm text-muted-foreground mb-4">
        Cost: {formatEther(totalCost)} ETH
      </div>

      {/* Mint button */}
      <button
        onClick={handleMint}
        disabled={!isConnected || isPending || isConfirming || remainingMints === 0 || disabled}
        className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {!isConnected
          ? 'Connect Wallet'
          : disabled
          ? 'Minting...'
          : isPending
          ? 'Confirm in Wallet...'
          : isConfirming
          ? 'Submitting...'
          : remainingMints === 0
          ? 'Mint Limit Reached'
          : 'Mint'}
      </button>

      {/* Error message */}
      {error && !disabled && (
        <div className="mt-3 text-sm text-red-500">
          Error: {error.message.slice(0, 100)}
        </div>
      )}

      {/* Info about VRF */}
      <div className="mt-4 text-xs text-muted-foreground">
        NFTs use Chainlink VRF for randomness. Animals appear after ~30s callback.
      </div>
    </div>
  );
}
