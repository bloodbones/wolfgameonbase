import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { CONTRACTS, woolfAbi } from '@/lib/contracts';

// Create a public client for reading from the blockchain
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org';
const client = createPublicClient({
  chain: baseSepolia,
  transport: http(rpcUrl),
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const count = searchParams.get('count'); // New: fetch multiple tokens at once

  if (!address) {
    return NextResponse.json({ error: 'Missing address' }, { status: 400 });
  }

  // Batch mode: fetch all tokens for an address
  if (count) {
    const tokenCount = Math.min(parseInt(count), 50); // Cap at 50
    if (isNaN(tokenCount) || tokenCount <= 0) {
      return NextResponse.json({ error: 'Invalid count' }, { status: 400 });
    }

    try {
      // First, get all token IDs using multicall
      const tokenIdCalls = Array.from({ length: tokenCount }, (_, i) => ({
        address: CONTRACTS.woolf as `0x${string}`,
        abi: woolfAbi,
        functionName: 'tokenOfOwnerByIndex' as const,
        args: [address as `0x${string}`, BigInt(i)],
      }));

      const tokenIdResults = await client.multicall({
        contracts: tokenIdCalls,
        allowFailure: true,
      });

      // Filter successful results and get token IDs
      const validTokenIds: bigint[] = [];
      for (const result of tokenIdResults) {
        if (result.status === 'success' && result.result !== undefined) {
          validTokenIds.push(result.result as bigint);
        }
      }

      if (validTokenIds.length === 0) {
        return NextResponse.json({ tokens: [] });
      }

      // Now get traits for all valid tokens using multicall
      const traitsCalls = validTokenIds.map(tokenId => ({
        address: CONTRACTS.woolf as `0x${string}`,
        abi: woolfAbi,
        functionName: 'getTokenTraits' as const,
        args: [tokenId],
      }));

      const traitsResults = await client.multicall({
        contracts: traitsCalls,
        allowFailure: true,
      });

      // Combine results
      const tokens = validTokenIds.map((tokenId, i) => {
        const traitsResult = traitsResults[i];
        const isSheep = traitsResult.status === 'success'
          ? (traitsResult.result as { isSheep: boolean }).isSheep
          : true; // Default to sheep if traits fetch fails
        return {
          tokenId: Number(tokenId),
          isSheep,
        };
      });

      return NextResponse.json({ tokens });
    } catch (error) {
      console.error('Error fetching tokens batch:', error);
      return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 });
    }
  }

  // Single token mode (legacy support)
  const index = searchParams.get('index');
  if (index === null) {
    return NextResponse.json({ error: 'Missing index or count' }, { status: 400 });
  }

  try {
    // Get the token ID at this index
    const tokenId = await client.readContract({
      address: CONTRACTS.woolf as `0x${string}`,
      abi: woolfAbi,
      functionName: 'tokenOfOwnerByIndex',
      args: [address as `0x${string}`, BigInt(index)],
    });

    // Get the token traits
    const traits = await client.readContract({
      address: CONTRACTS.woolf as `0x${string}`,
      abi: woolfAbi,
      functionName: 'getTokenTraits',
      args: [tokenId as bigint],
    });

    return NextResponse.json({
      tokenId: Number(tokenId),
      isSheep: (traits as { isSheep: boolean }).isSheep,
    });
  } catch (error: unknown) {
    // Index out of bounds is expected when balance is stale - return 404 silently
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('0xa57d13dc') || errorMessage.includes('out of bounds')) {
      return NextResponse.json({ error: 'Token not found at index' }, { status: 404 });
    }
    console.error('Error fetching token:', error);
    return NextResponse.json({ error: 'Failed to fetch token' }, { status: 500 });
  }
}
