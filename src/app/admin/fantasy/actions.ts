"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { hasAdminRole } from "@/lib/discord";
import { supabase } from "@/lib/supabase";
import { getLeague, getNflState } from "@/lib/sleeper/client";
import { listActiveLeagues } from "@/lib/fantasy/leagues";
import { currentScoringWeek } from "@/lib/fantasy/format";
import { refreshPlayers } from "@/lib/sleeper/players";
import { ensureMatchupEvents, settleFinishedWeeks } from "@/lib/fantasy/wagers";

async function requireAdmin(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  if (!(await hasAdminRole(session.id))) throw new Error("Not an admin.");
  return session.id;
}

function refresh() {
  revalidatePath("/admin/fantasy");
  revalidatePath("/fantasy");
  revalidatePath("/fantasy/leagues");
}

/** Add a curated Whoosh league. Validates the id against Sleeper and pulls
 *  season/name defaults from the league when not supplied. */
export async function addLeagueAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const sleeperLeagueId = String(formData.get("sleeper_league_id") ?? "").trim();
  if (!sleeperLeagueId) throw new Error("Sleeper league ID is required.");

  const league = await getLeague(sleeperLeagueId);
  if (!league) throw new Error(`No Sleeper league found for ID ${sleeperLeagueId}.`);

  const season = String(formData.get("season") ?? "").trim() || league.season;
  const nameOverride = String(formData.get("name") ?? "").trim() || null;
  const sort = Number(formData.get("sort") ?? 0) || 0;

  const { error } = await supabase().from("fantasy_league").upsert(
    {
      sleeper_league_id: sleeperLeagueId,
      season,
      name: nameOverride,
      sort,
      active: true,
    },
    { onConflict: "sleeper_league_id" },
  );
  if (error) throw new Error(`Could not add league: ${error.message}`);
  refresh();
}

export async function updateLeagueAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const sleeperLeagueId = String(formData.get("sleeper_league_id") ?? "").trim();
  if (!sleeperLeagueId) throw new Error("Missing league ID.");
  const nameOverride = String(formData.get("name") ?? "").trim() || null;
  const sort = Number(formData.get("sort") ?? 0) || 0;

  const { error } = await supabase()
    .from("fantasy_league")
    .update({ name: nameOverride, sort })
    .eq("sleeper_league_id", sleeperLeagueId);
  if (error) throw new Error(`Could not update league: ${error.message}`);
  refresh();
}

export async function toggleLeagueAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const sleeperLeagueId = String(formData.get("sleeper_league_id") ?? "").trim();
  const active = String(formData.get("active") ?? "") === "true";
  if (!sleeperLeagueId) throw new Error("Missing league ID.");

  const { error } = await supabase()
    .from("fantasy_league")
    .update({ active })
    .eq("sleeper_league_id", sleeperLeagueId);
  if (error) throw new Error(`Could not toggle league: ${error.message}`);
  refresh();
}

export async function removeLeagueAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const sleeperLeagueId = String(formData.get("sleeper_league_id") ?? "").trim();
  if (!sleeperLeagueId) throw new Error("Missing league ID.");
  const { error } = await supabase()
    .from("fantasy_league")
    .delete()
    .eq("sleeper_league_id", sleeperLeagueId);
  if (error) throw new Error(`Could not remove league: ${error.message}`);
  refresh();
}

/** Manually refresh the cached Sleeper player index (otherwise daily cron). */
export async function refreshPlayersAction(): Promise<void> {
  await requireAdmin();
  await refreshPlayers();
  refresh();
}

/** Manually run the fantasy WB sync (create current-week events, settle past). */
export async function syncFantasyAction(): Promise<void> {
  await requireAdmin();
  const state = await getNflState();
  const week = currentScoringWeek(state);
  const leagues = await listActiveLeagues();
  for (const league of leagues) {
    const season = state?.season ?? league.season;
    await ensureMatchupEvents(league.sleeperLeagueId, season, week).catch(() => 0);
    await settleFinishedWeeks(league.sleeperLeagueId, season, week).catch(() => 0);
  }
  refresh();
  revalidatePath("/fantasy/matchups");
}
