import { creditLedger, ensureWallet } from "@/lib/wb/ledger";

let seq = 0;

/**
 * A process-unique id. Tests use fresh wallet/event ids instead of truncating
 * shared tables, so they stay isolated and can assert on per-user balances and
 * supply deltas regardless of any other data in the local DB.
 */
export function uid(tag = "u"): string {
  return `itest-${tag}-${process.pid}-${Date.now().toString(36)}-${seq++}`;
}

/** Give a wallet `cents` of WB (creates the wallet first). */
export async function fund(userId: string, cents: number): Promise<void> {
  await creditLedger({
    discordUserId: userId,
    discordUsername: userId,
    amountCents: cents,
    kind: "adjustment",
    memo: "itest funding",
  });
}

/** Ensure a (possibly recipient) wallet row exists without crediting it. */
export async function makeWallet(userId: string): Promise<void> {
  await ensureWallet(userId, userId);
}
