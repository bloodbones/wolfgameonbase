# Wolf Game FAQ

## WOOL Distribution

### How does the 20% wolf tax work?
When a Sheep claims WOOL, 20% is distributed to ALL staked Wolves proportionally based on their Alpha scores. It's not given to one specific wolf - all wolves share it.

### How are wolf earnings calculated?
Wolf earnings = `(currentWoolPerAlpha - stakedWoolPerAlpha) * alphaScore`

The contract maintains a `woolPerAlpha` accumulator that increases whenever tax comes in. Each wolf's share is based on their Alpha score (5-8).

### If my sheep gets stolen during unstaking, does the stealing wolf get my WOOL?
No. When a sheep is "stolen" (eaten):
- The **sheep NFT** goes to one random wolf (weighted by Alpha)
- The **accumulated WOOL** goes to ALL wolves (distributed via the tax pool)
- The wolf that steals the NFT is not necessarily the same wolves receiving the WOOL

### What happens to WOOL when it's "burned"?
When you spend WOOL to mint Gen 1 NFTs, the tokens are permanently destroyed:
- Your balance decreases
- Total supply decreases
- No one receives the tokens - they're gone

This is different from the wolf tax, where WOOL is transferred to wolves.

## Claiming vs Unstaking

### What's the difference between Claim and Unstake?
| | Claim | Unstake |
|--|-------|---------|
| WOOL | Get 80% (20% to wolves) | If successful: 100% (no tax!) |
| NFT | Stays staked | Returns to wallet |
| Risk | None | 50% chance sheep is stolen |

### If I successfully unstake, do I still pay the 20% tax?
No! Successful unstaking gives you 100% of accumulated WOOL with no tax. The tax only applies when claiming without unstaking.

### What happens if my sheep is stolen during unstaking?
You lose:
- The sheep NFT (goes to a wolf owner)
- ALL accumulated WOOL (goes to wolf tax pool)

## Multi-Token Operations

### What happens when I unstake multiple sheep at once?
Each sheep has its own independent 50% roll. If you unstake 4 sheep:
- Each gets a separate random check
- You could have any combination (0-4 stolen)
- Results shown in popup: "2 sheep stolen, 2 returned"

### Can I unstake sheep and wolves together?
Yes. Wolves always return safely (no steal risk). Only sheep have the 50% steal chance.

## Technical

### Why don't wolf earnings update in real-time like sheep?
- Sheep earnings tick up every second (calculated from stake timestamp)
- Wolf earnings only change when `woolPerAlpha` increases on-chain
- The UI polls every 30 seconds for updates
- After your own claim, it updates immediately

### What is the 2-day lock period?
After staking, you must wait 2 days before you can unstake. Claiming is always available.

### What are Alpha scores?
Wolves have Alpha values from 5-8:
- Alpha 8: Rarest, highest earnings share
- Alpha 5: Most common, lowest earnings share

Alpha determines:
1. Share of the 20% tax pool
2. Probability of stealing sheep/mints (weighted random)

## Contract Addresses (Base Sepolia)
- Woolf NFT: Check `contracts.ts`
- Barn (Staking): Check `contracts.ts`
- WOOL Token: Check `contracts.ts`
