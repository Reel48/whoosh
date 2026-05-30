import { supabase } from "@/lib/supabase";
import { fetchGuildMember, discordAvatarUrl } from "@/lib/discord";

/**
 * Resolve team-owner avatars to the linked member's Discord profile picture.
 *
 * Fantasy data is keyed by Sleeper user ids (roster.owner_id); the only bridge
 * to a Discord identity is `fantasy_link` (set when a member links their
 * Sleeper account). So we can show a real Discord PFP for linked owners only —
 * unlinked rosters get no URL here and fall back to the monogram in the UI.
 *
 * Returns a map of Sleeper user_id → Discord avatar URL. Tolerant of Discord
 * being unavailable (a failed member fetch just yields the default avatar).
 */
export async function resolveOwnerAvatars(
  sleeperUserIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = [...new Set(sleeperUserIds.filter((x): x is string => !!x))];
  const out = new Map<string, string>();
  if (ids.length === 0) return out;

  const { data, error } = await supabase()
    .from("fantasy_link")
    .select("discord_user_id, sleeper_user_id")
    .in("sleeper_user_id", ids);
  if (error) {
    console.warn("resolveOwnerAvatars: fantasy_link query failed:", error.message);
    return out;
  }

  await Promise.all(
    (data ?? []).map(async (row) => {
      const member = await fetchGuildMember(row.discord_user_id).catch(() => null);
      out.set(
        row.sleeper_user_id,
        discordAvatarUrl(row.discord_user_id, member?.user?.avatar ?? null),
      );
    }),
  );
  return out;
}
