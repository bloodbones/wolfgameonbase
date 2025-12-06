'use client';

import { useReadContract } from 'wagmi';
import { CONTRACTS, woolAbi } from '@/lib/contracts';

// Read user's WOOL balance
export function useWoolBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.wool as `0x${string}`,
    abi: woolAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

// Read WOOL decimals (should be 18)
export function useWoolDecimals() {
  return useReadContract({
    address: CONTRACTS.wool as `0x${string}`,
    abi: woolAbi,
    functionName: 'decimals',
  });
}
