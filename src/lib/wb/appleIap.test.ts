import { describe, expect, it, beforeEach } from "vitest";
import {
  APPLE_IAP_REF_KIND,
  appleIapConfigured,
  creditAppleIapTransaction,
  verifySignedPayload,
} from "./appleIap";

describe("appleIap scaffold", () => {
  beforeEach(() => {
    delete process.env.APPLE_IAP_BUNDLE_ID;
    delete process.env.APPLE_IAP_ISSUER_ID;
    delete process.env.APPLE_IAP_KEY_ID;
  });

  it("uses the apple_iap ledger ref kind (idempotency source tag)", () => {
    expect(APPLE_IAP_REF_KIND).toBe("apple_iap");
  });

  it("reports not configured until Apple credentials are present", () => {
    expect(appleIapConfigured()).toBe(false);
    process.env.APPLE_IAP_BUNDLE_ID = "com.whoosh.app";
    process.env.APPLE_IAP_ISSUER_ID = "issuer";
    process.env.APPLE_IAP_KEY_ID = "key";
    expect(appleIapConfigured()).toBe(true);
  });

  it("refuses to verify a payload while unconfigured (never credits unverified)", async () => {
    const result = await verifySignedPayload("ey.signed.payload");
    expect(result).toEqual({ ok: false, reason: "not_configured" });
  });

  it("no-ops on an unknown product (no DB call before the product lookup)", async () => {
    const result = await creditAppleIapTransaction({
      transactionId: "t1",
      productId: "com.whoosh.unknown",
      userId: "u1",
    });
    expect(result).toEqual({ credited: false, ledgerId: null, reason: "unknown_product" });
  });
});
