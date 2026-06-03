import { describe, expect, it } from "vitest";
import { clientAllows, clientFromReq, requireCapability } from "./client";

function reqWith(client?: string): Request {
  return new Request("https://example.com/api/v1/wb/wager", {
    headers: client ? { "X-Client": client } : {},
  });
}

describe("clientFromReq", () => {
  it("reads the X-Client header (case-insensitive value), defaulting to web", () => {
    expect(clientFromReq(reqWith("ios"))).toBe("ios");
    expect(clientFromReq(reqWith("IOS"))).toBe("ios");
    expect(clientFromReq(reqWith("android"))).toBe("android");
    expect(clientFromReq(reqWith("something"))).toBe("web");
    expect(clientFromReq(reqWith())).toBe("web");
  });
});

describe("clientAllows / requireCapability", () => {
  it("allows wagering for all clients under the default policy", () => {
    expect(clientAllows("web", "wagering")).toBe(true);
    expect(clientAllows("ios", "wagering")).toBe(true);
  });

  it("returns null (no block) when the capability is allowed", () => {
    expect(requireCapability(reqWith("ios"), "wagering")).toBeNull();
    expect(requireCapability(reqWith("web"), "real_money_fantasy")).toBeNull();
  });
});
