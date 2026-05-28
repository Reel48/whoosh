import { cache } from "react";
import { unstable_cache } from "next/cache";

const DISCORD_API = "https://discord.com/api/v10";

/** Tag used by unstable_cache for the per-user guild-member cache; can be
 *  invalidated with `revalidateTag(GUILD_MEMBER_CACHE_TAG)` after a role
 *  change so the next read pulls fresh data. */
export const GUILD_MEMBER_CACHE_TAG = "discord:guild-member";
export const GUILD_WIDGET_CACHE_TAG = "discord:guild-widget";

export function authorizeUrl(redirectUri: string, state: string): string {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) throw new Error("DISCORD_CLIENT_ID is not set.");
  const u = new URL("https://discord.com/oauth2/authorize");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "identify");
  u.searchParams.set("state", state);
  // Omit `prompt=consent` so returning users don't have to re-confirm every time.
  return u.toString();
}

/**
 * Bare fetcher — hits Discord every time. Never call this directly; go
 * through `fetchGuildMember` so caching applies.
 */
async function _fetchGuildMemberFresh(
  userId: string,
): Promise<{ roles: string[]; nick?: string | null } | null> {
  const guild = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!guild || !botToken) throw new Error("Discord guild/bot env vars not set.");
  const r = await fetch(`${DISCORD_API}/guilds/${guild}/members/${userId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Discord /guilds/.../members failed: ${r.status} ${await r.text()}`);
  return (await r.json()) as { roles: string[]; nick?: string | null };
}

/**
 * Fetch a guild member, with two layers of caching:
 *   1. `unstable_cache` — per-userId, 5-minute cross-request cache, tagged
 *      so a role change can invalidate it.
 *   2. React `cache()` — per-render dedup so multiple call sites within one
 *      render share a single result.
 */
const _fetchGuildMemberCached = unstable_cache(
  _fetchGuildMemberFresh,
  ["discord:guild-member"],
  { revalidate: 300, tags: [GUILD_MEMBER_CACHE_TAG] },
);

export const fetchGuildMember = cache(_fetchGuildMemberCached);

/** True iff the user is currently a member of the Whoosh guild. */
export async function isGuildMember(userId: string): Promise<boolean> {
  return (await fetchGuildMember(userId)) !== null;
}

/**
 * Bare widget fetcher — hits Discord every time.
 */
async function _fetchGuildWidgetFresh(): Promise<{
  name?: string;
  presence_count?: number;
} | null> {
  const guild = process.env.DISCORD_GUILD_ID;
  if (!guild) return null;
  const r = await fetch(`${DISCORD_API}/guilds/${guild}/widget.json`);
  if (!r.ok) {
    console.warn(`Discord widget fetch failed: ${r.status}`);
    return null;
  }
  return r.json();
}

/**
 * Public widget (no auth needed). Cached cross-request for 60s — the
 * online-count display doesn't need to be real-time, and we don't want a
 * Discord call on every page render.
 */
const _fetchGuildWidgetCached = unstable_cache(
  _fetchGuildWidgetFresh,
  ["discord:guild-widget"],
  { revalidate: 60, tags: [GUILD_WIDGET_CACHE_TAG] },
);

export const fetchGuildWidget = cache(_fetchGuildWidgetCached);

/**
 * Approximate number of Whoosh members currently online (from the public
 * server widget). Returns null on failure.
 */
export async function getGuildOnlineCount(): Promise<number | null> {
  try {
    const w = await fetchGuildWidget();
    return w?.presence_count ?? null;
  } catch (e) {
    console.warn("getGuildOnlineCount failed:", e);
    return null;
  }
}

/** True iff the user is a member of the Whoosh guild AND has the Premium role. */
export async function hasPremiumRole(userId: string): Promise<boolean> {
  const role = process.env.DISCORD_PREMIUM_ROLE_ID;
  if (!role) throw new Error("DISCORD_PREMIUM_ROLE_ID is not set.");
  const member = await fetchGuildMember(userId);
  return !!member && member.roles.includes(role);
}

/** True iff the user is a member of the Whoosh guild AND has the admin role. */
export async function hasAdminRole(userId: string): Promise<boolean> {
  const role = process.env.DISCORD_ADMIN_ROLE_ID;
  if (!role) return false; // No env configured → no admins.
  const member = await fetchGuildMember(userId);
  return !!member && member.roles.includes(role);
}

export async function exchangeCode(code: string, redirectUri: string) {
  const id = process.env.DISCORD_CLIENT_ID!;
  const secret = process.env.DISCORD_CLIENT_SECRET!;
  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const r = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) {
    throw new Error(`Discord token exchange failed: ${r.status} ${await r.text()}`);
  }
  return (await r.json()) as {
    access_token: string;
    token_type: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };
}

export async function fetchDiscordUser(accessToken: string) {
  const r = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`Discord /users/@me failed: ${r.status}`);
  return (await r.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
    discriminator?: string;
    avatar?: string | null;
  };
}

/** Grant the Premium role to a guild member. Idempotent. */
export async function addPremiumRole(userId: string): Promise<{ ok: boolean; status: number; body?: string }> {
  return roleAction("PUT", userId);
}

/** Remove the Premium role from a guild member. */
export async function removePremiumRole(userId: string): Promise<{ ok: boolean; status: number; body?: string }> {
  return roleAction("DELETE", userId);
}

async function roleAction(method: "PUT" | "DELETE", userId: string) {
  const guild = process.env.DISCORD_GUILD_ID;
  const role = process.env.DISCORD_PREMIUM_ROLE_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!guild || !role || !botToken) {
    throw new Error("Discord guild/role/bot env vars not set.");
  }
  const r = await fetch(`${DISCORD_API}/guilds/${guild}/members/${userId}/roles/${role}`, {
    method,
    headers: {
      Authorization: `Bot ${botToken}`,
      "X-Audit-Log-Reason": method === "PUT" ? "Whoosh Premium granted" : "Whoosh Premium revoked",
    },
  });
  return { ok: r.ok, status: r.status, body: r.ok ? undefined : await r.text() };
}
