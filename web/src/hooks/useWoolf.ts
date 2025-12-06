'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS, woolfAbi, type TokenTraits } from '@/lib/contracts';
import { parseEther } from 'viem';

// Shared query options to prevent excessive polling
const staticQueryOptions = {
  staleTime: Infinity, // Never consider stale (for static data like MINT_PRICE)
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
};

const dynamicQueryOptions = {
  staleTime: 30_000, // Consider fresh for 30 seconds
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
};

// Read total minted count
export function useMinted() {
  return useReadContract({
    address: CONTRACTS.woolf as `0x${string}`,
    abi: woolfAbi,
    functionName: 'minted',
    query: dynamicQueryOptions,
  });
}

// Read Gen 0 supply (PAID_TOKENS)
export function usePaidTokens() {
  return useReadContract({
    address: CONTRACTS.woolf as `0x${string}`,
    abi: woolfAbi,
    functionName: 'PAID_TOKENS',
    query: staticQueryOptions,
  });
}

// Read mint price
export function useMintPrice() {
  return useReadContract({
    address: CONTRACTS.woolf as `0x${string}`,
    abi: woolfAbi,
    functionName: 'MINT_PRICE',
    query: staticQueryOptions,
  });
}

// Read max Gen 0 per wallet
export function useMaxGen0PerWallet() {
  return useReadContract({
    address: CONTRACTS.woolf as `0x${string}`,
    abi: woolfAbi,
    functionName: 'maxGen0PerWallet',
    query: staticQueryOptions,
  });
}

// Read user's Gen 0 mint count
export function useGen0MintCount(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.woolf as `0x${string}`,
    abi: woolfAbi,
    functionName: 'gen0MintCount',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      ...dynamicQueryOptions,
    },
  });
}

// Read user's NFT balance
export function useNFTBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.woolf as `0x${string}`,
    abi: woolfAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      ...dynamicQueryOptions,
    },
  });
}

// Read token by index
export function useTokenOfOwnerByIndex(address: `0x${string}` | undefined, index: bigint) {
  return useReadContract({
    address: CONTRACTS.woolf as `0x${string}`,
    abi: woolfAbi,
    functionName: 'tokenOfOwnerByIndex',
    args: address ? [address, index] : undefined,
    query: {
      enabled: !!address,
      ...staticQueryOptions, // Token ownership is static once fetched
    },
  });
}

// Read token traits - these never change once minted
export function useTokenTraits(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.woolf as `0x${string}`,
    abi: woolfAbi,
    functionName: 'getTokenTraits',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
      ...staticQueryOptions, // Traits never change
    },
  });
}

// Read token URI (metadata) - never changes once minted
export function useTokenURI(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.woolf as `0x${string}`,
    abi: woolfAbi,
    functionName: 'tokenURI',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
      ...staticQueryOptions, // Token URI never changes
    },
  });
}

// Check if Barn is approved to transfer user's NFTs
export function useIsApprovedForAll(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.woolf as `0x${string}`,
    abi: woolfAbi,
    functionName: 'isApprovedForAll',
    args: owner ? [owner, CONTRACTS.barn as `0x${string}`] : undefined,
    query: {
      enabled: !!owner,
      ...dynamicQueryOptions,
    },
  });
}

// Mint NFTs
export function useMint() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const mint = (amount: number, stake: boolean, pricePerNFT: bigint) => {
    writeContract({
      address: CONTRACTS.woolf as `0x${string}`,
      abi: woolfAbi,
      functionName: 'mint',
      args: [BigInt(amount), stake],
      value: pricePerNFT * BigInt(amount),
    });
  };

  return { mint, hash, isPending, isConfirming, isSuccess, error };
}

// Approve Barn to transfer NFTs
export function useApproveForAll() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = () => {
    writeContract({
      address: CONTRACTS.woolf as `0x${string}`,
      abi: woolfAbi,
      functionName: 'setApprovalForAll',
      args: [CONTRACTS.barn as `0x${string}`, true],
    });
  };

  return { approve, hash, isPending, isConfirming, isSuccess, error };
}
