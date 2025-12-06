'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { formatEther } from 'viem';
import { NFTCard } from './NFTCard';
import { useClaim, useUnstake, useMinimumToExit, useWoolClaimTaxPercentage, useSheepStealChance, useRescueEnabled, useRescue } from '@/hooks/useBarn';

interface BarnSectionProps {
  stakedTokens: { tokenId: number; isSheep: boolean; stakedAt?: number; alphaIndex?: number; stakedWoolPerAlpha?: bigint }[];
  totalPendingWool: bigint;
  currentWoolPerAlpha?: bigint;
  onRefresh: () => void;
  onUnstakeStart?: (tokens: { tokenId: number; isSheep: boolean }[]) => void;
  onUnstakeSubmitted?: (hasSheep: boolean) => void;
  onUnstakeError?: () => void;
  onClaimStart?: () => void;
  onClaimComplete?: (woolAmount: bigint) => void;
  disabled?: boolean;
}

// Check if a token is unlocked (staked for minimum time)
function isTokenUnlocked(stakedAt: number | undefined, minimumToExit: number): boolean {
  if (!stakedAt) return false;
  const now = Math.floor(Date.now() / 1000);
  return (now - stakedAt) >= minimumToExit;
}

export function BarnSection({ stakedTokens, totalPendingWool, currentWoolPerAlpha, onRefresh, onUnstakeStart, onUnstakeSubmitted, onUnstakeError, onClaimStart, onClaimComplete, disabled }: BarnSectionProps) {
  const [selectedTokens, setSelectedTokens] = useState<Set<number>>(new Set());
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{ woolAmount: bigint; taxAmount: bigint } | null>(null);
  const [claimProgress, setClaimProgress] = useState<string>('');
  const pendingWoolBeforeClaimRef = useRef<{ postTax: bigint; preTax: bigint }>({ postTax: BigInt(0), preTax: BigInt(0) });

  const { data: minimumToExit } = useMinimumToExit();
  const { data: woolClaimTaxPercentage } = useWoolClaimTaxPercentage();
  const { data: sheepStealChance } = useSheepStealChance();

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'claim' | 'unstake' | 'rescue';
    action: () => void;
    preTaxAmount?: bigint;
    postTaxAmount?: bigint;
    taxAmount?: bigint;
  } | null>(null);

  // Rescue state
  const [isRescuing, setIsRescuing] = useState(false);
  const [rescueResult, setRescueResult] = useState<{ tokenCount: number } | null>(null);
  const [rescueProgress, setRescueProgress] = useState<string>('');

  const taxPercent = woolClaimTaxPercentage !== undefined ? Number(woolClaimTaxPercentage) : 20;
  const stealPercent = sheepStealChance !== undefined ? Number(sheepStealChance) : 50;

  // WOOL per second = 10000 * 10^18 / 86400
  const WOOL_PER_SECOND = BigInt('115740740740740740');

  // Calculate pending wool for specific token IDs (returns both pre-tax and post-tax amounts for sheep)
  const calculatePendingWoolForTokens = (tokenIds: number[]): { postTax: bigint; preTax: bigint } => {
    const now = Math.floor(Date.now() / 1000);
    let postTaxTotal = BigInt(0);
    let preTaxTotal = BigInt(0);

    for (const tokenId of tokenIds) {
      const token = stakedTokens.find(t => t.tokenId === tokenId);
      if (!token) continue;

      if (token.isSheep && token.stakedAt) {
        const elapsed = BigInt(now - token.stakedAt);
        const preTaxEarned = elapsed * WOOL_PER_SECOND;
        // 80% to sheep (20% tax to wolves)
        const postTaxEarned = (preTaxEarned * BigInt(100 - taxPercent)) / BigInt(100);
        preTaxTotal += preTaxEarned;
        postTaxTotal += postTaxEarned;
      } else if (!token.isSheep && token.stakedWoolPerAlpha !== undefined && currentWoolPerAlpha !== undefined) {
        // Wolf earnings = (currentWoolPerAlpha - stakedWoolPerAlpha) * alphaScore
        // Wolf earnings are not taxed
        const alphaScore = BigInt(8 - (token.alphaIndex ?? 0));
        const woolPerAlphaDiff = currentWoolPerAlpha - token.stakedWoolPerAlpha;
        if (woolPerAlphaDiff > BigInt(0)) {
          const wolfEarned = woolPerAlphaDiff * alphaScore;
          postTaxTotal += wolfEarned;
          preTaxTotal += wolfEarned; // No tax for wolves
        }
      }
    }

    return { postTax: postTaxTotal, preTax: preTaxTotal };
  };

  // Default to 0 while loading (assume unlocked) to prevent false "locked" state
  // Once loaded, use the actual contract value
  const minExitTime = minimumToExit !== undefined ? Number(minimumToExit) : 0;

  const { claim, hash: claimHash, isPending: isClaimPending, isConfirming: isClaimConfirming, isSuccess: isClaimSuccess } = useClaim();
  const lastClaimHashRef = useRef<string | undefined>(undefined);
  const { unstake, hash: unstakeHash, isPending: isUnstakePending, isConfirming: isUnstakeConfirming, isSuccess: isUnstakeSuccess, error: unstakeError } = useUnstake();
  const lastUnstakeHashRef = useRef<string | undefined>(undefined);
  const unstakingHadSheepRef = useRef<boolean>(false);
  const unstakingTokensRef = useRef<{ tokenId: number; isSheep: boolean }[]>([]);

  // Rescue hooks
  const { data: rescueEnabled } = useRescueEnabled();
  const { rescue, hash: rescueHash, isPending: isRescuePending, isConfirming: isRescueConfirming, isSuccess: isRescueSuccess } = useRescue();
  const lastRescueHashRef = useRef<string | undefined>(undefined);


  // Notify parent when unstake transaction is submitted (hash available)
  useEffect(() => {
    if (unstakeHash && unstakeHash !== lastUnstakeHashRef.current && isUnstakeConfirming) {
      onUnstakeSubmitted?.(unstakingHadSheepRef.current);
    }
  }, [unstakeHash, isUnstakeConfirming, onUnstakeSubmitted]);

  // Clear selection after successful unstake (parent handles polling/overlay)
  useEffect(() => {
    if (isUnstakeSuccess && unstakeHash && unstakeHash !== lastUnstakeHashRef.current) {
      lastUnstakeHashRef.current = unstakeHash;
      setSelectedTokens(new Set());
    }
  }, [isUnstakeSuccess, unstakeHash]);

  // Handle unstake error
  useEffect(() => {
    if (unstakeError) {
      onUnstakeError?.();
    }
  }, [unstakeError, onUnstakeError]);

  const sheepCount = stakedTokens.filter(t => t.isSheep).length;
  const wolfCount = stakedTokens.filter(t => !t.isSheep).length;

  // Clear selection of tokens that are no longer staked
  useEffect(() => {
    const stakedIds = new Set(stakedTokens.map(t => t.tokenId));
    const validSelected = new Set([...selectedTokens].filter(id => stakedIds.has(id)));
    if (validSelected.size !== selectedTokens.size) {
      setSelectedTokens(validSelected);
    }
  }, [stakedTokens, selectedTokens]);

  // Allow selecting any staked token (for claiming)
  // Locked sheep can be selected for claiming but not unstaking
  const toggleSelect = (tokenId: number) => {
    const token = stakedTokens.find(t => t.tokenId === tokenId);
    if (!token) return;

    const newSelected = new Set(selectedTokens);
    if (newSelected.has(tokenId)) {
      newSelected.delete(tokenId);
    } else {
      newSelected.add(tokenId);
    }
    setSelectedTokens(newSelected);
  };

  // Check if any selected sheep are locked (can't unstake)
  const selectedHasLockedSheep = useMemo(() => {
    return Array.from(selectedTokens).some(id => {
      const token = stakedTokens.find(t => t.tokenId === id);
      return token?.isSheep && !isTokenUnlocked(token.stakedAt, minExitTime);
    });
  }, [selectedTokens, stakedTokens, minExitTime]);

  const executeClaimAll = async () => {
    // Calculate pending wool for all tokens
    pendingWoolBeforeClaimRef.current = calculatePendingWoolForTokens(stakedTokens.map(t => t.tokenId));
    setIsClaiming(true);
    setClaimResult(null);
    setClaimProgress('Confirming transaction...');
    onClaimStart?.();
    try {
      await claim(stakedTokens.map(t => t.tokenId));
      setClaimProgress('Waiting for confirmation...');
    } catch (err) {
      setClaimProgress(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => {
        setIsClaiming(false);
        setClaimProgress('');
      }, 3000);
    }
  };

  const executeClaimSelected = async () => {
    // Calculate pending wool only for selected tokens
    const selectedTokenIds = Array.from(selectedTokens);
    pendingWoolBeforeClaimRef.current = calculatePendingWoolForTokens(selectedTokenIds);
    setIsClaiming(true);
    setClaimResult(null);
    setClaimProgress('Confirming transaction...');
    onClaimStart?.();
    try {
      await claim(selectedTokenIds);
      setClaimProgress('Waiting for confirmation...');
    } catch (err) {
      setClaimProgress(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => {
        setIsClaiming(false);
        setClaimProgress('');
      }, 3000);
    }
  };

  const handleClaimAll = () => {
    if (stakedTokens.length === 0) return;
    const { postTax, preTax } = calculatePendingWoolForTokens(stakedTokens.map(t => t.tokenId));
    const taxAmount = preTax - postTax;
    setConfirmDialog({ type: 'claim', action: executeClaimAll, preTaxAmount: preTax, postTaxAmount: postTax, taxAmount });
  };

  const handleClaimSelected = () => {
    if (selectedTokens.size === 0) return;
    const { postTax, preTax } = calculatePendingWoolForTokens(Array.from(selectedTokens));
    const taxAmount = preTax - postTax;
    setConfirmDialog({ type: 'claim', action: executeClaimSelected, preTaxAmount: preTax, postTaxAmount: postTax, taxAmount });
  };

  // Watch for claim confirmation and show result
  useEffect(() => {
    // Only process if we have a new successful claim (hash changed)
    if (isClaimSuccess && claimHash && claimHash !== lastClaimHashRef.current) {
      lastClaimHashRef.current = claimHash;
      const { postTax, preTax } = pendingWoolBeforeClaimRef.current;
      const taxAmount = preTax - postTax;
      setClaimResult({ woolAmount: postTax, taxAmount });
      setClaimProgress('');
      setSelectedTokens(new Set()); // Clear selection after successful claim
      onClaimComplete?.(postTax);
      // Add delay before refresh to let blockchain state settle
      setTimeout(() => {
        onRefresh();
      }, 2000);
    }
  }, [isClaimSuccess, claimHash, onRefresh, onClaimComplete]);

  const handleCloseClaimOverlay = () => {
    setIsClaiming(false);
    setClaimResult(null);
    setClaimProgress('');
  };

  const selectedHasSheep = useMemo(() => {
    return Array.from(selectedTokens).some(id => {
      const token = stakedTokens.find(t => t.tokenId === id);
      return token?.isSheep;
    });
  }, [selectedTokens, stakedTokens]);

  const executeUnstakeSelected = () => {
    // Track if we're unstaking sheep (needs VRF polling) or just wolves (immediate)
    unstakingHadSheepRef.current = selectedHasSheep;
    // Get token info for the tokens being unstaked
    const tokensToUnstake = Array.from(selectedTokens).map(id => {
      const token = stakedTokens.find(t => t.tokenId === id);
      return { tokenId: id, isSheep: token?.isSheep ?? true };
    });
    unstakingTokensRef.current = tokensToUnstake;
    onUnstakeStart?.(tokensToUnstake);
    unstake(Array.from(selectedTokens));
  };

  const handleUnstakeSelected = () => {
    if (selectedTokens.size === 0) return;
    // Only show warning if unstaking sheep
    if (selectedHasSheep) {
      setConfirmDialog({ type: 'unstake', action: executeUnstakeSelected });
    } else {
      // Wolves can unstake without confirmation
      executeUnstakeSelected();
    }
  };

  // Rescue all tokens (emergency unstake with full WOOL, no taxes)
  const executeRescueAll = async () => {
    setIsRescuing(true);
    setRescueResult(null);
    setRescueProgress('Confirming transaction...');
    try {
      await rescue(stakedTokens.map(t => t.tokenId));
      setRescueProgress('Waiting for confirmation...');
    } catch (err) {
      setRescueProgress(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => {
        setIsRescuing(false);
        setRescueProgress('');
      }, 3000);
    }
  };

  const handleRescueAll = () => {
    if (stakedTokens.length === 0) return;
    setConfirmDialog({ type: 'rescue', action: executeRescueAll });
  };

  // Watch for rescue confirmation
  useEffect(() => {
    if (isRescueSuccess && rescueHash && rescueHash !== lastRescueHashRef.current) {
      lastRescueHashRef.current = rescueHash;
      setRescueResult({ tokenCount: stakedTokens.length });
      setRescueProgress('');
      setSelectedTokens(new Set());
      setTimeout(() => {
        onRefresh();
      }, 2000);
    }
  }, [isRescueSuccess, rescueHash, stakedTokens.length, onRefresh]);

  const handleCloseRescueOverlay = () => {
    setIsRescuing(false);
    setRescueResult(null);
    setRescueProgress('');
  };

  const isLoading = isClaimPending || isClaimConfirming || isUnstakePending || isUnstakeConfirming || isClaiming || isRescuePending || isRescueConfirming || isRescuing || disabled;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-4">Barn</h2>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        <div className="bg-muted rounded p-2">
          <div className="text-muted-foreground">Your Staked</div>
          <div className="font-semibold">{sheepCount} sheep, {wolfCount} wolves</div>
        </div>
        <div className="bg-muted rounded p-2">
          <div className="text-muted-foreground">WOOL Earned</div>
          <div className="font-semibold text-green-600">
            {parseFloat(formatEther(totalPendingWool)).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-2 mb-2">
        {/* Rescue button - only show when rescue mode is enabled */}
        {rescueEnabled && stakedTokens.length > 0 && (
          <>
            <div className="bg-orange-100 dark:bg-orange-900/30 border border-orange-400 rounded-lg p-3 mb-2">
              <p className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                Emergency rescue mode is enabled. Use the rescue button to safely recover all your tokens with full WOOL (no taxes, no steal risk).
              </p>
            </div>
            <button
              onClick={handleRescueAll}
              disabled={isLoading}
              className="w-full py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition border-2 border-orange-400"
            >
              {isRescuePending || isRescueConfirming ? 'Rescuing...' : `🚨 Emergency Rescue (${stakedTokens.length} tokens)`}
            </button>
          </>
        )}

        {/* Normal buttons - hidden when rescue mode is enabled */}
        {!rescueEnabled && (
          <>
            {/* Claim All button */}
            <button
              onClick={handleClaimAll}
              disabled={stakedTokens.length === 0 || isLoading}
              className="w-full py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isClaimPending || isClaimConfirming ? 'Claiming...' : 'Claim All WOOL'}
            </button>

            {/* Selected actions - only show when tokens are selected */}
            {selectedTokens.size > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleClaimSelected}
                  disabled={isLoading}
                  className="py-2 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Claim ({selectedTokens.size})
                </button>
                <button
                  onClick={handleUnstakeSelected}
                  disabled={isLoading || selectedHasLockedSheep}
                  className="py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  title={selectedHasLockedSheep ? 'Cannot unstake locked sheep' : undefined}
                >
                  Unstake ({selectedTokens.size})
                </button>
              </div>
            )}
          </>
        )}

      </div>


      {/* Staked animals - separated by type */}
      {stakedTokens.length > 0 ? (
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {/* Sheep section - sorted by stakedAt ascending (oldest first = most wool earned) */}
          {sheepCount > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Sheep ({sheepCount}) - sorted by WOOL earned</div>
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                {stakedTokens
                  .filter(t => t.isSheep)
                  .sort((a, b) => (a.stakedAt ?? Infinity) - (b.stakedAt ?? Infinity))
                  .map(({ tokenId, stakedAt }) => {
                  const isLocked = !isTokenUnlocked(stakedAt, minExitTime);
                  return (
                    <NFTCard
                      key={tokenId}
                      tokenId={tokenId}
                      isStaked
                      isSelected={selectedTokens.has(tokenId)}
                      onSelect={toggleSelect}
                      showPendingWool
                      stakedAt={stakedAt}
                      isLocked={isLocked}
                      minimumToExit={minExitTime}
                      compact
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Wolves section */}
          {wolfCount > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Wolves ({wolfCount})</div>
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                {stakedTokens.filter(t => !t.isSheep).map(({ tokenId, alphaIndex, stakedWoolPerAlpha }) => (
                  <NFTCard
                    key={tokenId}
                    tokenId={tokenId}
                    isStaked
                    isSelected={selectedTokens.has(tokenId)}
                    onSelect={toggleSelect}
                    showPendingWool
                    alphaIndex={alphaIndex}
                    stakedWoolPerAlpha={stakedWoolPerAlpha}
                    currentWoolPerAlpha={currentWoolPerAlpha}
                    compact
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-6 text-sm">
          No animals staked yet
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 sm:p-8 max-w-md w-full mx-4 text-center shadow-xl">
            {confirmDialog.type === 'claim' ? (
              <>
                <div className="text-4xl mb-3">🧶</div>
                <h3 className="text-lg font-semibold mb-2">Claim WOOL?</h3>
                {confirmDialog.preTaxAmount && confirmDialog.taxAmount !== undefined && confirmDialog.postTaxAmount ? (
                  <div className="text-sm mb-4 space-y-1">
                    <div className="text-muted-foreground">
                      Earned: <span className="text-foreground font-medium">{parseFloat(formatEther(confirmDialog.preTaxAmount)).toFixed(2)} WOOL</span>
                    </div>
                    {confirmDialog.taxAmount > BigInt(0) && (
                      <div className="text-muted-foreground">
                        Wolf tax ({taxPercent}%): <span className="text-purple-600 font-medium">-{parseFloat(formatEther(confirmDialog.taxAmount)).toFixed(2)} WOOL</span>
                      </div>
                    )}
                    <div className="border-t border-border pt-1 mt-1">
                      <span className="text-muted-foreground">You receive:</span> <span className="text-green-600 font-semibold">{parseFloat(formatEther(confirmDialog.postTaxAmount)).toFixed(2)} WOOL</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm mb-4">
                    {taxPercent}% of your WOOL will be taxed by staked wolves.
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="flex-1 py-2.5 bg-muted text-foreground font-semibold rounded-lg hover:bg-muted/80 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDialog(null);
                      confirmDialog.action();
                    }}
                    className="flex-1 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
                  >
                    Claim
                  </button>
                </div>
              </>
            ) : confirmDialog.type === 'unstake' ? (
              <>
                <div className="text-4xl mb-3">⚠️</div>
                <h3 className="text-lg font-semibold mb-2">Unstake Sheep?</h3>
                <p className="text-muted-foreground text-sm mb-2">
                  {stealPercent}% chance your sheep will be stolen by wolves!
                </p>
                <p className="text-red-500 text-sm mb-4">
                  If stolen, you lose the sheep AND all unclaimed WOOL.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="flex-1 py-2.5 bg-muted text-foreground font-semibold rounded-lg hover:bg-muted/80 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDialog(null);
                      confirmDialog.action();
                    }}
                    className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition"
                  >
                    Unstake
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">🚨</div>
                <h3 className="text-lg font-semibold mb-2">Emergency Rescue</h3>
                <p className="text-muted-foreground text-sm mb-2">
                  This will return all your staked tokens with full WOOL earned.
                </p>
                <p className="text-green-600 text-sm mb-4">
                  No wolf tax, no steal risk - guaranteed safe return!
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="flex-1 py-2.5 bg-muted text-foreground font-semibold rounded-lg hover:bg-muted/80 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDialog(null);
                      confirmDialog.action();
                    }}
                    className="flex-1 py-2.5 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition"
                  >
                    Rescue All
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Claiming overlay */}
      {isClaiming && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 sm:p-8 max-w-md w-full mx-4 text-center shadow-xl">
            {!claimResult ? (
              <>
                <div className="text-5xl mb-4 animate-bounce">🧶</div>
                <h3 className="text-lg font-semibold mb-2">Claiming WOOL</h3>
                <p className="text-muted-foreground text-sm mb-4">{claimProgress}</p>
                <div className="flex justify-center gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">🎉</div>
                <h3 className="text-lg font-semibold mb-1">WOOL Claimed!</h3>
                <p className="text-3xl font-bold text-green-600 mb-2">
                  +{parseFloat(formatEther(claimResult.woolAmount)).toFixed(2)} WOOL
                </p>
                {claimResult.taxAmount > BigInt(0) && (
                  <p className="text-sm text-purple-600 mb-2">
                    {parseFloat(formatEther(claimResult.taxAmount)).toFixed(2)} WOOL paid to wolves
                  </p>
                )}
                <p className="text-muted-foreground text-xs mb-4">
                  Note: Claimed animals are now locked for the minimum staking period.
                </p>
                <button
                  onClick={handleCloseClaimOverlay}
                  className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition"
                >
                  Continue
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Rescue overlay */}
      {isRescuing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 sm:p-8 max-w-md w-full mx-4 text-center shadow-xl">
            {!rescueResult ? (
              <>
                <div className="text-5xl mb-4 animate-bounce">🚨</div>
                <h3 className="text-lg font-semibold mb-2">Rescuing Tokens</h3>
                <p className="text-muted-foreground text-sm mb-4">{rescueProgress}</p>
                <div className="flex justify-center gap-1">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">✅</div>
                <h3 className="text-lg font-semibold mb-1">Rescue Complete!</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {rescueResult.tokenCount} token{rescueResult.tokenCount > 1 ? 's' : ''} returned to your wallet with full WOOL.
                </p>
                <button
                  onClick={handleCloseRescueOverlay}
                  className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition"
                >
                  Continue
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
