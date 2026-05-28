"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasAdminRole } from "@/lib/discord";
import { creditLedger } from "@/lib/wb/ledger";

async function requireAdmin(): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  const isAdmin = await hasAdminRole(session.id);
  if (!isAdmin) throw new Error("Not an admin.");
}

/**
 * Add or remove WB from a wallet. The amount field is unsigned; the
 * direction is set by the `op` field (which submit button was clicked).
 */
export async function adjustWbAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = String(formData.get("discord_user_id") ?? "").trim();
  const username = String(formData.get("discord_username") ?? "").trim();
  const op = String(formData.get("op") ?? "");
  const dollars = Number(formData.get("amount") ?? 0);
  const memo = String(formData.get("memo") ?? "").trim() || null;

  if (!userId) throw new Error("Discord user ID is required.");
  if (op !== "add" && op !== "remove") throw new Error("Choose Add or Remove.");
  if (!Number.isFinite(dollars) || dollars <= 0) {
    throw new Error("Amount must be a positive number.");
  }
  const signedCents = Math.round(dollars * 100) * (op === "add" ? 1 : -1);

  await creditLedger({
    discordUserId: userId,
    discordUsername: username || userId,
    amountCents: signedCents,
    kind: "adjustment",
    memo:
      memo ??
      `Admin ${op === "add" ? "credit" : "debit"} ${Math.abs(signedCents) / 100} WB`,
  });

  revalidatePath(`/admin/wb/users`);
  // Stay on the same user lookup view after submitting.
  redirect(`/admin/wb/users?user=${encodeURIComponent(username || userId)}`);
}
