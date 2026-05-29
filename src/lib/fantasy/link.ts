import { supabase } from "@/lib/supabase";
import { getUserByName } from "@/lib/sleeper/client";

export type FantasyLink = {
  sleeperUserId: string;
  sleeperUsername: string;
};

export type LinkResult =
  | { ok: true; link: FantasyLink }
  | { ok: false; error: string };

/** The member's linked Sleeper account, if any. */
export async function getLink(discordUserId: string): Promise<FantasyLink | null> {
  const { data, error } = await supabase()
    .from("fantasy_link")
    .select("sleeper_user_id, sleeper_username")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();
  if (error) throw new Error(`getLink failed: ${error.message}`);
  if (!data) return null;
  return { sleeperUserId: data.sleeper_user_id, sleeperUsername: data.sleeper_username };
}

/**
 * Resolve a Sleeper username to its user_id and persist the link. Used to
 * highlight the member's team across the section.
 */
export async function setLink(discordUserId: string, usernameRaw: string): Promise<LinkResult> {
  const username = usernameRaw.trim().replace(/^@/, "");
  if (!username) return { ok: false, error: "Enter your Sleeper username." };

  const user = await getUserByName(username);
  if (!user?.user_id) {
    return { ok: false, error: `No Sleeper user found for "${username}".` };
  }

  const { error } = await supabase().from("fantasy_link").upsert(
    {
      discord_user_id: discordUserId,
      sleeper_user_id: user.user_id,
      sleeper_username: user.username ?? username,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "discord_user_id" },
  );
  if (error) return { ok: false, error: `Could not save link: ${error.message}` };
  return { ok: true, link: { sleeperUserId: user.user_id, sleeperUsername: user.username ?? username } };
}

export async function clearLink(discordUserId: string): Promise<void> {
  const { error } = await supabase()
    .from("fantasy_link")
    .delete()
    .eq("discord_user_id", discordUserId);
  if (error) throw new Error(`clearLink failed: ${error.message}`);
}
