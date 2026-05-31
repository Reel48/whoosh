import { describe, it, expect } from "vitest";
import { placeOrder, getPositions } from "@/lib/wb/invest";
import { getBalance } from "@/lib/wb/ledger";
import { uid, fund } from "@/test/money";

describe("investing", () => {
  it("rejects a buy that exceeds the balance and leaves funds untouched", async () => {
    const u = uid("buy-poor");
    await fund(u, 1000); // $10 WB
    const res = await placeOrder(u, "AAPL", "buy", 1, 5000); // 1 share @ $50 = 5000c

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("Insufficient funds.");
    expect(await getBalance(u)).toBe(1000); // unchanged
    expect(await getPositions(u)).toHaveLength(0);
  });

  it("a buy debits shares*price and records the position; a full sell unwinds it", async () => {
    const u = uid("trader");
    await fund(u, 100_000); // $1000 WB

    const buy = await placeOrder(u, "AAPL", "buy", 2, 10_000); // 2 @ $100 = 20000c
    expect(buy.ok).toBe(true);
    expect(await getBalance(u)).toBe(80_000);
    const pos = await getPositions(u);
    expect(pos.find((p) => p.symbol === "AAPL")?.shares).toBe(2);

    // Sell both shares at the same price → proceeds 20000c back, position gone.
    const sell = await placeOrder(u, "AAPL", "sell", 2, 10_000);
    expect(sell.ok).toBe(true);
    expect(await getBalance(u)).toBe(100_000);
    expect((await getPositions(u)).find((p) => p.symbol === "AAPL")).toBeUndefined();
  });

  it("rejects selling more shares than held", async () => {
    const u = uid("oversell");
    await fund(u, 100_000);
    await placeOrder(u, "MSFT", "buy", 1, 10_000);

    const res = await placeOrder(u, "MSFT", "sell", 5, 10_000);
    expect(res.ok).toBe(false);
  });
});
