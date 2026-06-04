import { getLeagueOverview } from "@/lib/fantasy/leagues";
import { getLink } from "@/lib/fantasy/link";
import { hasLeagueAccess, getEntitlements } from "@/lib/fantasy/entitlements";
import { getCrossLeagueScoreboard } from "@/lib/fantasy/rankings";
import { chatDb } from "@/lib/chat/db";
import { ChatError } from "@/lib/chat/chat";
import type { ChatChannel } from "@/lib/chat/types";

/** Fixed channel key for the cross-league Power Rankings chat. */
const RANKINGS_KEY = "rankings";

function groupChannel(leagueId: string, channelId: number, name: string): ChatChannel {
  return {
    id: channelId, categoryId: 0, slug: `fantasy:${leagueId}`, name,
    description: null, kind: "group", postPolicy: "members", requiredRoleId: null,
    canPost: true, unread: 0, lastActivityAt: null,
  };
}

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
  return groupChannel(leagueId, Number(data), name);
}

/**
 * Open the cross-league Power Rankings chat — for everyone on the leaderboard
 * (your linked Sleeper account owns a roster in any league) plus paid members.
 * One shared channel; same membership-on-open + RLS gate as league chats.
 */
export async function openRankingsChat(userId: string): Promise<ChatChannel> {
  const link = await getLink(userId).catch(() => null);
  const board = await getCrossLeagueScoreboard().catch(() => ({ rows: [], leagues: [] }));
  let member = !!link && board.rows.some((r) => r.ownerId === link.sleeperUserId);
  if (!member) {
    const ents = await getEntitlements(userId).catch(() => []);
    member = ents.some((e) => e.status === "active");
  }

  const db = chatDb();
  if (!member) {
    await db.rpc("remove_fantasy_chat_member", { p_league_id: RANKINGS_KEY, p_user: userId });
    throw new ChatError("forbidden", "The Power Rankings chat is for league members.");
  }

  const name = "Power Rankings Chat";
  const { data, error } = await db.rpc("ensure_fantasy_chat_channel", {
    p_league_id: RANKINGS_KEY, p_name: name, p_user: userId,
  });
  if (error) throw new ChatError("internal", error.message);
  return groupChannel(RANKINGS_KEY, Number(data), name);
}
