import { describe, expect, it } from "vitest";
import { formatWb, formatUsd } from "./format";

describe("formatWb", () => {
  it("formats positive cents with two decimals", () => {
    expect(formatWb(1234)).toBe("$12.34");
    expect(formatWb(0)).toBe("$0.00");
  });

  it("formats negative cents with a leading minus", () => {
    expect(formatWb(-5050)).toBe("-$50.50");
  });

  it("adds a + sign when signed: true and positive", () => {
    expect(formatWb(2500, { signed: true })).toBe("+$25.00");
    expect(formatWb(0, { signed: true })).toBe("$0.00");
  });

  it("keeps the minus for negatives even when signed", () => {
    expect(formatWb(-2500, { signed: true })).toBe("-$25.00");
  });

  it("respects decimals: 0 for whole-dollar display", () => {
    expect(formatWb(12345, { decimals: 0 })).toBe("$123");
  });

  it("inserts thousands separators", () => {
    expect(formatWb(123456789)).toBe("$1,234,567.89");
  });
});

describe("formatUsd", () => {
  it("formats positive cents", () => {
    expect(formatUsd(9999)).toBe("$99.99");
  });

  it("handles signed positives and negatives", () => {
    expect(formatUsd(-100, { signed: true })).toBe("-$1.00");
    expect(formatUsd(100, { signed: true })).toBe("+$1.00");
  });
});
