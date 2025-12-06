'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS, barnAbi, type StakeInfo } from '@/lib/contracts';

// Shared query options to prevent excessive polling
const staticQueryOptions = {
  staleTime: Infinity, // Never consider stale (for static data)
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
};

const dynamicQueryOptions = {
  staleTime: 30_000, // Consider fresh for 30 seconds
  refetchInterval: 30_000, // Poll every 30 seconds
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
};

// Read total sheep staked
export function useTotalSheepStaked() {
  return useReadContract({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'totalSheepStaked',
    query: dynamicQueryOptions,
  });
}

// Read total wolf alpha staked
export function useTotalAlphaStaked() {
  return useReadContract({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'totalAlphaStaked',
    query: dynamicQueryOptions,
  });
}

// Read WOOL per alpha (for wolf earnings calculation)
export function useWoolPerAlpha() {
  return useReadContract({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'woolPerAlpha',
    query: dynamicQueryOptions,
  });
}

// Read wolf stake info from pack mapping
// Returns { tokenId, value (woolPerAlpha when staked), owner }
export function useWolfStake(alpha: number | undefined, packIndex: number | undefined) {
  return useReadContract({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'pack',
    args: alpha !== undefined && packIndex !== undefined ? [BigInt(alpha), BigInt(packIndex)] : undefined,
    query: {
      enabled: alpha !== undefined && packIndex !== undefined,
      ...dynamicQueryOptions,
    },
  });
}

// Read pack index for a wolf token
export function usePackIndex(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'packIndices',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
      ...dynamicQueryOptions,
    },
  });
}

// Read daily WOOL rate for sheep
export function useDailyWoolRate() {
  return useReadContract({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'dailyWoolRate',
    query: dynamicQueryOptions, // Now configurable
  });
}

// Read minimum time to exit (default 2 days, configurable)
export function useMinimumToExit() {
  return useReadContract({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'minimumToExit',
    query: dynamicQueryOptions, // Now configurable
  });
}

// Read wool claim tax percentage (default 20%)
export function useWoolClaimTaxPercentage() {
  return useReadContract({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'woolClaimTaxPercentage',
    query: staticQueryOptions,
  });
}

// Read sheep steal chance (default 50%)
export function useSheepStealChance() {
  return useReadContract({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'sheepStealChance',
    query: staticQueryOptions,
  });
}

// Read pending WOOL for a specific token
export function usePendingWool(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'pendingWool',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
      ...dynamicQueryOptions,
    },
  });
}

// Read stake info for a sheep (from barn mapping)
export function useBarnStake(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'barn',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
      ...dynamicQueryOptions,
    },
  });
}

// Stake tokens
export function useStake() {
  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const stake = async (account: `0x${string}`, tokenIds: number[]) => {
    reset();
    console.log('[useStake] Starting stake for tokens:', tokenIds);
    try {
      const result = await writeContractAsync({
        address: CONTRACTS.barn as `0x${string}`,
        abi: barnAbi,
        functionName: 'addManyToBarnAndPack',
        args: [account, tokenIds.map(id => id)],
      });
      console.log('[useStake] Transaction submitted:', result);
      return result;
    } catch (err) {
      console.error('[useStake] Error:', err);
      throw err;
    }
  };

  return { stake, hash, isPending, isConfirming, isSuccess, error };
}

// Claim WOOL from staked tokens
export function useClaim() {
  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claim = async (tokenIds: number[]) => {
    // Reset previous state before new transaction
    reset();

    console.log('[useClaim] Starting claim for tokens:', tokenIds);
    try {
      const result = await writeContractAsync({
        address: CONTRACTS.barn as `0x${string}`,
        abi: barnAbi,
        functionName: 'claimMany',
        args: [tokenIds.map(id => id)],
      });
      console.log('[useClaim] Transaction submitted:', result);
      return result;
    } catch (err) {
      console.error('[useClaim] Error:', err);
      throw err;
    }
  };

  return { claim, hash, isPending, isConfirming, isSuccess, error };
}

// Unstake tokens (risky for sheep - 50% chance of being eaten!)
export function useUnstake() {
  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const unstake = async (tokenIds: number[]) => {
    reset();
    console.log('[useUnstake] Starting unstake for tokens:', tokenIds);
    try {
      const result = await writeContractAsync({
        address: CONTRACTS.barn as `0x${string}`,
        abi: barnAbi,
        functionName: 'unstakeMany',
        args: [tokenIds.map(id => id)],
      });
      console.log('[useUnstake] Transaction submitted:', result);
      return result;
    } catch (err) {
      console.error('[useUnstake] Error:', err);
      throw err;
    }
  };

  return { unstake, hash, isPending, isConfirming, isSuccess, error };
}

// Get all staked tokens for an owner
export function useStakedTokens(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'getStakedTokens',
    args: owner ? [owner] : undefined,
    query: {
      enabled: !!owner,
      ...dynamicQueryOptions,
    },
  });
}

// Get staked token count for an owner
export function useStakedTokenCount(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'getStakedTokenCount',
    args: owner ? [owner] : undefined,
    query: {
      enabled: !!owner,
      ...dynamicQueryOptions,
    },
  });
}

// Check if rescue mode is enabled
export function useRescueEnabled() {
  return useReadContract({
    address: CONTRACTS.barn as `0x${string}`,
    abi: barnAbi,
    functionName: 'rescueEnabled',
    query: dynamicQueryOptions,
  });
}

// Rescue tokens (emergency unstake with full WOOL, no taxes)
export function useRescue() {
  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const rescue = async (tokenIds: number[]) => {
    reset();
    console.log('[useRescue] Starting rescue for tokens:', tokenIds);
    try {
      const result = await writeContractAsync({
        address: CONTRACTS.barn as `0x${string}`,
        abi: barnAbi,
        functionName: 'rescue',
        args: [tokenIds.map(id => BigInt(id))],
      });
      console.log('[useRescue] Transaction submitted:', result);
      return result;
    } catch (err) {
      console.error('[useRescue] Error:', err);
      throw err;
    }
  };

  return { rescue, hash, isPending, isConfirming, isSuccess, error };
}
