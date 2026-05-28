import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Finnhub-hosted company logos used on the /invest stock detail view.
      { protocol: "https", hostname: "static2.finnhub.io" },
      // cryptologos.cc — free crypto logos used for the whitelisted coins
      // (BTC, ETH, SOL, XRP, ADA, DOGE, LTC).
      { protocol: "https", hostname: "cryptologos.cc" },
    ],
  },
};

export default nextConfig;
