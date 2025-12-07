import { createConfig } from "ponder";

// Contract addresses (Base Sepolia - SheepStolen event deployment Dec 6, 2025)
const BARN_ADDRESS = "0x6C19CDba7402d644D728310b1A5825C96Be0519F" as const;
const WOOLF_ADDRESS = "0x916A56f76EC06565E0EB55720b9DAE85aE033937" as const;

// Deployment block (new Barn deployment)
const START_BLOCK = 34642119;

// Barn ABI - only the events we need
const BarnAbi = [
  {
    type: "event",
    name: "SheepClaimed",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "earned", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "unstaked", type: "bool", indexed: false, internalType: "bool" },
      { name: "eaten", type: "bool", indexed: false, internalType: "bool" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "WolfClaimed",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "earned", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "unstaked", type: "bool", indexed: false, internalType: "bool" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TokenStaked",
    inputs: [
      { name: "owner", type: "address", indexed: true, internalType: "address" },
      { name: "tokenId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "value", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SheepStolen",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "from", type: "address", indexed: true, internalType: "address" },
      { name: "to", type: "address", indexed: true, internalType: "address" },
    ],
    anonymous: false,
  },
] as const;

// Woolf ABI - only the events we need
const WoolfAbi = [
  {
    type: "event",
    name: "MintFulfilled",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "minter", type: "address", indexed: true, internalType: "address" },
      { name: "tokenIds", type: "uint256[]", indexed: false, internalType: "uint256[]" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TokenStolen",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "from", type: "address", indexed: true, internalType: "address" },
      { name: "to", type: "address", indexed: true, internalType: "address" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true, internalType: "address" },
      { name: "to", type: "address", indexed: true, internalType: "address" },
      { name: "tokenId", type: "uint256", indexed: true, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "getTokenTraits",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        type: "tuple",
        internalType: "struct IWoolf.SheepWolf",
        components: [
          { name: "isSheep", type: "bool", internalType: "bool" },
          { name: "fur", type: "uint8", internalType: "uint8" },
          { name: "head", type: "uint8", internalType: "uint8" },
          { name: "ears", type: "uint8", internalType: "uint8" },
          { name: "eyes", type: "uint8", internalType: "uint8" },
          { name: "nose", type: "uint8", internalType: "uint8" },
          { name: "mouth", type: "uint8", internalType: "uint8" },
          { name: "neck", type: "uint8", internalType: "uint8" },
          { name: "feet", type: "uint8", internalType: "uint8" },
          { name: "alphaIndex", type: "uint8", internalType: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

export default createConfig({
  chains: {
    baseSepolia: {
      id: 84532,
      rpc: process.env.PONDER_RPC_URL_84532 ?? "https://sepolia.base.org",
    },
  },
  contracts: {
    Barn: {
      abi: BarnAbi,
      chain: "baseSepolia",
      address: BARN_ADDRESS,
      startBlock: START_BLOCK,
    },
    Woolf: {
      abi: WoolfAbi,
      chain: "baseSepolia",
      address: WOOLF_ADDRESS,
      startBlock: START_BLOCK,
    },
  },
});
