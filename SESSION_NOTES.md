# Wolf Game Base - Session Notes

## Project Overview
Building a Wolf Game clone on Base Sepolia as a Farcaster Mini App.

## Current Status: DEPLOYED & MINTING WORKING
**Last updated:** Nov 27, 2025

### Completed
- [x] Foundry project setup with dependencies
- [x] `Wool.sol` - ERC20 token with controlled minting
- [x] `Woolf.sol` - Main ERC721 NFT contract with Chainlink VRF V2.5
- [x] `Barn.sol` - Staking contract with VRF for all randomness
- [x] `Traits.sol` - Full on-chain SVG generation (163 traits uploaded)
- [x] Interfaces: `IWoolf.sol`, `IBarn.sol`, `ITraits.sol`
- [x] All tests (62 tests passing)
- [x] Deployment scripts
- [x] Deployed to Base Sepolia
- [x] Traits uploaded from original Wolf Game
- [x] First NFT minted successfully (Sheep #1)

### Pending
- [ ] Test staking in Barn contract
- [ ] Test unstaking with VRF
- [ ] Next.js frontend (Farcaster Mini App)
- [ ] Wagmi/contract hooks
- [ ] UI pages

---

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| Wool | `0x8062741f9634B83BD35976Ff07B6238eFc01503B` |
| Traits | `0x6CB7Ac725369023079b89beb753e1afe05C9bced` |
| Woolf | `0xf642AfB273FE73D8B0ED291469E248638b75258d` |
| Barn | `0x308D0d1F2737ae8f5272F9b20d45544859EB1751` |

**VRF Subscription ID:** `4575999402920596535752346196544795076338835071088402032750243681588020164899`

---

## First Mint Result

Successfully minted **Sheep #1** with traits:
- Fur: Black
- Head: White Cap
- Ears: None
- Eyes: Cyclops
- Nose: Dot
- Mouth: Narrow Open Mouth
- Feet: None

The NFT has fully on-chain metadata and SVG image.

---

## Project Structure
```
/home/czar/coding/wolfgame/contracts/
├── src/
│   ├── Wool.sol              ✅ ERC20 game currency
│   ├── Woolf.sol             ✅ Main NFT contract (VRF minting)
│   ├── Barn.sol              ✅ Staking contract (VRF unstaking)
│   ├── Traits.sol            ✅ Full on-chain SVG (163 traits)
│   └── interfaces/
│       ├── IWoolf.sol        ✅ NFT interface
│       ├── IBarn.sol         ✅ Staking interface
│       └── ITraits.sol       ✅ Metadata interface
├── test/
│   ├── Wool.t.sol            ✅ 14 tests
│   ├── Woolf.t.sol           ✅ 20 tests
│   ├── Barn.t.sol            ✅ 17 tests
│   └── Traits.t.sol          ✅ 11 tests
├── script/
│   ├── Deploy.s.sol          ✅ Main deployment
│   ├── UploadAllTraits.s.sol ✅ Upload 163 traits
│   ├── RedeployWoolf.s.sol   ✅ Redeploy Woolf only
│   ├── RedeployBarn.s.sol    ✅ Redeploy Barn only
│   └── ExtractTraits.js      ✅ Extract traits from mainnet
├── lib/
│   ├── forge-std/
│   ├── openzeppelin-contracts/
│   └── chainlink-brownie-contracts/
├── foundry.toml              ✅ Optimized for deployment
└── .env                      ✅ Private key (gitignored)
```

---

## Contract Architecture

```
┌──────────────┐     mints     ┌──────────────┐
│   Woolf.sol  │◄─────────────►│   Wool.sol   │
│  (ERC721)    │               │   (ERC20)    │
│              │     burns     │              │
└──────┬───────┘               └──────┬───────┘
       │                              │
       │ queries traits               │ mints rewards
       │ transfers NFTs               │
       │                              │
       ▼                              ▼
┌──────────────┐     taxes     ┌──────────────┐
│  Barn.sol    │◄─────────────►│   Wolves     │
│  (Staking)   │               │   (Pack)     │
│              │               │              │
└──────────────┘               └──────────────┘
       │
       │ tokenURI()
       ▼
┌──────────────┐
│  Traits.sol  │
│  (SVG Gen)   │
└──────────────┘
```

---

## Key Technical Decisions

| Aspect | Choice | Why |
|--------|--------|-----|
| Network | Base Sepolia | Low fees, fast finality |
| Randomness | Chainlink VRF V2.5 | Secure, unpredictable - original used weak blockhash |
| NFT Art | On-chain SVG | Fully decentralized, no IPFS dependency |
| Frontend | Farcaster Mini App | Social distribution |
| Framework | Foundry | Fast compilation, good testing |

---

## Contracts Summary

### Wool.sol
Simple ERC20 token:
- Only "controllers" (Barn, Woolf contracts) can mint/burn
- Used for Gen 1+ minting and staking rewards
- Adapted from original - nearly identical

### Woolf.sol (Main NFT)
Adapted from original Wolf Game with VRF added:
- **Gen 0**: 10,000 NFTs @ 0.001 ETH each
- **Gen 1+**: 40,000 NFTs paid with WOOL (tiered: 20k/40k/80k WOOL)
- **90% sheep / 10% wolf** probability
- **10% steal chance** - wolves can steal newly minted Gen 1+ NFTs
- **Chainlink VRF V2.5** for mint randomness (2-step: request then callback)
- **Walker's Alias Algorithm** for O(1) trait selection
- Traits: fur, head, ears, eyes, nose, mouth, neck, feet, alpha

### Barn.sol (Staking)
Adapted from original Wolf Game with VRF added:
- **Sheep staking**: Earn 10,000 WOOL/day
- **Wolf staking**: Earn from 20% tax pool (weighted by alpha 5-8)
- **20% tax**: All sheep claims taxed, distributed to wolves
- **50% unstake risk**: Sheep may be eaten (VRF determines outcome)
- **2-day lockup**: Minimum stake period before unstaking
- **2.4B WOOL cap**: Game has finite WOOL supply
- **Chainlink VRF V2.5** for unstaking randomness (prevents gaming the 50/50)

### Traits.sol
Full on-chain SVG generation:
- 163 traits uploaded from original Wolf Game
- Generates pixel art SVG for each NFT
- Returns base64-encoded data URI
- Trait types: Sheep (Fur, Head, Ears, Eyes, Nose, Mouth, Feet), Wolf (Fur, Head, Eyes, Mouth, Neck, Alpha)

---

## VRF Integration Points

**Both Woolf.sol and Barn.sol use VRF:**

1. **Woolf.sol - Minting**
   - User calls `mint(amount, stake)`
   - Contract requests VRF random number
   - Chainlink calls `fulfillRandomWords()` with result
   - Contract generates traits and mints NFTs
   - Prevents: Predicting sheep vs wolf, gaming trait rolls

2. **Barn.sol - Unstaking**
   - User calls `unstakeMany(tokenIds)`
   - If sheep present, contract requests VRF
   - Chainlink calls `fulfillRandomWords()` with result
   - Contract determines which sheep survive the 50/50
   - Prevents: Simulating tx to only unstake on favorable outcomes

---

## Chainlink VRF V2.5 Configuration (Base Sepolia)

```solidity
VRF_COORDINATOR = 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE
KEY_HASH = 0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71
LINK_TOKEN = 0xE4aB69C077896252FAFBD49EFD26B5D171A32410
CALLBACK_GAS_LIMIT = 2500000
REQUEST_CONFIRMATIONS = 3
SUBSCRIPTION_ID = 4575999402920596535752346196544795076338835071088402032750243681588020164899
```

**Important VRF Setup Steps:**
1. Go to https://vrf.chain.link and select Base Sepolia
2. Create a subscription
3. **Fund the SUBSCRIPTION with LINK** (not your wallet - this was a key learning)
4. Add both Woolf and Barn contract addresses as consumers
5. Get LINK from https://faucets.chain.link/base-sepolia

---

## Differences from Original Wolf Game

| Aspect | Original | Our Version |
|--------|----------|-------------|
| Randomness (mint) | `blockhash` | Chainlink VRF |
| Randomness (unstake) | `blockhash` | Chainlink VRF |
| Minting flow | Synchronous | Async (VRF callback) |
| Solidity version | 0.8.0 | 0.8.24 |
| OpenZeppelin | v4.x | v5.x |
| Network | Ethereum | Base |
| Ownership | OZ Ownable | VRF's ConfirmedOwner |

---

## Key Learnings

### 1. Contract Size Limit (24KB)
**Problem:** Woolf.sol exceeded 24KB limit (was 25,285 bytes)
**Solution:** Enable optimizer in foundry.toml:
```toml
optimizer = true
optimizer_runs = 200
via_ir = true
```
**Result:** Reduced to 11,774 bytes

### 2. VRF Subscription Funding
**Problem:** VRF callbacks weren't happening
**Root cause:** Only funded deployer wallet, not the VRF subscription
**Solution:** Fund the VRF subscription itself with LINK tokens at vrf.chain.link
**Learning:** VRF uses subscription model - the subscription pays for callbacks, not your wallet

### 3. _selectRecipient Bug Fix
**Problem:** Original code used `msg.sender` in VRF callback to determine steal recipient
**Root cause:** During VRF callback, `msg.sender` is the VRF coordinator, not the minter
**Solution:** Pass minter address as parameter and store in pending mint request

### 4. Trait IDs Are Non-Sequential
**Problem:** Initial trait upload script used sequential IDs (0,1,2,3...)
**Root cause:** Original Wolf Game uses non-sequential IDs (e.g., Sheep Eyes: 2,4,6,7,8,9,10...)
**Solution:** Extract exact trait IDs from mainnet and use those in upload script

### 5. Contract Redeployment
**Problem:** Barn had wrong Woolf address after Woolf was redeployed
**Root cause:** No `setWoolf()` function in Barn contract
**Solution:** Redeploy Barn with new Woolf address (testnet so cost isn't an issue)

### 6. Adding VRF Consumers
**Important:** After deploying contracts, must add them as consumers in VRF subscription dashboard at vrf.chain.link

---

## Test Results

All 62 tests passing:
- **Wool.t.sol**: 14 tests (controller permissions, mint/burn)
- **Woolf.t.sol**: 20 tests (minting, VRF callback, traits, steal mechanic)
- **Barn.t.sol**: 17 tests (staking, unstaking, VRF, claiming, taxes)
- **Traits.t.sol**: 11 tests (SVG generation, trait uploads)

---

## Commands Reference

```bash
# Compile contracts
~/.foundry/bin/forge build

# Run tests
~/.foundry/bin/forge test

# Run tests with verbosity
~/.foundry/bin/forge test -vvv

# Deploy all contracts
source .env && ~/.foundry/bin/forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast

# Upload traits
source .env && ~/.foundry/bin/forge script script/UploadAllTraits.s.sol --rpc-url base_sepolia --broadcast

# Redeploy single contract
source .env && ~/.foundry/bin/forge script script/RedeployWoolf.s.sol --rpc-url base_sepolia --broadcast
source .env && ~/.foundry/bin/forge script script/RedeployBarn.s.sol --rpc-url base_sepolia --broadcast
```

---

## Next Steps

### Immediate
1. **Test staking** - Stake Sheep #1 in the Barn
2. **Test claiming** - Wait and claim WOOL rewards
3. **Test unstaking** - Test the 50% risk mechanic with VRF

### Frontend Development
1. **Create Next.js app** - Reference `/home/czar/coding/fctimes4/web/`
2. **Wagmi hooks** - Connect to deployed contracts
3. **UI pages**:
   - Mint page (mint sheep/wolves)
   - Barn page (stake/unstake/claim)
   - Gallery page (view owned NFTs)
4. **Farcaster Mini App** - Frame integration

### Optional Improvements
1. More robust error handling in contracts
2. Events for better frontend indexing
3. Admin functions for emergency pause

---

## Reference Files

- **fctimes4 Mini App patterns:** `/home/czar/coding/fctimes4/web/`
- **Original Wolf Game contracts:** https://github.com/Golden-Lighting-Star/Wolf_Game

---

## Environment Setup

**.env file (gitignored):**
```
PRIVATE_KEY=your_private_key_here
```

**Required for deployment:**
- Base Sepolia ETH (for gas)
- LINK tokens (for VRF subscription funding)

---

## To Resume Session

Just tell Claude:
> "Continue building Wolf Game Base. Read SESSION_NOTES.md for context."
