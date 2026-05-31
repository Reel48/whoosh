import { describe, it, expect } from "vitest";
import { WB_PER_USD, WB_PER_USD_FANTASY } from "./stripeCredits";

/**
 * The crediting rates are the contract with users:
 *   premium subscriptions + direct purchases → 10 WB per $1
 *   fantasy buy-ins                          → 2.5 WB per $1
 * 1 WB = 100 ledger cents, so wb_cents = usd_cents * multiplier.
 */
describe("WB credit rates", () => {
  it("premium/purchase = 10 WB per $1", () => {
    expect(WB_PER_USD).toBe(10);
    expect(400 * WB_PER_USD).toBe(4000); // $4 sub  → 40 WB
    expect(3600 * WB_PER_USD).toBe(36000); // $36 sub → 360 WB
    expect(1000 * WB_PER_USD).toBe(10000); // $10 buy → 100 WB
  });

  it("fantasy = 2.5 WB per $1, rounded to whole cents", () => {
    expect(WB_PER_USD_FANTASY).toBe(2.5);
    expect(Math.round(1000 * WB_PER_USD_FANTASY)).toBe(2500); // $10 → 25 WB
    expect(Math.round(2500 * WB_PER_USD_FANTASY)).toBe(6250); // $25 → 62.5 WB
    expect(Math.round(999 * WB_PER_USD_FANTASY)).toBe(2498); // rounds half up
  });
});
