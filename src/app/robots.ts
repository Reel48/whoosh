import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://whoosh.lol").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/account", "/home", "/capital", "/fantasy", "/pool", "/thanks"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
