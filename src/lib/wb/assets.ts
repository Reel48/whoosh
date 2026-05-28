/**
 * Curated list of cryptocurrencies tradable on Whoosh. Whitelisted on purpose
 * — anything not in this list is treated as a stock (which means it has to
 * resolve through the regular US-equity endpoints). Adding a coin: drop a
 * row here and it's live.
 *
 * Symbols are the bare ticker (BTC, ETH, …) — same column as stocks in the
 * invest_position / invest_order tables. Asset class is implicit via this
 * whitelist; no schema column needed.
 */

export type CryptoAsset = {
  symbol: string;
  name: string;
  /** Finnhub spot quote endpoint expects `BINANCE:<SYMBOL>USDT`. */
  finnhubSymbol: string;
  /** Twelve Data time_series endpoint expects `<SYMBOL>/USD`. */
  twelvedataSymbol: string;
  /** Logo URL hosted on cryptologos.cc (free CDN, MIT-style usage). */
  logoUrl: string;
};

export const CRYPTO_ASSETS: CryptoAsset[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    finnhubSymbol: "BINANCE:BTCUSDT",
    twelvedataSymbol: "BTC/USD",
    logoUrl: "https://cryptologos.cc/logos/bitcoin-btc-logo.png",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    finnhubSymbol: "BINANCE:ETHUSDT",
    twelvedataSymbol: "ETH/USD",
    logoUrl: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
  },
  {
    symbol: "SOL",
    name: "Solana",
    finnhubSymbol: "BINANCE:SOLUSDT",
    twelvedataSymbol: "SOL/USD",
    logoUrl: "https://cryptologos.cc/logos/solana-sol-logo.png",
  },
  {
    symbol: "XRP",
    name: "XRP",
    finnhubSymbol: "BINANCE:XRPUSDT",
    twelvedataSymbol: "XRP/USD",
    logoUrl: "https://cryptologos.cc/logos/xrp-xrp-logo.png",
  },
  {
    symbol: "ADA",
    name: "Cardano",
    finnhubSymbol: "BINANCE:ADAUSDT",
    twelvedataSymbol: "ADA/USD",
    logoUrl: "https://cryptologos.cc/logos/cardano-ada-logo.png",
  },
  {
    symbol: "DOGE",
    name: "Dogecoin",
    finnhubSymbol: "BINANCE:DOGEUSDT",
    twelvedataSymbol: "DOGE/USD",
    logoUrl: "https://cryptologos.cc/logos/dogecoin-doge-logo.png",
  },
  {
    symbol: "LTC",
    name: "Litecoin",
    finnhubSymbol: "BINANCE:LTCUSDT",
    twelvedataSymbol: "LTC/USD",
    logoUrl: "https://cryptologos.cc/logos/litecoin-ltc-logo.png",
  },
];

const BY_SYMBOL = new Map(CRYPTO_ASSETS.map((c) => [c.symbol, c]));

export function isCryptoSymbol(symbol: string): boolean {
  return BY_SYMBOL.has(symbol.toUpperCase());
}

export function getCryptoAsset(symbol: string): CryptoAsset | null {
  return BY_SYMBOL.get(symbol.toUpperCase()) ?? null;
}
