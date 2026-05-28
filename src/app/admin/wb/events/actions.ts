"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { hasAdminRole } from "@/lib/discord";
import { createEvent, setEventStatus, settleEvent, cancelEvent } from "@/lib/wb/bets";
import { runOddsSync } from "@/lib/wb/oddsSync";
import { runOddsSettle } from "@/lib/wb/oddsSettle";

async function requireAdmin(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  const isAdmin = await hasAdminRole(session.id);
  if (!isAdmin) throw new Error("Not an admin.");
  return session.id;
}

export async function createEventAction(formData: FormData): Promise<void> {
  const adminId = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const closesAtRaw = String(formData.get("closes_at") ?? "").trim();
  const closesAt = closesAtRaw ? new Date(closesAtRaw).toISOString() : null;

  // Outcomes come in as N label/odds pairs (label_0/odds_0, label_1/odds_1, ...).
  const outcomes: { label: string; oddsDecimal: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const label = String(formData.get(`label_${i}`) ?? "").trim();
    const odds = Number(formData.get(`odds_${i}`) ?? 0);
    if (!label) continue;
    if (!Number.isFinite(odds) || odds <= 1) {
      throw new Error(`Outcome ${i + 1}: odds must be > 1.00`);
    }
    outcomes.push({ label, oddsDecimal: odds });
  }
  if (!title) throw new Error("Title is required.");
  if (outcomes.length < 2) throw new Error("Need at least 2 outcomes.");

  await createEvent({ title, description, closesAt, createdBy: adminId, outcomes });
  revalidatePath("/admin/wb/events");
  revalidatePath("/events");
}

export async function lockEventAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventId = Number(formData.get("event_id"));
  if (!eventId) throw new Error("Missing event_id.");
  await setEventStatus(eventId, "locked");
  revalidatePath("/admin/wb/events");
  revalidatePath("/events");
}

export async function reopenEventAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventId = Number(formData.get("event_id"));
  if (!eventId) throw new Error("Missing event_id.");
  await setEventStatus(eventId, "open");
  revalidatePath("/admin/wb/events");
  revalidatePath("/events");
}

export async function settleEventAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventId = Number(formData.get("event_id"));
  const outcomeId = Number(formData.get("winning_outcome_id"));
  if (!eventId || !outcomeId) throw new Error("Missing event or outcome.");
  await settleEvent(eventId, outcomeId);
  revalidatePath("/admin/wb/events");
  revalidatePath("/events");
}

export async function cancelEventAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventId = Number(formData.get("event_id"));
  if (!eventId) throw new Error("Missing event_id.");
  await cancelEvent(eventId);
  revalidatePath("/admin/wb/events");
  revalidatePath("/events");
}

export async function syncOddsAction(): Promise<void> {
  await requireAdmin();
  await runOddsSync();
  revalidatePath("/admin/wb/events");
  revalidatePath("/events");
}

export async function settleOddsAction(): Promise<void> {
  await requireAdmin();
  await runOddsSettle();
  revalidatePath("/admin/wb/events");
  revalidatePath("/events");
}
