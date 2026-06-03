import { creditLedger, type LedgerKind } from "@/lib/wb/ledger";
import type { CreditResult } from "@/lib/wb/stripeCredits";

/**
 * Apple In-App Purchase crediting — the iOS twin of the Stripe adapters in
 * `stripeCredits.ts`. On iOS, Whoosh Bucks and subscriptions must be sold via
 * IAP (App Store Guideline 3.1.1), not Stripe. This module credits WB from a
 * *verified* App Store transaction, reusing the same provider-agnostic core
 * (`creditLedger`) and the same `(refKind, refId)` idempotency the Stripe path
 * relies on — so replays credit once and web/iOS share one money engine.
 *
 * SCAFFOLD: signature verification (the JWS chain + App Store Server API) is not
 * implemented until App Store Connect is set up — see {@link verifySignedPayload}
 * and the `TODO(apple-setup)` markers. The crediting logic and idempotency are
 * real and unit-tested; only the "is this transaction genuine?" step is stubbed.
 */

/** Ledger source tag for IAP credits — the Apple analogue of "stripe_checkout". */
export const APPLE_IAP_REF_KIND = "apple_iap";

type AppleProduct = {
  kind: Extract<LedgerKind, "purchase" | "fantasy_match">;
  /** WB credited for this product, in cents. */
  wbCents: number;
  memo: string;
};

/**
 * App Store product id → what it credits. Mirrors the Stripe WB-per-USD rates so
 * web and iOS credit identical amounts for the equivalent purchase.
 * TODO(apple-setup): finalize ids + amounts against the App Store Connect catalog.
 */
const APPLE_PRODUCTS: Record<string, AppleProduct> = {
  // Example shape — replace with real product ids once they exist:
  // "com.whoosh.wb.1000": { kind: "purchase", wbCents: 1_000_00, memo: "Bought $1,000 of Whoosh Bucks" },
};

/** A verified, decoded App Store transaction, reduced to what crediting needs. */
export type AppleTransaction = {
  transactionId: string;
  productId: string;
  /** App user id (auth.users.id), carried via the purchase's appAccountToken. */
  userId: string;
  username?: string;
};

/**
 * Credit WB for a verified Apple transaction. Idempotent via
 * `(refKind="apple_iap", refId=transactionId)`. No-op for unknown products or a
 * missing user.
 */
export async function creditAppleIapTransaction(tx: AppleTransaction): Promise<CreditResult> {
  const product = APPLE_PRODUCTS[tx.productId];
  if (!product) return { credited: false, ledgerId: null, reason: "unknown_product" };
  if (!tx.userId) return { credited: false, ledgerId: null, reason: "no_user" };

  const ledgerId = await creditLedger({
    discordUserId: tx.userId,
    discordUsername: tx.username ?? "",
    amountCents: product.wbCents,
    kind: product.kind,
    refKind: APPLE_IAP_REF_KIND,
    refId: tx.transactionId,
    memo: product.memo,
    metadata: { product_id: tx.productId, transaction_id: tx.transactionId },
  });
  return { credited: ledgerId !== null, ledgerId };
}

/** Whether the App Store Server API credentials are present in the environment. */
export function appleIapConfigured(): boolean {
  return Boolean(
    process.env.APPLE_IAP_BUNDLE_ID &&
      process.env.APPLE_IAP_ISSUER_ID &&
      process.env.APPLE_IAP_KEY_ID,
  );
}

export type VerifyResult =
  | { ok: true; tx: AppleTransaction }
  | { ok: false; reason: string };

/**
 * Verify + decode an App Store Server Notification's `signedPayload` (a JWS).
 *
 * TODO(apple-setup): verify the JWS x5c chain against Apple's root CAs and decode
 * the signed transaction info (per the App Store Server API). Until the Apple
 * credentials exist this refuses, so nothing is ever credited from an
 * unverified payload.
 */
export async function verifySignedPayload(signedPayload: string): Promise<VerifyResult> {
  if (!appleIapConfigured()) return { ok: false, reason: "not_configured" };
  void signedPayload;
  return { ok: false, reason: "verification_not_implemented" };
}
