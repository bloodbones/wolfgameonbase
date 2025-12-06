'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { Header } from '@/components/Header';
import { MintSection } from '@/components/MintSection';
import { BarnSection } from '@/components/BarnSection';
import { AnimalsSection } from '@/components/AnimalsSection';
import { NFTCard } from '@/components/NFTCard';
import { CONTRACTS, woolfAbi, barnAbi } from '@/lib/contracts';
import { useStakedTokens, useWoolPerAlpha, useRescueEnabled } from '@/hooks/useBarn';

interface TokenInfo {
  tokenId: number;
  isSheep: boolean;
  stakedAt?: number; // Unix timestamp when staked (for sheep)
  alphaIndex?: number; // Alpha index for wolves (0-3, maps to alpha 8,7,6,5)
  stakedWoolPerAlpha?: bigint; // woolPerAlpha when wolf was staked
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const [unstakedTokens, setUnstakedTokens] = useState<TokenInfo[]>([]);
  const [stakedTokensWithTraits, setStakedTokensWithTraits] = useState<TokenInfo[]>([]);
  const [totalPendingWool, setTotalPendingWool] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isMinting, setIsMinting] = useState(false);
  const [mintStatus, setMintStatus] = useState<string>('');
  const [newlyMintedTokens, setNewlyMintedTokens] = useState<TokenInfo[]>([]);
  const [isStaking, setIsStaking] = useState(false);
  const [stakeStatus, setStakeStatus] = useState<string>('');
  const [stakedTokensResult, setStakedTokensResult] = useState<TokenInfo[] | null>(null);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [unstakeStatus, setUnstakeStatus] = useState<string>('');
  const [unstakeResult, setUnstakeResult] = useState<{ returned: TokenInfo[]; stolen: number } | null>(null);
  const previousBalanceRef = useRef<bigint | undefined>(undefined);
  const previousStakedRef = useRef<number[] | undefined>(undefined);
  const stakingTokensRef = useRef<{ tokenId: number; isSheep: boolean }[]>([]);
  const unstakingTokensRef = useRef<{ tokenId: number; isSheep: boolean }[]>([]);
  const stakePollRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchedBalanceRef = useRef<bigint | undefined>(undefined);
  const lastFetchedRefreshKeyRef = useRef<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const unstakePollRef = useRef<NodeJS.Timeout | null>(null);
  const mintCompletedRef = useRef<boolean>(false);

  // Cleanup all intervals on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (unstakePollRef.current) clearInterval(unstakePollRef.current);
      if (stakePollRef.current) clearInterval(stakePollRef.current);
    };
  }, []);

  // Get staked token IDs directly from contract
  const { data: stakedTokenIds, refetch: refetchStakedTokens } = useStakedTokens(address);

  // Get current woolPerAlpha (for wolf earnings calculation)
  const { data: currentWoolPerAlpha, refetch: refetchWoolPerAlpha } = useWoolPerAlpha();

  // Check if rescue mode is enabled
  const { data: rescueEnabled } = useRescueEnabled();

  // Fetch user's token balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.woolf as `0x${string}`,
    abi: woolfAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      staleTime: 30_000, // Consider fresh for 30 seconds
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });

  // Fetch unstaked tokens when balance or refreshKey changes
  useEffect(() => {
    const fetchUnstakedTokens = async () => {
      if (!address) {
        setUnstakedTokens([]);
        return;
      }

      // Skip if nothing has changed (unless balance is undefined which means first load)
      const balanceUnchanged = lastFetchedBalanceRef.current === balance;
      const noNewRefresh = lastFetchedRefreshKeyRef.current === refreshKey;
      if (balanceUnchanged && noNewRefresh && balance !== undefined) {
        return;
      }
      lastFetchedBalanceRef.current = balance;
      lastFetchedRefreshKeyRef.current = refreshKey;

      const tokenCount = balance ? Number(balance) : 0;
      if (tokenCount === 0) {
        setUnstakedTokens([]);
        return;
      }

      setIsLoading(true);
      try {
        // Fetch all unstaked tokens in a single batch call
        const response = await fetch(`/api/tokens?address=${address}&count=${Math.min(tokenCount, 50)}`);
        if (response.ok) {
          const data = await response.json();
          // Deduplicate by tokenId to prevent React key warnings
          const tokens: TokenInfo[] = data.tokens || [];
          const seen = new Set<number>();
          const uniqueTokens = tokens.filter(t => {
            if (seen.has(t.tokenId)) return false;
            seen.add(t.tokenId);
            return true;
          });
          setUnstakedTokens(uniqueTokens);
        } else {
          setUnstakedTokens([]);
        }
      } catch (error) {
        console.error('Error fetching tokens:', error);
        setUnstakedTokens([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnstakedTokens();
  }, [address, balance, refreshKey]);

  // Generate contract read calls for staked token traits
  const traitsContracts = stakedTokenIds?.map(tokenId => ({
    address: CONTRACTS.woolf as `0x${string}`,
    abi: woolfAbi,
    functionName: 'getTokenTraits' as const,
    args: [BigInt(tokenId)],
  })) ?? [];

  // Generate contract read calls for barn stake info (to get staked timestamps for sheep)
  const barnContracts = stakedTokenIds?.map(tokenId => ({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'barn' as const,
    args: [BigInt(tokenId)],
  })) ?? [];

  // Generate contract read calls for pack indices (for wolves)
  const packIndicesContracts = stakedTokenIds?.map(tokenId => ({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'packIndices' as const,
    args: [BigInt(tokenId)],
  })) ?? [];

  // Fetch traits for all staked tokens in one call
  const { data: traitsResults } = useReadContracts({
    contracts: traitsContracts,
    query: {
      enabled: traitsContracts.length > 0,
      staleTime: Infinity, // Traits don't change
      refetchOnWindowFocus: false,
    },
  });

  // Fetch barn stake info (staked timestamps) for all staked tokens
  const { data: barnResults, refetch: refetchBarnInfo } = useReadContracts({
    contracts: barnContracts,
    query: {
      enabled: barnContracts.length > 0,
      staleTime: 30_000, // Timestamps reset on claim, so need to refetch
      refetchOnWindowFocus: false,
    },
  });

  // Fetch pack indices for all staked tokens (only meaningful for wolves)
  const { data: packIndicesResults, refetch: refetchPackIndices } = useReadContracts({
    contracts: packIndicesContracts,
    query: {
      enabled: packIndicesContracts.length > 0,
      staleTime: Infinity, // Pack indices don't change
      refetchOnWindowFocus: false,
    },
  });

  // Generate pack contract reads for wolves (depends on traits and packIndices)
  const packContracts = useMemo(() => {
    if (!stakedTokenIds || !traitsResults || !packIndicesResults) return [];
    if (traitsResults.length !== stakedTokenIds.length) return [];
    if (packIndicesResults.length !== stakedTokenIds.length) return [];

    const contracts: { address: `0x${string}`; abi: typeof barnAbi; functionName: 'pack'; args: [bigint, bigint] }[] = [];

    for (let i = 0; i < stakedTokenIds.length; i++) {
      const traits = traitsResults[i]?.result as { isSheep: boolean; alphaIndex: number } | undefined;
      const packIndex = packIndicesResults[i]?.result as bigint | undefined;

      // Only wolves have meaningful pack data
      if (traits && !traits.isSheep && packIndex !== undefined) {
        // Alpha = 8 - alphaIndex (so indices 0,1,2,3 map to alpha 8,7,6,5)
        const alpha = BigInt(8 - traits.alphaIndex);
        contracts.push({
          address: CONTRACTS.barn as `0x${string}`,
          abi: barnAbi,
          functionName: 'pack' as const,
          args: [alpha, packIndex],
        });
      }
    }
    return contracts;
  }, [stakedTokenIds, traitsResults, packIndicesResults]);

  // Fetch pack stake info for wolves
  const { data: packResults, refetch: refetchPackInfo } = useReadContracts({
    contracts: packContracts,
    query: {
      enabled: packContracts.length > 0,
      staleTime: 30_000, // May change after claims
      refetchOnWindowFocus: false,
    },
  });

  // Update staked tokens with traits when data changes
  useEffect(() => {
    if (!stakedTokenIds || stakedTokenIds.length === 0) {
      setStakedTokensWithTraits([]);
      return;
    }

    // Verify results match current stakedTokenIds length to avoid stale data mismatch
    const hasMatchingResults =
      traitsResults?.length === stakedTokenIds.length &&
      barnResults?.length === stakedTokenIds.length &&
      packIndicesResults?.length === stakedTokenIds.length;

    // Build a map of wolf tokenIds to their pack results
    // packResults only contains wolves, in order of wolf tokens in stakedTokenIds
    const wolfPackData = new Map<number, { stakedWoolPerAlpha: bigint }>();
    if (hasMatchingResults && packResults) {
      let packResultIndex = 0;
      for (let i = 0; i < stakedTokenIds.length; i++) {
        const traits = traitsResults?.[i]?.result as { isSheep: boolean; alphaIndex: number } | undefined;
        if (traits && !traits.isSheep && packResultIndex < packResults.length) {
          const packInfo = packResults[packResultIndex]?.result as [number, bigint, string] | undefined;
          if (packInfo) {
            wolfPackData.set(Number(stakedTokenIds[i]), {
              stakedWoolPerAlpha: packInfo[1], // value field is woolPerAlpha when staked
            });
          }
          packResultIndex++;
        }
      }
    }

    // Build staked tokens with traits and staked timestamps
    const stakedWithTraits: TokenInfo[] = stakedTokenIds.map((tokenId, i) => {
      // Only use results if lengths match (avoid index mismatch from stale data)
      const traits = hasMatchingResults
        ? traitsResults?.[i]?.result as { isSheep: boolean; alphaIndex: number } | undefined
        : undefined;
      const barnInfo = hasMatchingResults
        ? barnResults?.[i]?.result as [number, bigint, string] | undefined
        : undefined;

      // Extra validation: ensure barnInfo tokenId matches expected tokenId
      const barnTokenId = barnInfo ? Number(barnInfo[0]) : 0;
      const isValidBarnInfo = barnInfo && barnTokenId === Number(tokenId);

      const isSheep = traits?.isSheep ?? true;

      if (isSheep) {
        // Sheep: use barn timestamp
        return {
          tokenId: Number(tokenId),
          isSheep: true,
          stakedAt: isValidBarnInfo ? Number(barnInfo[1]) : undefined, // value field is timestamp for sheep
        };
      } else {
        // Wolf: use pack data for earnings
        const wolfData = wolfPackData.get(Number(tokenId));
        return {
          tokenId: Number(tokenId),
          isSheep: false,
          alphaIndex: traits?.alphaIndex ?? 0,
          stakedWoolPerAlpha: wolfData?.stakedWoolPerAlpha,
        };
      }
    });
    setStakedTokensWithTraits(stakedWithTraits);
  }, [stakedTokenIds, traitsResults, barnResults, packIndicesResults, packResults]);

  // Calculate pending WOOL client-side with live updates
  // DAILY_WOOL_RATE = 10000 ether = 10000 * 10^18 per day
  // Per second = 10000 * 10^18 / 86400 ≈ 115740740740740740 wei/second
  const WOOL_PER_SECOND = BigInt('115740740740740740');

  useEffect(() => {
    if (stakedTokensWithTraits.length === 0) {
      setTotalPendingWool(BigInt(0));
      return;
    }

    const calculatePendingWool = () => {
      const now = Math.floor(Date.now() / 1000);
      let total = BigInt(0);

      for (const token of stakedTokensWithTraits) {
        if (token.isSheep && token.stakedAt) {
          const elapsed = BigInt(now - token.stakedAt);
          // Show pre-tax amount (full earnings before wolf tax)
          const earned = elapsed * WOOL_PER_SECOND;
          total += earned;
        } else if (!token.isSheep && token.stakedWoolPerAlpha !== undefined && currentWoolPerAlpha !== undefined) {
          // Wolf earnings = (currentWoolPerAlpha - stakedWoolPerAlpha) * alphaScore
          // Alpha score = 8 - alphaIndex (so indices 0,1,2,3 map to alpha 8,7,6,5)
          const alphaScore = BigInt(8 - (token.alphaIndex ?? 0));
          const woolPerAlphaDiff = currentWoolPerAlpha - token.stakedWoolPerAlpha;
          if (woolPerAlphaDiff > BigInt(0)) {
            const wolfEarned = woolPerAlphaDiff * alphaScore;
            total += wolfEarned;
          }
        }
      }

      setTotalPendingWool(total);
    };

    // Calculate immediately
    calculatePendingWool();

    // Update every second for live counter (sheep earnings grow, wolf earnings only change on claims)
    const interval = setInterval(calculatePendingWool, 1000);
    return () => clearInterval(interval);
  }, [stakedTokensWithTraits, currentWoolPerAlpha]);

  const handleRefresh = useCallback(() => {
    refetchBalance();
    refetchStakedTokens();
    refetchBarnInfo();
    refetchWoolPerAlpha();
    refetchPackInfo();
    setRefreshKey(k => k + 1);
  }, [refetchBalance, refetchStakedTokens, refetchBarnInfo, refetchWoolPerAlpha, refetchPackInfo]);

  // Minting state handlers
  const handleMintStart = useCallback((_amount: number) => {
    previousBalanceRef.current = balance;
    mintCompletedRef.current = false;
    setNewlyMintedTokens([]);
    setIsMinting(true);
    setMintStatus(`Confirming transaction...`);
  }, [balance]);

  const handleMintSubmitted = useCallback((_amount: number) => {
    setMintStatus(`Waiting for VRF callback... (this may take ~30 seconds)`);

    // Clear any existing poll before starting new one
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Start polling for balance change
    pollIntervalRef.current = setInterval(async () => {
      // Skip if mint already completed (use ref to avoid stale closure)
      if (mintCompletedRef.current) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        return;
      }

      const result = await refetchBalance();
      const newBalance = result.data;
      const oldBalance = previousBalanceRef.current;

      if (newBalance !== undefined && oldBalance !== undefined && newBalance > oldBalance) {
        // Balance increased - mint completed!
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;

        const numNewTokens = Number(newBalance - oldBalance);
        setMintStatus(`Fetching your new animals...`);

        // Get existing token IDs to filter out
        const existingTokenIds = new Set(unstakedTokens.map(t => t.tokenId));

        // Fetch the newly minted tokens (they're at the end of the owner's list)
        // Add cache-busting timestamp to avoid stale data
        const newTokens: TokenInfo[] = [];
        for (let i = Number(oldBalance); i < Number(newBalance); i++) {
          try {
            const response = await fetch(
              `/api/tokens?address=${address}&index=${i}&woolf=${CONTRACTS.woolf}&t=${Date.now()}`
            );
            if (response.ok) {
              const data = await response.json();
              // Only add if it's truly a new token we didn't have before
              if (!existingTokenIds.has(data.tokenId)) {
                newTokens.push({ tokenId: data.tokenId, isSheep: data.isSheep });
              }
            }
          } catch (e) {
            console.error(`Error fetching new token ${i}:`, e);
          }
        }

        // Mark mint as completed to prevent further polling
        mintCompletedRef.current = true;

        // Clear the poll interval immediately
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }

        // Update both state values together to ensure consistent UI
        const successMessage = `You minted ${numNewTokens} animal${numNewTokens > 1 ? 's' : ''}!`;
        setNewlyMintedTokens(newTokens);
        // Use setTimeout to ensure this runs after the tokens state update
        setTimeout(() => setMintStatus(successMessage), 0);
        // Delay refresh to prevent re-render from clearing the newly minted tokens
        setTimeout(() => {
          setRefreshKey(k => k + 1);
        }, 100);
      }
    }, 10000); // Poll every 10 seconds to avoid rate limiting

    // Timeout after 2 minutes
    setTimeout(() => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        setMintStatus('Taking longer than expected... Please refresh manually.');
        setTimeout(() => {
          setIsMinting(false);
          setMintStatus('');
          setNewlyMintedTokens([]);
        }, 3000);
      }
    }, 120000);
  }, [refetchBalance, address, unstakedTokens]);

  const handleMintError = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setIsMinting(false);
    setMintStatus('');
    setNewlyMintedTokens([]);
  }, []);

  const handleCloseMintOverlay = useCallback(() => {
    setIsMinting(false);
    setMintStatus('');
    setNewlyMintedTokens([]);
  }, []);

  // Unstaking state handlers
  const handleUnstakeStart = useCallback((tokens: { tokenId: number; isSheep: boolean }[]) => {
    previousBalanceRef.current = balance;
    previousStakedRef.current = stakedTokenIds ? [...stakedTokenIds].map(Number) : [];
    unstakingTokensRef.current = tokens;
    setUnstakeResult(null);
    setIsUnstaking(true);
    setUnstakeStatus('Confirming transaction...');
  }, [balance, stakedTokenIds]);

  const handleUnstakeSubmitted = useCallback((hasSheep: boolean) => {
    if (hasSheep) {
      setUnstakeStatus('Waiting for VRF callback... (this may take ~30 seconds)');
    } else {
      setUnstakeStatus('Processing...');
    }

    // Clear any existing poll before starting new one
    if (unstakePollRef.current) {
      clearInterval(unstakePollRef.current);
      unstakePollRef.current = null;
    }

    // Poll for staked tokens change
    unstakePollRef.current = setInterval(async () => {
      const result = await refetchStakedTokens();
      const newStaked = result.data ? [...result.data].map(Number) : [];

      // Check if tokens we unstaked are no longer in staked list
      const unstakingIds = unstakingTokensRef.current.map(t => t.tokenId);

      // Guard: if no tokens being unstaked, stop polling
      if (unstakingIds.length === 0) {
        if (unstakePollRef.current) clearInterval(unstakePollRef.current);
        unstakePollRef.current = null;
        return;
      }

      const tokensStillStaked = unstakingIds.filter(id => newStaked.includes(id));

      if (tokensStillStaked.length === 0) {
        // All tokens processed
        if (unstakePollRef.current) clearInterval(unstakePollRef.current);
        unstakePollRef.current = null;

        // Refresh balance to get returned tokens
        const balanceResult = await refetchBalance();
        const newBalance = balanceResult.data;
        const oldBalance = previousBalanceRef.current;

        // Calculate results
        const unstakingTokens = unstakingTokensRef.current;
        const sheepCount = unstakingTokens.filter(t => t.isSheep).length;
        const wolfCount = unstakingTokens.filter(t => !t.isSheep).length;

        // Wolves always return, sheep have 50% chance of being stolen
        // New balance increase tells us how many returned
        const balanceIncrease = newBalance && oldBalance ? Number(newBalance - oldBalance) : 0;
        // Expected return = all wolves + all sheep (before steal chance)
        const expectedReturn = unstakingTokens.length;
        // Stolen can only be sheep - wolves always return
        // If we got fewer tokens back than expected, the difference is stolen sheep
        const actualReturned = balanceIncrease;
        const stolen = sheepCount > 0 ? Math.max(0, expectedReturn - actualReturned) : 0;

        // Fetch the returned tokens
        const returned: TokenInfo[] = [];
        if (newBalance && oldBalance) {
          for (let i = Number(oldBalance); i < Number(newBalance); i++) {
            try {
              const response = await fetch(
                `/api/tokens?address=${address}&index=${i}&woolf=${CONTRACTS.woolf}&t=${Date.now()}`
              );
              if (response.ok) {
                const data = await response.json();
                returned.push({ tokenId: data.tokenId, isSheep: data.isSheep });
              }
            } catch (e) {
              console.error(`Error fetching returned token ${i}:`, e);
            }
          }
        }

        setUnstakeResult({ returned, stolen });
        if (stolen > 0 && sheepCount > 0) {
          setUnstakeStatus(`${stolen} sheep ${stolen === 1 ? 'was' : 'were'} stolen by wolves!`);
        } else if (sheepCount === 0) {
          // Only wolves were unstaked - they always return
          setUnstakeStatus(`${wolfCount} ${wolfCount === 1 ? 'wolf' : 'wolves'} returned safely!`);
        } else {
          setUnstakeStatus(`All ${unstakingTokens.length} animal${unstakingTokens.length > 1 ? 's' : ''} returned safely!`);
        }
        setRefreshKey(k => k + 1);
      }
    }, 5000);

    // Timeout after 2 minutes
    setTimeout(() => {
      if (unstakePollRef.current) {
        clearInterval(unstakePollRef.current);
        setUnstakeStatus('Taking longer than expected... Please refresh manually.');
        setTimeout(() => {
          setIsUnstaking(false);
          setUnstakeStatus('');
          setUnstakeResult(null);
        }, 3000);
      }
    }, 120000);
  }, [refetchStakedTokens, refetchBalance, address]);

  const handleUnstakeError = useCallback(() => {
    if (unstakePollRef.current) clearInterval(unstakePollRef.current);
    setIsUnstaking(false);
    setUnstakeStatus('');
    setUnstakeResult(null);
  }, []);

  const handleCloseUnstakeOverlay = useCallback(() => {
    setIsUnstaking(false);
    setUnstakeStatus('');
    setUnstakeResult(null);
  }, []);

  // Staking state handlers
  const handleStakeStart = useCallback((tokens: { tokenId: number; isSheep: boolean }[]) => {
    previousStakedRef.current = stakedTokenIds ? [...stakedTokenIds].map(Number) : [];
    stakingTokensRef.current = tokens;
    setStakedTokensResult(null);
    setIsStaking(true);
    setStakeStatus('Confirming transaction...');
  }, [stakedTokenIds]);

  const handleStakeSubmitted = useCallback(() => {
    setStakeStatus('Processing...');

    // Clear any existing poll before starting new one
    if (stakePollRef.current) {
      clearInterval(stakePollRef.current);
      stakePollRef.current = null;
    }

    // Poll for staked tokens change
    stakePollRef.current = setInterval(async () => {
      const result = await refetchStakedTokens();
      const newStaked = result.data ? [...result.data].map(Number) : [];
      const oldStaked = previousStakedRef.current || [];

      // Check if tokens we staked are now in staked list
      const stakingIds = stakingTokensRef.current.map(t => t.tokenId);

      // Guard: if no tokens being staked, stop polling
      if (stakingIds.length === 0) {
        if (stakePollRef.current) clearInterval(stakePollRef.current);
        stakePollRef.current = null;
        return;
      }

      const tokensNowStaked = stakingIds.filter(id => newStaked.includes(id) && !oldStaked.includes(id));

      if (tokensNowStaked.length === stakingIds.length) {
        // All tokens staked
        if (stakePollRef.current) clearInterval(stakePollRef.current);
        stakePollRef.current = null;

        setStakedTokensResult(stakingTokensRef.current);
        setStakeStatus(`Successfully staked ${stakingTokensRef.current.length} animal${stakingTokensRef.current.length > 1 ? 's' : ''}!`);
        setRefreshKey(k => k + 1);
      }
    }, 3000);

    // Timeout after 60 seconds
    setTimeout(() => {
      if (stakePollRef.current) {
        clearInterval(stakePollRef.current);
        setStakeStatus('Taking longer than expected... Please refresh manually.');
        setTimeout(() => {
          setIsStaking(false);
          setStakeStatus('');
          setStakedTokensResult(null);
        }, 3000);
      }
    }, 60000);
  }, [refetchStakedTokens]);

  const handleStakeError = useCallback(() => {
    if (stakePollRef.current) clearInterval(stakePollRef.current);
    setIsStaking(false);
    setStakeStatus('');
    setStakedTokensResult(null);
  }, []);

  const handleCloseStakeOverlay = useCallback(() => {
    setIsStaking(false);
    setStakeStatus('');
    setStakedTokensResult(null);
  }, []);


  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="p-3 sm:p-4 max-w-6xl mx-auto">
        {!isConnected ? (
          // Welcome screen for non-connected users (fallback for web)
          <div className="text-center py-12 sm:py-20">
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Welcome to Wolf Game Base</h2>
            <p className="text-muted-foreground mb-6 sm:mb-8 px-4">
              Mint sheep and wolves, stake them in the barn, and earn WOOL.
            </p>
            <div className="text-5xl sm:text-6xl mb-6 sm:mb-8">🐑 🐺</div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>90% chance to mint a Sheep</p>
              <p>10% chance to mint a Wolf</p>
              <p className="mt-2">Sheep earn 10,000 WOOL/day when staked</p>
              <p>Wolves earn 20% tax from all sheep claims</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {/* Top section: Mint and Barn - stack on mobile, side by side on larger */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <MintSection
                onMintStart={handleMintStart}
                onMintSubmitted={handleMintSubmitted}
                onMintError={handleMintError}
                disabled={isMinting}
                refreshKey={refreshKey}
              />
              <BarnSection
                stakedTokens={stakedTokensWithTraits}
                totalPendingWool={totalPendingWool}
                currentWoolPerAlpha={currentWoolPerAlpha}
                onRefresh={handleRefresh}
                onUnstakeStart={handleUnstakeStart}
                onUnstakeSubmitted={handleUnstakeSubmitted}
                onUnstakeError={handleUnstakeError}
                disabled={isUnstaking}
              />
            </div>

            {/* Bottom section: User's unstaked animals */}
            <AnimalsSection
              unstakedTokens={unstakedTokens}
              onRefresh={handleRefresh}
              onStakeStart={handleStakeStart}
              onStakeSubmitted={handleStakeSubmitted}
              onStakeError={handleStakeError}
              disabled={isStaking}
              rescueEnabled={rescueEnabled}
            />
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !isMinting && (
          <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-card border border-border rounded-full px-4 py-2 shadow-lg text-sm">
            Loading...
          </div>
        )}

        {/* Minting overlay - blocks all interaction */}
        {isMinting && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg p-6 sm:p-8 max-w-md w-full mx-4 text-center shadow-xl max-h-[90vh] overflow-y-auto">
              {newlyMintedTokens.length === 0 ? (
                <>
                  <div className="text-5xl mb-4 animate-bounce">🐑</div>
                  <h3 className="text-lg font-semibold mb-2">Minting in Progress</h3>
                  <p className="text-muted-foreground text-sm mb-4">{mintStatus}</p>
                  <div className="flex justify-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-3">🎉</div>
                  <h3 className="text-lg font-semibold mb-1">Congratulations!</h3>
                  <p className="text-muted-foreground text-sm mb-4">{mintStatus}</p>

                  {/* Show newly minted animals */}
                  <div className={`grid gap-3 mb-4 ${newlyMintedTokens.length === 1 ? 'grid-cols-1 max-w-[150px] mx-auto' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {newlyMintedTokens.map((token) => (
                      <NFTCard key={token.tokenId} tokenId={token.tokenId} />
                    ))}
                  </div>

                  <button
                    onClick={handleCloseMintOverlay}
                    className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition"
                  >
                    Continue
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Unstaking overlay */}
        {isUnstaking && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg p-6 sm:p-8 max-w-md w-full mx-4 text-center shadow-xl max-h-[90vh] overflow-y-auto">
              {!unstakeResult ? (
                <>
                  <div className="text-5xl mb-4 animate-bounce">🐺</div>
                  <h3 className="text-lg font-semibold mb-2">Unstaking in Progress</h3>
                  <p className="text-muted-foreground text-sm mb-4">{unstakeStatus}</p>
                  <div className="flex justify-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-3">{unstakeResult.stolen > 0 ? '😱' : '🎉'}</div>
                  <h3 className="text-lg font-semibold mb-3">
                    {unstakeResult.stolen > 0 ? 'Oh no!' : 'Success!'}
                  </h3>

                  {/* Summary text */}
                  <p className="text-sm mb-4">
                    {unstakeResult.stolen > 0 && (
                      <>
                        <span className="text-red-500">
                          {unstakeResult.stolen} sheep {unstakeResult.stolen === 1 ? 'was' : 'were'} stolen by wolves.
                        </span>
                        <span className="text-muted-foreground">
                          {' '}You lost all unclaimed WOOL from {unstakeResult.stolen === 1 ? 'that sheep' : 'those sheep'}.
                        </span>
                      </>
                    )}
                    {unstakeResult.stolen > 0 && unstakeResult.returned.length > 0 && <br />}
                    {unstakeResult.returned.length > 0 && (
                      <span className="text-green-600">
                        {unstakeResult.returned.length} {unstakeResult.returned.length === 1 ? 'token' : 'tokens'} returned to your wallet.
                      </span>
                    )}
                  </p>

                  {/* Show returned animals */}
                  {unstakeResult.returned.length > 0 && (
                    <div className={`grid gap-3 mb-4 ${unstakeResult.returned.length === 1 ? 'grid-cols-1 max-w-[150px] mx-auto' : 'grid-cols-2 sm:grid-cols-3'}`}>
                      {unstakeResult.returned.map((token) => (
                        <NFTCard key={token.tokenId} tokenId={token.tokenId} />
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleCloseUnstakeOverlay}
                    className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition"
                  >
                    Continue
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Staking overlay */}
        {isStaking && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg p-6 sm:p-8 max-w-md w-full mx-4 text-center shadow-xl max-h-[90vh] overflow-y-auto">
              {!stakedTokensResult ? (
                <>
                  <div className="text-5xl mb-4 animate-bounce">🏠</div>
                  <h3 className="text-lg font-semibold mb-2">Staking in Progress</h3>
                  <p className="text-muted-foreground text-sm mb-4">{stakeStatus}</p>
                  <div className="flex justify-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-3">🎉</div>
                  <h3 className="text-lg font-semibold mb-1">Staked!</h3>
                  <p className="text-muted-foreground text-sm mb-4">{stakeStatus}</p>

                  {/* Show staked animals */}
                  <p className="text-sm mb-2">Now earning WOOL in the barn:</p>
                  <div className={`grid gap-3 mb-4 ${stakedTokensResult.length === 1 ? 'grid-cols-1 max-w-[150px] mx-auto' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {stakedTokensResult.map((token) => (
                      <NFTCard key={token.tokenId} tokenId={token.tokenId} />
                    ))}
                  </div>

                  <button
                    onClick={handleCloseStakeOverlay}
                    className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition"
                  >
                    Continue
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Refresh button - positioned for mobile */}
        {isConnected && (
          <button
            onClick={handleRefresh}
            className="fixed bottom-4 right-4 bg-card border border-border rounded-full w-12 h-12 shadow-lg hover:bg-muted transition flex items-center justify-center"
            aria-label="Refresh"
          >
            ↻
          </button>
        )}
      </main>
    </div>
  );
}
