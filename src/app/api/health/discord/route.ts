import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISCORD_API = "https://discord.com/api/v10";

/**
 * Lightweight health probe for the Discord bot.
 *
 * Verifies, in order:
 *   1. DISCORD_BOT_TOKEN is configured
 *   2. Token authenticates (GET /users/@me)
 *   3. Bot can read the configured guild's roles (GET /guilds/:id/roles)
 *   4. The configured Premium role ID exists in the guild
 *
 * On any failure, returns 503 with a structured error explaining what's
 * broken. On success, returns 200 with the bot identity + role info.
 *
 * Safe to leave public — only exposes the bot's username and the Premium
 * role name (both visible to any guild member anyway).
 */
export async function GET() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guild = process.env.DISCORD_GUILD_ID;
  const roleId = process.env.DISCORD_PREMIUM_ROLE_ID;

  if (!token) {
    return fail("config", 503, "DISCORD_BOT_TOKEN not set in environment");
  }

  // 1. Token validity
  const meRes = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!meRes.ok) {
    return fail(
      "identify",
      503,
      `Discord rejected the bot token (${meRes.status}). Likely the token was reset in Developer Portal — generate a new one and update DISCORD_BOT_TOKEN in env.`,
    );
  }
  const me = (await meRes.json()) as { id: string; username: string };

  const result: Record<string, unknown> = {
    ok: true,
    bot: { id: me.id, username: me.username },
  };

  // 2. Guild access
  if (!guild) {
    result.warning = "DISCORD_GUILD_ID not set — guild checks skipped";
    return NextResponse.json(result);
  }

  const rolesRes = await fetch(`${DISCORD_API}/guilds/${guild}/roles`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!rolesRes.ok) {
    return fail(
      "guild_access",
      503,
      `Bot cannot read guild ${guild} (${rolesRes.status}). Re-invite the bot to the server.`,
    );
  }
  const roles = (await rolesRes.json()) as Array<{
    id: string;
    name: string;
    position: number;
  }>;
  result.guildAccess = true;

  // 3. Premium role exists
  if (!roleId) {
    result.warning = "DISCORD_PREMIUM_ROLE_ID not set — role check skipped";
    return NextResponse.json(result);
  }
  const premium = roles.find((r) => r.id === roleId);
  if (premium) {
    result.premiumRole = {
      id: premium.id,
      name: premium.name,
      position: premium.position,
    };
  } else {
    result.premiumRole = null;
    result.warning = `Premium role ID ${roleId} not found in guild — verify DISCORD_PREMIUM_ROLE_ID.`;
  }

  return NextResponse.json(result);
}

function fail(step: string, status: number, error: string) {
  return NextResponse.json({ ok: false, step, error }, { status });
}
