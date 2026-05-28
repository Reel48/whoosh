const DISCORD_API = "https://discord.com/api/v10";

export function authorizeUrl(redirectUri: string, state: string): string {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) throw new Error("DISCORD_CLIENT_ID is not set.");
  const u = new URL("https://discord.com/oauth2/authorize");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "identify");
  u.searchParams.set("state", state);
  u.searchParams.set("prompt", "consent");
  return u.toString();
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
