# Wolf Game Development Changelog

## Session: Nov 29, 2025

### UI Improvements

#### Tax Breakdown Display
- Added pre-tax vs post-tax breakdown in claim confirmation dialog
- Shows: Pre-tax amount, Wolf tax (20%), Post-tax amount you receive
- Updated claim success popup to show tax paid to wolves

#### Pre-tax WOOL Display
- Changed sheep card earnings display from post-tax (80%) to pre-tax (100%)
- Updated total WOOL earned ticker to show pre-tax amount
- Rationale: Shows full earnings before wolf tax is applied

#### Unstake Result Popup
- Improved messaging for mixed results (some sheep stolen, some returned)
- Format: "X sheep were stolen by wolves. You lost all unclaimed WOOL from those sheep."
- Followed by: "Y tokens returned to your wallet."
- Removed duplicate status messages

#### Wolf Earnings Polling
- Added `refetchInterval: 30_000` to dynamic query options
- Wolf earnings now poll every 30 seconds for updates
- Previously only updated on manual refresh or user actions

### Indexer Fixes

#### Owner Tracking Bug Fix
- **Problem**: `sheepClaims` table recorded wrong owner address
- **Cause**: Used `event.transaction.from` which returns Pyth VRF relayer address, not the actual sheep owner
- **Solution**:
  1. Added `stakedTokens` table to track current ownership
  2. `TokenStaked` handler now inserts/upserts to `stakedTokens`
  3. `SheepClaimed` handler looks up owner from `stakedTokens` table

#### Schema Changes
```typescript
// Added to ponder.schema.ts
export const stakedTokens = onchainTable("staked_tokens", (t) => ({
  tokenId: t.integer().primaryKey(),
  owner: t.hex().notNull(),
  isSheep: t.boolean().notNull(),
  stakedAt: t.bigint().notNull(),
}));
```

### Files Modified

#### Web App
- `src/app/page.tsx` - Pre-tax display, unstake popup improvements
- `src/components/BarnSection.tsx` - Tax breakdown in dialogs
- `src/components/NFTCard.tsx` - Pre-tax earnings display
- `src/hooks/useBarn.ts` - Added refetchInterval for polling

#### Indexer
- `ponder.schema.ts` - Added stakedTokens table
- `src/index.ts` - Fixed owner tracking, added stakedTokens maintenance

### Key Learnings

1. **Pyth VRF Architecture**: VRF requests are fulfilled by a Pyth relayer contract, so `transaction.from` is the relayer, not the user who initiated the action.

2. **WOOL Distribution Mechanics**:
   - Claim: 80% to sheep, 20% to ALL wolves (proportional by Alpha)
   - Unstake success: 100% to sheep (no tax!)
   - Unstake stolen: WOOL goes to ALL wolves (not just the stealing wolf)
   - The wolf that steals the NFT is randomly selected (weighted by Alpha)

3. **Burning vs Distributing**:
   - WOOL spent on Gen 1 mints is burned (destroyed, reduces supply)
   - WOOL from sheep tax/steals is distributed to wolves (transferred)

4. **Multi-sheep Unstaking**: Each sheep gets independent 50% roll using unique seed: `keccak256(abi.encodePacked(seed, i))`

5. **wagmi Query Options**: `staleTime` only marks data as stale; need `refetchInterval` for automatic polling
