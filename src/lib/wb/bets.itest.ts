import { describe, it, expect } from "vitest";
import { createEvent, getEvent, placeWager, settleEvent } from "@/lib/wb/bets";
import { getBalance } from "@/lib/wb/ledger";
import { uid, fund } from "@/test/money";

async function twoOutcomeEvent(): Promise<{ eventId: number; home: number; away: number }> {
  const eventId = await createEvent({
    title: uid("game"),
    description: null,
    closesAt: null,
    createdBy: null,
    outcomes: [
      { label: "Home", oddsDecimal: 2.0 },
      { label: "Away", oddsDecimal: 1.5 },
    ],
  });
  const ev = await getEvent(eventId);
  if (!ev) throw new Error("event not found after create");
  const home = ev.outcomes.find((o) => o.label === "Home")!.id;
  const away = ev.outcomes.find((o) => o.label === "Away")!.id;
  return { eventId, home, away };
}

describe("betting settlement", () => {
  it("pays winners floor(stake * frozen odds) and nothing to losers", async () => {
    const winner = uid("win");
    const loser = uid("lose");
    await fund(winner, 10_000);
    await fund(loser, 10_000);
    const { eventId, home, away } = await twoOutcomeEvent();

    expect((await placeWager(winner, eventId, home, 1000)).ok).toBe(true);
    expect((await placeWager(loser, eventId, away, 1000)).ok).toBe(true);
    // Both stakes are now escrowed out of cash.
    expect(await getBalance(winner)).toBe(9000);
    expect(await getBalance(loser)).toBe(9000);

    const settled = await settleEvent(eventId, home);
    expect(settled).toBe(1); // one winning wager paid

    // Winner: 9000 + floor(1000 * 2.0) = 11000. Loser keeps their post-stake 9000.
    expect(await getBalance(winner)).toBe(11_000);
    expect(await getBalance(loser)).toBe(9000);
  });

  it("is idempotent — re-settling the same event does not double-pay", async () => {
    const u = uid("win2");
    await fund(u, 10_000);
    const { eventId, home } = await twoOutcomeEvent();
    await placeWager(u, eventId, home, 1000);

    await settleEvent(eventId, home);
    const afterFirst = await getBalance(u);
    await settleEvent(eventId, home); // replay
    expect(await getBalance(u)).toBe(afterFirst); // 11000, paid once
  });

  it("rejects a wager that exceeds the bettor's balance", async () => {
    const u = uid("broke");
    await fund(u, 500);
    const { eventId, home } = await twoOutcomeEvent();

    const res = await placeWager(u, eventId, home, 1000);
    expect(res.ok).toBe(false);
    expect(await getBalance(u)).toBe(500);
  });
});
