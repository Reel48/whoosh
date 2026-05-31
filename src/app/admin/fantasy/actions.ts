"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { hasAdminRole } from "@/lib/discord";
import { supabase } from "@/lib/supabase";
import { getLeague, getNflState } from "@/lib/sleeper/client";
import { listActiveLeagues, detectLeagueKind } from "@/lib/fantasy/leagues";
import { currentScoringWeek } from "@/lib/fantasy/format";
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

/** Parse a dollars string ("25", "9.99", "") into USD cents, or null when blank. */
function parseFeeCents(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim().replace(/^\$/, "");
  if (!s) return null;
  const dollars = Number(s);
  if (!Number.isFinite(dollars) || dollars < 0) throw new Error("Entry fee must be a non-negative number.");
  return Math.round(dollars * 100);
}

/** Read the per-league commerce fields shared by add + update. */
function commerceFields(formData: FormData) {
  const groupKey = String(formData.get("group_key") ?? "").trim() || null;
  const productName = String(formData.get("product_name") ?? "").trim() || null;
  const joinUrl = String(formData.get("join_url") ?? "").trim() || null;
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacityRaw ? Math.max(1, Math.round(Number(capacityRaw))) : 10;
  return {
    entry_fee_cents: parseFeeCents(formData.get("entry_fee")),
    group_key: groupKey,
    product_name: productName,
    join_url: joinUrl,
    capacity,
  };
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
      // Auto-classify: standard H2H vs a pick'em / survivor pool.
      kind: detectLeagueKind(league),
      ...commerceFields(formData),
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
    .update({ name: nameOverride, sort, ...commerceFields(formData) })
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

/** Upload a custom league logo to the public `fantasy-logos` bucket and save
 *  its URL. Overrides the Sleeper avatar across the section. */
export async function uploadLeagueLogoAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const sleeperLeagueId = String(formData.get("sleeper_league_id") ?? "").trim();
  if (!sleeperLeagueId) throw new Error("Missing league ID.");

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose an image file.");
  if (!file.type.startsWith("image/")) throw new Error("File must be an image.");
  if (file.size > 5_000_000) throw new Error("Image must be under 5 MB.");

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  // Timestamp suffix busts the CDN cache when a logo is replaced.
  const path = `${sleeperLeagueId}-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const store = supabase().storage.from("fantasy-logos");
  const { error: upErr } = await store.upload(path, bytes, {
    contentType: file.type || "image/png",
    upsert: true,
  });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
  const { data } = store.getPublicUrl(path);

  const { error } = await supabase()
    .from("fantasy_league")
    .update({ logo_url: data.publicUrl })
    .eq("sleeper_league_id", sleeperLeagueId);
  if (error) throw new Error(`Could not save logo: ${error.message}`);
  refresh();
}

/** Clear a league's custom logo (falls back to the Sleeper avatar). */
export async function clearLeagueLogoAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const sleeperLeagueId = String(formData.get("sleeper_league_id") ?? "").trim();
  if (!sleeperLeagueId) throw new Error("Missing league ID.");
  const { error } = await supabase()
    .from("fantasy_league")
    .update({ logo_url: null })
    .eq("sleeper_league_id", sleeperLeagueId);
  if (error) throw new Error(`Could not clear logo: ${error.message}`);
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
