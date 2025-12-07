import { Hono } from "hono";
import { db } from "ponder:api";
import { steals, sheepClaims, stakes, mints } from "ponder:schema";
import { desc } from "ponder";

const app = new Hono();

// Helper to convert BigInt to string for JSON serialization
function serializeData<T>(data: T[]): T[] {
  return JSON.parse(JSON.stringify(data, (_, v) =>
    typeof v === "bigint" ? v.toString() : v
  ));
}

// Get all steals
app.get("/steals", async (c) => {
  const data = await db.select().from(steals).orderBy(desc(steals.timestamp));
  return c.json(serializeData(data));
});

// Get steals for a specific wolf owner
app.get("/steals/:wolfOwner", async (c) => {
  const wolfOwner = c.req.param("wolfOwner");
  const data = await db.select().from(steals).orderBy(desc(steals.timestamp));
  const filtered = data.filter(s => s.wolfOwner.toLowerCase() === wolfOwner.toLowerCase());
  return c.json(serializeData(filtered));
});

// Get sheep claims
app.get("/sheep-claims", async (c) => {
  const data = await db.select().from(sheepClaims).orderBy(desc(sheepClaims.timestamp));
  return c.json(serializeData(data));
});

// Get all stakes
app.get("/stakes", async (c) => {
  const data = await db.select().from(stakes).orderBy(desc(stakes.timestamp));
  return c.json(serializeData(data));
});

// Get all mints
app.get("/mints", async (c) => {
  const data = await db.select().from(mints).orderBy(desc(mints.timestamp));
  return c.json(serializeData(data));
});

// Get recent activity (last 100 events across all tables)
app.get("/activity", async (c) => {
  const [recentSteals, recentClaims, recentStakes, recentMints] = await Promise.all([
    db.select().from(steals).orderBy(desc(steals.timestamp)).limit(25),
    db.select().from(sheepClaims).orderBy(desc(sheepClaims.timestamp)).limit(25),
    db.select().from(stakes).orderBy(desc(stakes.timestamp)).limit(25),
    db.select().from(mints).orderBy(desc(mints.timestamp)).limit(25),
  ]);

  return c.json({
    steals: serializeData(recentSteals),
    claims: serializeData(recentClaims),
    stakes: serializeData(recentStakes),
    mints: serializeData(recentMints),
  });
});

export default app;
