"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { hasAdminRole } from "@/lib/discord";
import { setRate, accrueInterest, postInterest } from "@/lib/wb/interest";
import { creditLedger } from "@/lib/wb/ledger";
import { postDividend } from "@/lib/wb/dividend";

async function requireAdmin(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  const isAdmin = await hasAdminRole(session.id);
  if (!isAdmin) throw new Error("Not an admin.");
  return session.id;
}

export async function overrideRateAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const pct = Number(formData.get("apy_pct"));
  if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
    throw new Error("APY must be a number between 0 and 50.");
  }
  const today = new Date().toISOString().slice(0, 10);
  await setRate(today, Math.round(pct * 100), "admin_override");
  revalidatePath("/admin/wb");
}

export async function runAccrualAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const date = String(formData.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Date must be YYYY-MM-DD.");
  }
  await accrueInterest(date);
  revalidatePath("/admin/wb");
}

export async function runPostAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const through = String(formData.get("through") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through)) {
    throw new Error("Through date must be YYYY-MM-DD.");
  }
  await postInterest(through);
  revalidatePath("/admin/wb");
}

export async function postDividendAction(formData: FormData): Promise<void> {
  const adminId = await requireAdmin();
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const exDate = String(formData.get("ex_date") ?? "").trim();
  const usdPerShare = Number(formData.get("usd_per_share") ?? 0);
  if (!symbol) throw new Error("Symbol is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exDate)) {
    throw new Error("Ex-date must be YYYY-MM-DD.");
  }
  if (!Number.isFinite(usdPerShare) || usdPerShare <= 0) {
    throw new Error("Dividend must be a positive USD amount per share.");
  }
  await postDividend({
    symbol,
    exDate,
    usdPerShare,
    source: "admin_manual",
    postedBy: adminId,
  });
  revalidatePath("/admin/wb");
}

export async function adjustmentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = String(formData.get("discord_user_id") ?? "").trim();
  const username = String(formData.get("discord_username") ?? "").trim();
  const dollars = Number(formData.get("amount") ?? 0);
  const memo = String(formData.get("memo") ?? "").trim() || null;
  if (!userId) throw new Error("Discord user ID is required.");
  if (!Number.isFinite(dollars) || dollars === 0) {
    throw new Error("Amount must be a nonzero number (positive credit, negative debit).");
  }
  const amountCents = Math.round(dollars * 100);
  // Manual adjustment — no external ref, so each one is its own ledger row.
  await creditLedger({
    discordUserId: userId,
    discordUsername: username || userId,
    amountCents,
    kind: "adjustment",
    memo: memo ?? `Admin adjustment ${amountCents >= 0 ? "+" : ""}${amountCents / 100} WB`,
  });
  revalidatePath("/admin/wb");
}
