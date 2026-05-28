import { supabase } from "@/lib/supabase";

export type NotificationKind =
  | "bet_settled"
  | "dividend"
  | "transfer_in"
  | "interest_posted"
  | "achievement"
  | "renewal"
  | "referral"
  | "system";

export type Notification = {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function listNotifications(
  userId: string,
  limit = 20,
): Promise<Notification[]> {
  const { data, error } = await supabase()
    .from("notification")
    .select("id, kind, title, body, href, read_at, created_at")
    .eq("discord_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listNotifications failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: Number(r.id),
    kind: r.kind as NotificationKind,
    title: r.title,
    body: r.body,
    href: r.href,
    readAt: r.read_at,
    createdAt: r.created_at,
  }));
}

export async function countUnread(userId: string): Promise<number> {
  const { count, error } = await supabase()
    .from("notification")
    .select("id", { count: "exact", head: true })
    .eq("discord_user_id", userId)
    .is("read_at", null);
  if (error) throw new Error(`countUnread failed: ${error.message}`);
  return count ?? 0;
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await supabase()
    .from("notification")
    .update({ read_at: new Date().toISOString() })
    .eq("discord_user_id", userId)
    .is("read_at", null);
  if (error) throw new Error(`markAllRead failed: ${error.message}`);
}

export async function pushNotification(input: {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase().from("notification").insert({
    discord_user_id: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`pushNotification failed: ${error.message}`);
}
