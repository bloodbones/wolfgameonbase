import { ponder } from "ponder:registry";
import { steals, sheepClaims, stakes, mints, stakedTokens } from "ponder:schema";
import { eq } from "ponder";

// Web app URL for notifications (use ngrok URL in dev)
const WEB_APP_URL = process.env.WEB_APP_URL || "http://localhost:3001";

/**
 * Send notification to wolf owner when they steal a sheep
 */
async function notifyWolfSteal(
  wolfOwnerWallet: string,
  stolenTokenId: number,
  eventType: "unstake" | "mint"
) {
  try {
    const response = await fetch(`${WEB_APP_URL}/api/notify-steal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wolfOwnerWallet,
        stolenTokenId,
        eventType,
      }),
    });

    if (response.ok) {
      console.log(`[Notify] Sent ${eventType} steal notification for token #${stolenTokenId}`);
    } else {
      console.error(`[Notify] Failed to send notification:`, await response.text());
    }
  } catch (error) {
    console.error(`[Notify] Error sending notification:`, error);
  }
}

// Handle when sheep are claimed (with potential steal)
ponder.on("Barn:SheepClaimed", async ({ event, context }) => {
  const { db } = context;
  const { tokenId, earned, unstaked, eaten } = event.args;

  // Look up the actual owner from our staked tokens table
  const stakedToken = await db.find(stakedTokens, { tokenId: Number(tokenId) });
  const owner = stakedToken?.owner ?? event.transaction.from;

  // Record the sheep claim
  await db.insert(sheepClaims).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    tokenId: Number(tokenId),
    owner: owner,
    woolEarned: earned,
    wasEaten: eaten,
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
  });

  // If unstaked (whether eaten or not), remove from staked tokens
  if (unstaked) {
    await db.delete(stakedTokens, { tokenId: Number(tokenId) });
  }
});

// Handle sheep stolen during unstaking (new event from Barn contract)
ponder.on("Barn:SheepStolen", async ({ event, context }) => {
  const { db } = context;
  const { tokenId, from, to } = event.args;

  console.log(`[Steal] Sheep #${tokenId} stolen from ${from} to wolf owner ${to}`);

  // Record the steal
  await db.insert(steals).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    sheepTokenId: Number(tokenId),
    wolfOwner: to,
    previousOwner: from,
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
  });

  // Send notification to the wolf owner
  await notifyWolfSteal(to, Number(tokenId), "unstake");
});

// Handle when tokens are staked
ponder.on("Barn:TokenStaked", async ({ event, context }) => {
  const { db } = context;
  const { owner, tokenId } = event.args;

  // Record the stake event in history
  await db.insert(stakes).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    tokenId: Number(tokenId),
    owner: owner,
    isSheep: true, // Default to sheep - wolf claims tracked separately
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
  });

  // Update current staked tokens table (upsert in case of re-stake)
  await db
    .insert(stakedTokens)
    .values({
      tokenId: Number(tokenId),
      owner: owner,
      isSheep: true, // Default to sheep
      stakedAt: event.block.timestamp,
    })
    .onConflictDoUpdate({
      owner: owner,
      stakedAt: event.block.timestamp,
    });
});

// Handle mint completions
ponder.on("Woolf:MintFulfilled", async ({ event, context }) => {
  const { db } = context;
  const { minter, tokenIds } = event.args;

  // Record each minted token
  for (let i = 0; i < tokenIds.length; i++) {
    const tokenId = tokenIds[i];

    // For now, mark as sheep - we can enhance this later with contract reads
    await db.insert(mints).values({
      id: `${event.transaction.hash}-${event.log.logIndex}-${i}`,
      tokenId: Number(tokenId),
      owner: minter,
      isSheep: true, // Default to sheep
      txHash: event.transaction.hash,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
    });
  }
});

// Handle token steals (when a newly minted token goes to a wolf owner instead of minter)
ponder.on("Woolf:TokenStolen", async ({ event, context }) => {
  const { db } = context;
  const { tokenId, from, to } = event.args;

  // Record the steal
  await db.insert(steals).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    sheepTokenId: Number(tokenId),
    wolfOwner: to,
    previousOwner: from,
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
  });

  // Send notification to the wolf owner who stole the mint
  await notifyWolfSteal(to, Number(tokenId), "mint");
});

// Handle wolf claims
ponder.on("Barn:WolfClaimed", async ({ event, context }) => {
  // We could track wolf claims too if needed
  // For now, we're focused on sheep steals
  console.log(`Wolf ${event.args.tokenId} claimed ${event.args.earned} WOOL`);
});
