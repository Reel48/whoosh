import { getLeagueOverview } from "@/lib/fantasy/leagues";
import { getLink } from "@/lib/fantasy/link";
import { hasLeagueAccess } from "@/lib/fantasy/entitlements";
import { chatDb } from "@/lib/chat/db";
import { ChatError } from "@/lib/chat/chat";
import type { ChatChannel } from "@/lib/chat/types";

/**
 * Per-league / per-pool chat membership. A user is "in" a league/pool when their
 * linked Sleeper account owns a roster in it, or they hold a paid entitlement.
 * (Leagues + pools share the Sleeper league id, so one path serves both.)
 */
async function fantasyMembership(
  userId: string, leagueId: string,
): Promise<{ member: boolean; name: string } | null> {
  const overview = await getLeagueOverview(leagueId).catch(() => null);
  if (!overview) return null;
  const link = await getLink(userId).catch(() => null);
  let member = !!link && overview.standings.some((s) => s.ownerId === link.sleeperUserId);
  if (!member && (overview.config.entryFeeCents ?? 0) > 0) {
    member = await hasLeagueAccess(userId, leagueId, overview.season).catch(() => false);
  }
  return { member, name: overview.displayName };
}

/**
 * Open (or create) the chat for a league/pool, returned as a channel. Verifies
 * membership at the app layer (needs the Sleeper API for free leagues), then
 * seats the member in `chat_channel_member` so RLS enforces read/post/realtime.
 * Non-members are pruned + rejected so leaving a league revokes chat access.
 */
export async function openFantasyChat(userId: string, leagueId: string): Promise<ChatChannel> {
  const result = await fantasyMembership(userId, leagueId);
  if (!result) throw new ChatError("not_found", "League not found.");

  const db = chatDb();
  if (!result.member) {
    await db.rpc("remove_fantasy_chat_member", { p_league_id: leagueId, p_user: userId });
    throw new ChatError("forbidden", "Chat is only for members of this league.");
  }

  const name = `${result.name} Chat`;
  const { data, error } = await db.rpc("ensure_fantasy_chat_channel", {
    p_league_id: leagueId, p_name: name, p_user: userId,
  });
  if (error) throw new ChatError("internal", error.message);

  return {
    id: Number(data), categoryId: 0, slug: `fantasy:${leagueId}`, name,
    description: null, kind: "group", postPolicy: "members", requiredRoleId: null,
    canPost: true, unread: 0, lastActivityAt: null,
  };
}
