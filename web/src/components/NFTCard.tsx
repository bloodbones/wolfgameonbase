'use client';

import { useTokenTraits, useTokenURI } from '@/hooks/useWoolf';
import { formatEther } from 'viem';
import { useMemo, useState, useEffect } from 'react';

// WOOL per second = 10000 * 10^18 / 86400
const WOOL_PER_SECOND = BigInt('115740740740740740');

interface NFTCardProps {
  tokenId: number;
  isStaked?: boolean;
  isSelected?: boolean;
  onSelect?: (tokenId: number) => void;
  showPendingWool?: boolean;
  stakedAt?: number; // Unix timestamp when staked (for sheep)
  isSheepOverride?: boolean; // Pass isSheep from parent to avoid extra RPC call
  isLocked?: boolean; // Token is still in 2-day lock period
  compact?: boolean; // Smaller display mode
  minimumToExit?: number; // Minimum seconds before unstaking
  // Wolf-specific props
  alphaIndex?: number; // Alpha index for wolves (0-3, maps to alpha 8,7,6,5)
  stakedWoolPerAlpha?: bigint; // woolPerAlpha when wolf was staked
  currentWoolPerAlpha?: bigint; // Current woolPerAlpha for earnings calculation
}

export function NFTCard({ tokenId, isStaked, isSelected, onSelect, showPendingWool, stakedAt, isSheepOverride, isLocked, compact, minimumToExit, alphaIndex, stakedWoolPerAlpha, currentWoolPerAlpha }: NFTCardProps) {
  const { data: traits } = useTokenTraits(BigInt(tokenId));
  const { data: tokenURI } = useTokenURI(BigInt(tokenId));
  const [pendingWool, setPendingWool] = useState<bigint>(BigInt(0));
  const [timeToUnlock, setTimeToUnlock] = useState<string>('');

  // Calculate pending wool client-side with live updates
  useEffect(() => {
    if (!showPendingWool) {
      setPendingWool(BigInt(0));
      return;
    }

    // For sheep: calculate based on stakedAt timestamp (show pre-tax amount)
    if (stakedAt) {
      const calculateWool = () => {
        const now = Math.floor(Date.now() / 1000);
        const elapsed = BigInt(now - stakedAt);
        // Show pre-tax amount (full earnings before wolf tax)
        const earned = elapsed * WOOL_PER_SECOND;
        setPendingWool(earned);
      };

      calculateWool();
      const interval = setInterval(calculateWool, 1000);
      return () => clearInterval(interval);
    }

    // For wolves: calculate based on woolPerAlpha difference
    if (stakedWoolPerAlpha !== undefined && currentWoolPerAlpha !== undefined) {
      // Wolf earnings = (currentWoolPerAlpha - stakedWoolPerAlpha) * alphaScore
      // Alpha score = 8 - alphaIndex (so indices 0,1,2,3 map to alpha 8,7,6,5)
      const alphaScore = BigInt(8 - (alphaIndex ?? 0));
      const woolPerAlphaDiff = currentWoolPerAlpha - stakedWoolPerAlpha;
      if (woolPerAlphaDiff > BigInt(0)) {
        setPendingWool(woolPerAlphaDiff * alphaScore);
      } else {
        setPendingWool(BigInt(0));
      }
      // Wolf earnings don't change in real-time (only when sheep claim), so no interval needed
      return;
    }

    setPendingWool(BigInt(0));
  }, [showPendingWool, stakedAt, stakedWoolPerAlpha, currentWoolPerAlpha, alphaIndex]);

  // Calculate time remaining to unlock
  useEffect(() => {
    if (!isLocked || !stakedAt || !minimumToExit) {
      setTimeToUnlock('');
      return;
    }

    const calculateTime = () => {
      const now = Math.floor(Date.now() / 1000);
      const unlockAt = stakedAt + minimumToExit;
      const remaining = unlockAt - now;

      if (remaining <= 0) {
        setTimeToUnlock('');
        return;
      }

      const hours = Math.floor(remaining / 3600);
      const mins = Math.floor((remaining % 3600) / 60);

      if (hours > 0) {
        setTimeToUnlock(`${hours}h ${mins}m`);
      } else {
        const secs = remaining % 60;
        setTimeToUnlock(`${mins}m ${secs}s`);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [isLocked, stakedAt, minimumToExit]);

  // Parse the base64 encoded JSON metadata to get the SVG image
  const imageData = useMemo(() => {
    if (!tokenURI) return null;
    try {
      // tokenURI is: data:application/json;base64,{base64 encoded JSON}
      const json = atob(tokenURI.split(',')[1]);
      const metadata = JSON.parse(json);
      return metadata.image; // This is the SVG data URI
    } catch {
      return null;
    }
  }, [tokenURI]);

  const isSheep = traits?.isSheep ?? true;
  // Use prop alphaIndex if provided (for staked wolves), otherwise get from traits
  const displayAlphaIndex = alphaIndex ?? traits?.alphaIndex ?? 0;
  // Alpha scores are 8, 7, 6, 5 for indices 0, 1, 2, 3
  const alphaScore = [8, 7, 6, 5][displayAlphaIndex] ?? 5;

  // Compact mode for barn display
  if (compact) {
    return (
      <div
        onClick={() => onSelect?.(tokenId)}
        className={`
          relative bg-card border rounded p-1 transition-all
          ${isSelected ? 'border-primary ring-1 ring-primary/50' : 'border-border'}
          ${onSelect ? 'cursor-pointer hover:border-muted-foreground' : 'opacity-60'}
          ${isLocked ? 'opacity-50' : ''}
        `}
      >
        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full flex items-center justify-center">
            <span className="text-primary-foreground text-[8px]">✓</span>
          </div>
        )}

        {/* Lock indicator */}
        {isLocked && (
          <div className="absolute -top-0.5 -left-0.5">
            <span className="text-[10px]">🔒</span>
          </div>
        )}

        {/* NFT Image */}
        <div className="aspect-square bg-muted rounded overflow-hidden">
          {imageData ? (
            <img
              src={imageData}
              alt={`#${tokenId}`}
              className="w-full h-full object-cover"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm">
              {isSheep ? '🐑' : '🐺'}
            </div>
          )}
        </div>

        {/* Token ID, WOOL earned, and lock time */}
        <div className="text-[10px] text-center text-muted-foreground mt-0.5">#{tokenId}</div>
        {showPendingWool && pendingWool > BigInt(0) && (
          <div className={`text-[9px] text-center font-medium truncate ${isSheep ? 'text-green-600' : 'text-purple-600'}`}>
            +{parseFloat(formatEther(pendingWool)).toFixed(1)}
          </div>
        )}
        {isLocked && timeToUnlock && (
          <div className="text-[8px] text-center text-yellow-600 font-medium truncate">
            🔒{timeToUnlock}
          </div>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div
      onClick={() => onSelect?.(tokenId)}
      className={`
        relative bg-card border rounded-lg p-2 cursor-pointer transition-all
        ${isSelected ? 'border-primary ring-2 ring-primary/50' : 'border-border hover:border-muted-foreground'}
        ${onSelect ? 'hover:scale-105' : ''}
      `}
    >
      {/* Selection checkbox */}
      {onSelect && (
        <div className={`absolute top-1 right-1 w-5 h-5 rounded border-2 flex items-center justify-center
          ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground bg-background'}`}
        >
          {isSelected && <span className="text-primary-foreground text-xs">✓</span>}
        </div>
      )}

      {/* NFT Image */}
      <div className="aspect-square bg-muted rounded overflow-hidden mb-2">
        {imageData ? (
          <img
            src={imageData}
            alt={`#${tokenId}`}
            className="w-full h-full object-cover pixelated"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            {isSheep ? '🐑' : '🐺'}
          </div>
        )}
      </div>

      {/* Token info */}
      <div className="text-center">
        <div className="text-sm font-semibold">#{tokenId}</div>
        <div className={`text-xs px-2 py-0.5 rounded-full inline-block
          ${isSheep ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}
        >
          {isSheep ? 'Sheep' : `Wolf A${alphaScore}`}
        </div>

        {/* Staked badge */}
        {isStaked && (
          <div className="text-xs text-muted-foreground mt-1">
            {isLocked ? 'Locked' : 'Staked'}
          </div>
        )}

        {/* Pending WOOL */}
        {showPendingWool && pendingWool > BigInt(0) && (
          <div className={`text-xs mt-1 ${isSheep ? 'text-green-600' : 'text-purple-600'}`}>
            +{parseFloat(formatEther(pendingWool)).toFixed(2)} WOOL
          </div>
        )}
      </div>
    </div>
  );
}
