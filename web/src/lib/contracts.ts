import { baseSepolia } from 'wagmi/chains';

// Contract addresses on Base Sepolia (SheepStolen event deployment - Dec 6, 2025)
export const CONTRACTS = {
  wool: '0xe3DbA8DB9BD0794067E6f8069f489A6ca23Ea492',
  traits: '0x6CB7Ac725369023079b89beb753e1afe05C9bced',
  woolf: '0x916A56f76EC06565E0EB55720b9DAE85aE033937',
  barn: '0x6C19CDba7402d644D728310b1A5825C96Be0519F',
} as const;

export const CHAIN_ID = baseSepolia.id;

// Woolf NFT ABI - functions we need for minting and viewing NFTs
export const woolfAbi = [
  // Read functions
  { type: 'function', name: 'minted', inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view' },
  { type: 'function', name: 'PAID_TOKENS', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'MINT_PRICE', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'MAX_TOKENS', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'maxGen0PerWallet', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'gen0MintCount', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'tokenOfOwnerByIndex', inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'tokenURI', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'ownerOf', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'isApprovedForAll', inputs: [{ name: 'owner', type: 'address' }, { name: 'operator', type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  {
    type: 'function',
    name: 'getTokenTraits',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'isSheep', type: 'bool' },
        { name: 'fur', type: 'uint8' },
        { name: 'head', type: 'uint8' },
        { name: 'ears', type: 'uint8' },
        { name: 'eyes', type: 'uint8' },
        { name: 'nose', type: 'uint8' },
        { name: 'mouth', type: 'uint8' },
        { name: 'neck', type: 'uint8' },
        { name: 'feet', type: 'uint8' },
        { name: 'alphaIndex', type: 'uint8' },
      ]
    }],
    stateMutability: 'view'
  },
  // Write functions
  { type: 'function', name: 'mint', inputs: [{ name: 'amount', type: 'uint256' }, { name: 'stake', type: 'bool' }], outputs: [], stateMutability: 'payable' },
  { type: 'function', name: 'setApprovalForAll', inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [], stateMutability: 'nonpayable' },
  // Events
  { type: 'event', name: 'MintRequested', inputs: [{ name: 'requestId', type: 'uint256', indexed: true }, { name: 'minter', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }, { name: 'stake', type: 'bool', indexed: false }] },
  { type: 'event', name: 'MintFulfilled', inputs: [{ name: 'requestId', type: 'uint256', indexed: true }, { name: 'minter', type: 'address', indexed: true }, { name: 'tokenIds', type: 'uint256[]', indexed: false }] },
  { type: 'event', name: 'Transfer', inputs: [{ name: 'from', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }, { name: 'tokenId', type: 'uint256', indexed: true }] },
] as const;

// Barn staking ABI - functions for staking, unstaking, and claiming WOOL
export const barnAbi = [
  // Read functions
  { type: 'function', name: 'totalSheepStaked', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalAlphaStaked', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalWoolEarned', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'woolPerAlpha', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'dailyWoolRate', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'minimumToExit', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'woolClaimTaxPercentage', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'sheepStealChance', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'pendingWool', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getStakedTokens', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint16[]' }], stateMutability: 'view' },
  { type: 'function', name: 'getStakedTokenCount', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  {
    type: 'function',
    name: 'barn',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'tokenId', type: 'uint16' },
      { name: 'value', type: 'uint80' },
      { name: 'owner', type: 'address' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'pack',
    inputs: [{ name: 'alpha', type: 'uint256' }, { name: 'index', type: 'uint256' }],
    outputs: [
      { name: 'tokenId', type: 'uint16' },
      { name: 'value', type: 'uint80' },
      { name: 'owner', type: 'address' }
    ],
    stateMutability: 'view'
  },
  { type: 'function', name: 'packIndices', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  // Read functions for rescue
  { type: 'function', name: 'rescueEnabled', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  // Write functions
  { type: 'function', name: 'addManyToBarnAndPack', inputs: [{ name: 'account', type: 'address' }, { name: 'tokenIds', type: 'uint16[]' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'claimMany', inputs: [{ name: 'tokenIds', type: 'uint16[]' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'unstakeMany', inputs: [{ name: 'tokenIds', type: 'uint16[]' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'rescue', inputs: [{ name: 'tokenIds', type: 'uint256[]' }], outputs: [], stateMutability: 'nonpayable' },
  // Events
  { type: 'event', name: 'TokenStaked', inputs: [{ name: 'owner', type: 'address', indexed: true }, { name: 'tokenId', type: 'uint256', indexed: true }, { name: 'value', type: 'uint256', indexed: false }] },
  { type: 'event', name: 'SheepClaimed', inputs: [{ name: 'tokenId', type: 'uint256', indexed: true }, { name: 'earned', type: 'uint256', indexed: false }, { name: 'unstaked', type: 'bool', indexed: false }, { name: 'eaten', type: 'bool', indexed: false }] },
  { type: 'event', name: 'WolfClaimed', inputs: [{ name: 'tokenId', type: 'uint256', indexed: true }, { name: 'earned', type: 'uint256', indexed: false }, { name: 'unstaked', type: 'bool', indexed: false }] },
  { type: 'event', name: 'SheepStolen', inputs: [{ name: 'tokenId', type: 'uint256', indexed: true }, { name: 'from', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }] },
] as const;

// WOOL token ABI - just need balanceOf for display
export const woolAbi = [
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
] as const;

// Types for token traits
export interface TokenTraits {
  isSheep: boolean;
  fur: number;
  head: number;
  ears: number;
  eyes: number;
  nose: number;
  mouth: number;
  neck: number;
  feet: number;
  alphaIndex: number;
}

// Type for staked token info
export interface StakeInfo {
  tokenId: number;
  value: bigint; // timestamp when staked (for sheep) or woolPerAlpha when staked (for wolf)
  owner: string;
}
