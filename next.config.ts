import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Finnhub-hosted company logos used on the /invest stock detail view.
      { protocol: "https", hostname: "static2.finnhub.io" },
    ],
  },
};

export default nextConfig;
