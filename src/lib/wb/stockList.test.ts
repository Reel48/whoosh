import { describe, expect, it } from "vitest";
import { searchStocks, POPULAR_STOCKS } from "./stockList";

describe("searchStocks", () => {
  it("returns empty when the query is blank", () => {
    expect(searchStocks("")).toEqual([]);
    expect(searchStocks("   ")).toEqual([]);
  });

  it("ranks an exact symbol match first", () => {
    const results = searchStocks("AAPL");
    expect(results[0]?.symbol).toBe("AAPL");
  });

  it("matches case-insensitively", () => {
    const results = searchStocks("aapl");
    expect(results[0]?.symbol).toBe("AAPL");
  });

  it("matches by symbol prefix", () => {
    const results = searchStocks("AM");
    const symbols = results.map((r) => r.symbol);
    expect(symbols).toContain("AMD");
    expect(symbols).toContain("AMZN");
  });

  it("matches by company name word-prefix", () => {
    const results = searchStocks("Tesla");
    expect(results[0]?.symbol).toBe("TSLA");
  });

  it("respects the limit parameter", () => {
    expect(searchStocks("A", 3)).toHaveLength(3);
  });

  it("includes only items from the catalog", () => {
    const catalogSymbols = new Set(POPULAR_STOCKS.map((s) => s.symbol));
    const results = searchStocks("a", 50);
    for (const r of results) {
      expect(catalogSymbols.has(r.symbol)).toBe(true);
    }
  });
});
