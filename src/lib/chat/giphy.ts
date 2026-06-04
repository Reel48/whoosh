import { chatDb } from "./db";

/** A normalized GIF result for the chat picker. */
export type GifResult = {
  id: string;
  /** Full GIF to send/render in chat (downsized for size). */
  url: string;
  /** Smaller preview GIF for the picker grid. */
  previewUrl: string;
  width: number;
  height: number;
};

// The Giphy key lives in Supabase Vault; read it once via the service-role RPC.
let cachedKey: string | null | undefined;
async function giphyKey(): Promise<string | null> {
  if (cachedKey !== undefined) return cachedKey;
  const { data } = await chatDb().rpc("get_giphy_key");
  cachedKey = typeof data === "string" && data.length > 0 ? data : null;
  return cachedKey;
}

const GIPHY = "https://api.giphy.com/v1/gifs";

type GiphyImage = { url?: string; width?: string; height?: string };
type GiphyItem = {
  id?: string;
  images?: { downsized?: GiphyImage; fixed_height?: GiphyImage; fixed_width?: GiphyImage; original?: GiphyImage };
};

function toResult(it: GiphyItem): GifResult | null {
  const full = it.images?.downsized?.url || it.images?.fixed_height?.url || it.images?.original?.url;
  const preview = it.images?.fixed_width?.url || full;
  if (!it.id || !full || !preview) return null;
  return {
    id: it.id,
    url: full,
    previewUrl: preview,
    width: Number(it.images?.fixed_width?.width) || 0,
    height: Number(it.images?.fixed_width?.height) || 0,
  };
}

/**
 * Search Giphy (or trending when `query` is empty) for chat-appropriate GIFs.
 * The key never leaves the server; returns [] if it isn't configured.
 */
export async function searchGifs(query: string, limit = 24): Promise<GifResult[]> {
  const key = await giphyKey();
  if (!key) return [];
  const q = query.trim();
  const params = new URLSearchParams({
    api_key: key,
    limit: String(Math.min(Math.max(limit, 1), 50)),
    rating: "pg-13",
    bundle: "messaging_non_clips",
  });
  if (q) params.set("q", q);
  const url = `${GIPHY}/${q ? "search" : "trending"}?${params.toString()}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: GiphyItem[] };
    return (json.data ?? []).map(toResult).filter((g): g is GifResult => g !== null);
  } catch (e) {
    console.error("Giphy search failed:", e);
    return [];
  }
}
