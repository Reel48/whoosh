import { describe, it, expect } from "vitest";
import { creditLedger, getBalance } from "@/lib/wb/ledger";
import { transfer } from "@/lib/wb/transfer";
import { getTotalOutstanding } from "@/lib/wb/interest";
import { uid, fund, makeWallet } from "@/test/money";

describe("ledger idempotency", () => {
  it("credits a (refKind, refId) pair exactly once on replay", async () => {
    const u = uid("idem");
    const refId = uid("evt");
    const first = await creditLedger({
      discordUserId: u,
      discordUsername: u,
      amountCents: 500,
      kind: "purchase",
      refKind: "stripe_event",
      refId,
    });
    const second = await creditLedger({
      discordUserId: u,
      discordUsername: u,
      amountCents: 500,
      kind: "purchase",
      refKind: "stripe_event",
      refId,
    });

    expect(first).not.toBeNull(); // first insert returns a row id
    expect(second).toBeNull(); // duplicate ref is a no-op
    expect(await getBalance(u)).toBe(500); // credited once, not twice
  });
});

describe("conservation", () => {
  it("a transfer moves WB between wallets without changing total supply", async () => {
    const from = uid("from");
    const to = uid("to");
    await fund(from, 1000);
    await makeWallet(to); // recipient must exist before receiving

    const supplyBefore = await getTotalOutstanding();
    const res = await transfer(from, to, 300, "test transfer");

    expect(res.ok).toBe(true);
    expect(await getBalance(from)).toBe(700);
    expect(await getBalance(to)).toBe(300);
    // Sender debit + recipient credit net to zero across the whole ledger.
    expect(await getTotalOutstanding()).toBe(supplyBefore);
  });

  it("rejects an over-balance transfer and leaves both wallets untouched", async () => {
    const from = uid("of");
    const to = uid("ot");
    await fund(from, 250);
    await makeWallet(to);

    const res = await transfer(from, to, 1000, null);

    expect(res.ok).toBe(false);
    expect(await getBalance(from)).toBe(250);
    expect(await getBalance(to)).toBe(0);
  });
});
