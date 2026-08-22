import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://whoosh.business").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ["", "/join", "/terms", "/privacy"];
  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/join" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/join" ? 0.8 : 0.4,
  }));
}
