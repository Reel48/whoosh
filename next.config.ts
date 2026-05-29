import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Finnhub-hosted company logos used on the /capital/invest stock view.
      { protocol: "https", hostname: "static2.finnhub.io" },
      // cryptologos.cc — free crypto logos used for the whitelisted coins
      // (BTC, ETH, SOL, XRP, ADA, DOGE, LTC).
      { protocol: "https", hostname: "cryptologos.cc" },
      // Sleeper-hosted team/league avatar thumbnails used in the Fantasy section.
      { protocol: "https", hostname: "sleeper.app" },
    ],
  },
  // The Whoosh Bucks pages moved under the Capital section. Keep old bookmarks,
  // Discord links, and notification deep-links working. Query strings are
  // preserved automatically. Order matters: /events/mine before /events.
  async redirects() {
    return [
      { source: "/wallet", destination: "/capital/wallet", permanent: true },
      { source: "/wallet/:path*", destination: "/capital/wallet/:path*", permanent: true },
      { source: "/invest", destination: "/capital/invest", permanent: true },
      { source: "/events/mine", destination: "/capital/bets", permanent: true },
      { source: "/events", destination: "/capital/events", permanent: true },
    ];
  },
};

export default nextConfig;
