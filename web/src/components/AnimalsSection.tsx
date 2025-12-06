'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { NFTCard } from './NFTCard';
import { useStake } from '@/hooks/useBarn';
import { useApproveForAll, useIsApprovedForAll } from '@/hooks/useWoolf';

interface AnimalsSectionProps {
  unstakedTokens: { tokenId: number; isSheep: boolean }[];
  onRefresh: () => void;
  onStakeStart?: (tokens: { tokenId: number; isSheep: boolean }[]) => void;
  onStakeSubmitted?: () => void;
  onStakeError?: () => void;
  disabled?: boolean;
  rescueEnabled?: boolean;
}

export function AnimalsSection({ unstakedTokens, onRefresh, onStakeStart, onStakeSubmitted, onStakeError, disabled, rescueEnabled }: AnimalsSectionProps) {
  const { address } = useAccount();
  const [selectedTokens, setSelectedTokens] = useState<Set<number>>(new Set());

  const { data: isApproved, refetch: refetchApproval } = useIsApprovedForAll(address);
  const { approve, isPending: isApprovePending, isConfirming: isApproveConfirming, isSuccess: isApproveSuccess } = useApproveForAll();
  const { stake, hash: stakeHash, isPending: isStakePending, isConfirming: isStakeConfirming, isSuccess: isStakeSuccess, error: stakeError } = useStake();
  const lastProcessedHashRef = useRef<string | undefined>(undefined);
  const stakingTokensRef = useRef<{ tokenId: number; isSheep: boolean }[]>([]);

  // Refetch approval status after successful approval
  useEffect(() => {
    if (isApproveSuccess) {
      refetchApproval();
    }
  }, [isApproveSuccess, refetchApproval]);

  // Notify parent when stake transaction is submitted (hash available)
  useEffect(() => {
    if (stakeHash && stakeHash !== lastProcessedHashRef.current && isStakeConfirming) {
      onStakeSubmitted?.();
    }
  }, [stakeHash, isStakeConfirming, onStakeSubmitted]);

  // Clear selection after successful stake (parent handles overlay)
  useEffect(() => {
    if (isStakeSuccess && stakeHash && stakeHash !== lastProcessedHashRef.current) {
      lastProcessedHashRef.current = stakeHash;
      setSelectedTokens(new Set());
      onRefresh();
    }
  }, [isStakeSuccess, stakeHash, onRefresh]);

  // Handle stake error
  useEffect(() => {
    if (stakeError) {
      onStakeError?.();
    }
  }, [stakeError, onStakeError]);

  const toggleSelect = (tokenId: number) => {
    const newSelected = new Set(selectedTokens);
    if (newSelected.has(tokenId)) {
      newSelected.delete(tokenId);
    } else {
      newSelected.add(tokenId);
    }
    setSelectedTokens(newSelected);
  };

  const handleApprove = () => {
    approve();
  };

  const handleStake = () => {
    if (!address || selectedTokens.size === 0) return;
    // Get token info for the tokens being staked
    const tokensToStake = Array.from(selectedTokens).map(id => {
      const token = unstakedTokens.find(t => t.tokenId === id);
      return { tokenId: id, isSheep: token?.isSheep ?? true };
    });
    stakingTokensRef.current = tokensToStake;
    onStakeStart?.(tokensToStake);
    stake(address, Array.from(selectedTokens));
  };

  // Clear selection only after successful stake (handled in the refresh effect above)

  const isLoading = isApprovePending || isApproveConfirming || isStakePending || isStakeConfirming;

  return (
    <div className="bg-card border border-border rounded-lg p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-semibold">Your Animals</h2>
        <div className="text-xs sm:text-sm text-muted-foreground">
          {unstakedTokens.length} unstaked
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-3 sm:mb-4">
        {rescueEnabled ? (
          <div className="flex-1 py-2 text-sm text-center text-orange-600 font-medium">
            Staking disabled during rescue mode
          </div>
        ) : !isApproved ? (
          <button
            onClick={handleApprove}
            disabled={isLoading}
            className="flex-1 py-2 text-sm bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isApprovePending || isApproveConfirming ? 'Approving...' : 'Approve Barn'}
          </button>
        ) : (
          <button
            onClick={handleStake}
            disabled={selectedTokens.size === 0 || isLoading}
            className="flex-1 py-2 text-sm bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isStakePending || isStakeConfirming
              ? 'Staking...'
              : `Stake Selected (${selectedTokens.size})`}
          </button>
        )}
      </div>

      {!isApproved && (
        <div className="text-xs text-muted-foreground mb-3 sm:mb-4">
          Approve the Barn contract to stake your animals.
        </div>
      )}

      {/* Animals - separated by type */}
      {unstakedTokens.length > 0 ? (
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {/* Sheep section */}
          {unstakedTokens.filter(t => t.isSheep).length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Sheep ({unstakedTokens.filter(t => t.isSheep).length})
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
                {unstakedTokens.filter(t => t.isSheep).map(({ tokenId }) => (
                  <NFTCard
                    key={tokenId}
                    tokenId={tokenId}
                    isSelected={selectedTokens.has(tokenId)}
                    onSelect={isApproved ? toggleSelect : undefined}
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          {/* Wolves section */}
          {unstakedTokens.filter(t => !t.isSheep).length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Wolves ({unstakedTokens.filter(t => !t.isSheep).length})
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
                {unstakedTokens.filter(t => !t.isSheep).map(({ tokenId }) => (
                  <NFTCard
                    key={tokenId}
                    tokenId={tokenId}
                    isSelected={selectedTokens.has(tokenId)}
                    onSelect={isApproved ? toggleSelect : undefined}
                    compact
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-6 text-sm">
          No unstaked animals. Mint some above!
        </div>
      )}
    </div>
  );
}
