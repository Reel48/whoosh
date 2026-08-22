import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import type { FantasyLeagueConfig } from "./leagues";

const listActiveLeagues = vi.fn<() => Promise<FantasyLeagueConfig[]>>();
vi.mock("./leagues", () => ({ listActiveLeagues: () => listActiveLeagues() }));
vi.mock("@/lib/supabase", () => ({ supabase: () => { throw new Error("not used"); } }));

const { listPoolOffers, getPoolInvites, readPoolSession, formatUsd, BUNDLE_OFFER } = await import(
  "./poolEntry"
);

function league(over: Partial<FantasyLeagueConfig>): FantasyLeagueConfig {
  return {
    sleeperLeagueId: "1",
    season: "2026",
    name: null,
    sort: 0,
    active: true,
    logoUrl: null,
    kind: "pickem",
    entryFeeCents: 1000,
    joinUrl: "https://sleeper.com/i/pickem",
    groupKey: "pickem",
    capacity: 1000,
    productName: "Whoosh Pick 'Em",
    ...over,
  };
}

const PICKEM = league({});
const SURVIVOR = league({
  sleeperLeagueId: "2",
  sort: 1,
  kind: "survivor",
  groupKey: "survivor",
  productName: "Whoosh Survivor",
  joinUrl: "https://sleeper.com/i/survivor",
});

beforeEach(() => listActiveLeagues.mockReset());

describe("listPoolOffers", () => {
  it("offers each pool plus a bundle covering both", async () => {
    listActiveLeagues.mockResolvedValue([PICKEM, SURVIVOR]);
    const offers = await listPoolOffers();
    expect(offers.map((o) => o.id)).toEqual(["pickem", "survivor", BUNDLE_OFFER]);
    expect(offers[0].priceCents).toBe(1000);
    const bundle = offers[2];
    expect(bundle.priceCents).toBe(2000);
    expect(bundle.groupKeys).toEqual(["pickem", "survivor"]);
    // $20 for two $10 entries isn't a discount — no strike-through price.
    expect(bundle.strikeCents).toBeNull();
  });

  it("skips H2H leagues and free/unpriced pools, and drops the lone bundle", async () => {
    listActiveLeagues.mockResolvedValue([
      PICKEM,
      league({ sleeperLeagueId: "3", kind: "standard", groupKey: "ppr", entryFeeCents: 2500 }),
      league({ sleeperLeagueId: "4", kind: "survivor", groupKey: "free", entryFeeCents: null }),
    ]);
    const offers = await listPoolOffers();
    expect(offers.map((o) => o.id)).toEqual(["pickem"]);
  });
});

describe("getPoolInvites", () => {
  it("returns the Sleeper invite for each purchased group in the paid season", async () => {
    listActiveLeagues.mockResolvedValue([PICKEM, SURVIVOR]);
    const invites = await getPoolInvites(["survivor"], "2026");
    expect(invites).toEqual([
      { name: "Whoosh Survivor", kind: "survivor", joinUrl: "https://sleeper.com/i/survivor" },
    ]);
  });

  it("never leaks an invite from another season", async () => {
    listActiveLeagues.mockResolvedValue([PICKEM, SURVIVOR]);
    expect(await getPoolInvites(["pickem"], "2025")).toEqual([]);
  });
});

describe("readPoolSession", () => {
  const paid = {
    metadata: { kind: "pool_entry", offer: "both", group_keys: "pickem,survivor", season: "2026" },
    customer_details: { email: "buyer@example.com" },
  } as unknown as Stripe.Checkout.Session;

  it("parses group keys, season and email", () => {
    expect(readPoolSession(paid)).toEqual({
      email: "buyer@example.com",
      offer: "both",
      groupKeys: ["pickem", "survivor"],
      season: "2026",
    });
  });

  it("ignores sessions from the other checkout flows", () => {
    const leagueEntry = {
      metadata: { kind: "league_entry", group_key: "ppr", season: "2026" },
    } as unknown as Stripe.Checkout.Session;
    expect(readPoolSession(leagueEntry)).toBeNull();
  });

  it("rejects a pool session missing its group keys or season", () => {
    const noGroups = {
      metadata: { kind: "pool_entry", group_keys: "", season: "2026" },
    } as unknown as Stripe.Checkout.Session;
    const noSeason = {
      metadata: { kind: "pool_entry", group_keys: "pickem" },
    } as unknown as Stripe.Checkout.Session;
    expect(readPoolSession(noGroups)).toBeNull();
    expect(readPoolSession(noSeason)).toBeNull();
  });
});

describe("formatUsd", () => {
  it("drops the decimals on whole dollars", () => {
    expect(formatUsd(1000)).toBe("$10");
    expect(formatUsd(2000)).toBe("$20");
    expect(formatUsd(1250)).toBe("$12.50");
  });
});
