import { describe, it, expect } from "vitest";
import { postDividend } from "@/lib/wb/dividend";
import { placeOrder } from "@/lib/wb/invest";
import { getBalance } from "@/lib/wb/ledger";
import { uid, fund } from "@/test/money";

describe("dividends", () => {
  it("credits each holder floor(shares * wb_cents_per_share)", async () => {
    const u = uid("holder");
    // Unique symbol so only this test's holder is affected by the dividend.
    const symbol = `DIV${process.pid}${Date.now().toString(36)}`.toUpperCase();
    await fund(u, 100_000); // $1000 WB

    expect((await placeOrder(u, symbol, "buy", 3, 10_000)).ok).toBe(true); // 3 @ $100
    const afterBuy = await getBalance(u); // 100000 - 30000 = 70000

    // $0.50/share → 50 WB cents/share; 3 shares → floor(3 * 50) = 150.
    const res = await postDividend({
      symbol,
      exDate: "2026-01-15",
      usdPerShare: 0.5,
      source: "admin_manual",
    });
    expect(res.alreadyPosted).toBe(false);
    expect(res.usersCredited).toBe(1);
    expect(await getBalance(u)).toBe(afterBuy + 150);
  });

  it("is idempotent for the same (symbol, exDate)", async () => {
    const u = uid("holder2");
    const symbol = `DVI${process.pid}${Date.now().toString(36)}`.toUpperCase();
    await fund(u, 100_000);
    await placeOrder(u, symbol, "buy", 1, 10_000);

    const first = await postDividend({ symbol, exDate: "2026-02-01", usdPerShare: 1, source: "admin_manual" });
    const balAfterFirst = await getBalance(u);
    const second = await postDividend({ symbol, exDate: "2026-02-01", usdPerShare: 1, source: "admin_manual" });

    expect(first.alreadyPosted).toBe(false);
    expect(second.alreadyPosted).toBe(true); // skipped — logged once
    expect(await getBalance(u)).toBe(balAfterFirst); // not paid twice
  });
});
