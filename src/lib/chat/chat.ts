import type { ApiErrorCode } from "@/lib/api/json";
import { chatDb } from "./db";
import type {
  ChatAuthor, ChatCategory, ChatChannel, ChatLeaderboardRow, ChatMe, ChatMember,
  ChatMessage, ChatOverview, ChatReactionSummary, ChatRole,
  CategoryRow, ChannelRow, MessageRow, ProfileRow, RoleRow, StatRow,
} from "./types";

/** Messages need this many ⭐ to land on the Starboard. */
export const STARBOARD_THRESHOLD = 3;
const DEFAULT_ROLE_COLOR = "#9aa0a6";
const PAGE = 50;

/** Lib-level error carrying a stable API code; routes map it to the envelope. */
export class ChatError extends Error {
  constructor(public code: ApiErrorCode, message: string) {
    super(message);
  }
}

function mapPgError(error: { message?: string } | null): ChatError {
  const m = (error?.message ?? "").toLowerCase();
  if (m.includes("forbidden") || m.includes("not assignable")) return new ChatError("forbidden", "Not allowed.");
  if (m.includes("empty")) return new ChatError("validation", "Message is empty.");
  return new ChatError("internal", error?.message ?? "Chat operation failed.");
}

// ── Author enrichment (denormalized name color = highest-priority role) ──────
async function enrichAuthors(ids: string[]): Promise<Map<string, ChatAuthor>> {
  const map = new Map<string, ChatAuthor>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return map;
  const db = chatDb();
  const [{ data: profiles }, { data: stats }, { data: userRoles }, { data: roles }] = await Promise.all([
    db.from("profile").select("user_id, username, avatar_url").in("user_id", unique),
    db.from("chat_user_stat").select("user_id, level").in("user_id", unique),
    db.from("chat_user_role").select("user_id, role_id").in("user_id", unique),
    db.from("chat_role").select("id, color, priority"),
  ]);
  const levelByUser = new Map<string, number>();
  for (const s of (stats ?? []) as Pick<StatRow, "user_id" | "level">[]) levelByUser.set(s.user_id, s.level);
  const roleById = new Map<number, { color: string; priority: number }>();
  for (const r of (roles ?? []) as Pick<RoleRow, "id" | "color" | "priority">[]) roleById.set(r.id, r);
  const topByUser = new Map<string, { color: string; priority: number }>();
  for (const ur of (userRoles ?? []) as { user_id: string; role_id: number }[]) {
    const role = roleById.get(ur.role_id);
    if (!role) continue;
    const cur = topByUser.get(ur.user_id);
    if (!cur || role.priority > cur.priority) topByUser.set(ur.user_id, role);
  }
  for (const p of (profiles ?? []) as ProfileRow[]) {
    map.set(p.user_id, {
      id: p.user_id,
      username: p.username,
      avatarUrl: p.avatar_url,
      level: levelByUser.get(p.user_id) ?? 0,
      roleColor: topByUser.get(p.user_id)?.color ?? DEFAULT_ROLE_COLOR,
    });
  }
  return map;
}

function authorOr(map: Map<string, ChatAuthor>, userId: string): ChatAuthor {
  return map.get(userId) ?? {
    id: userId, username: "unknown", avatarUrl: null, level: 0, roleColor: DEFAULT_ROLE_COLOR,
  };
}

function toMessage(
  r: MessageRow,
  authors: Map<string, ChatAuthor>,
  reactionsByMsg: Map<number, ChatReactionSummary[]>,
  viewerId: string,
): ChatMessage {
  return {
    id: r.id,
    channelId: r.channel_id,
    author: authorOr(authors, r.user_id),
    body: r.body,
    imageUrl: r.image_url,
    replyToId: r.reply_to_id,
    starCount: r.star_count,
    reactions: reactionsByMsg.get(r.id) ?? [],
    mine: r.user_id === viewerId,
    createdAt: r.created_at,
    editedAt: r.edited_at,
  };
}

async function canRead(userId: string, channelId: number): Promise<boolean> {
  const { data } = await chatDb().rpc("chat_can_read", { p_channel: channelId, p_user: userId });
  return Boolean(data);
}

async function reactionsFor(messageIds: number[], viewerId: string): Promise<Map<number, ChatReactionSummary[]>> {
  const out = new Map<number, ChatReactionSummary[]>();
  if (!messageIds.length) return out;
  const { data } = await chatDb()
    .from("chat_reaction").select("message_id, user_id, emoji").in("message_id", messageIds);
  // message_id → emoji → { count, mine }
  const acc = new Map<number, Map<string, { count: number; mine: boolean }>>();
  for (const row of (data ?? []) as { message_id: number; user_id: string; emoji: string }[]) {
    const byEmoji = acc.get(row.message_id) ?? new Map();
    const cur = byEmoji.get(row.emoji) ?? { count: 0, mine: false };
    cur.count += 1;
    if (row.user_id === viewerId) cur.mine = true;
    byEmoji.set(row.emoji, cur);
    acc.set(row.message_id, byEmoji);
  }
  for (const [mid, byEmoji] of acc) {
    out.set(mid, [...byEmoji.entries()].map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine })));
  }
  return out;
}

// ── Overview: accessible categories/channels + the viewer's level/roles ──────
export async function getChatOverview(userId: string, isAdmin: boolean, isPremium: boolean, avatarUrl: string | null): Promise<ChatOverview> {
  const db = chatDb();
  await db.rpc("reconcile_chat_roles", { p_user: userId, p_is_premium: isPremium });

  const [{ data: cats }, { data: chans }, { data: myRoleRows }, { data: roleRows }, { data: stat }] =
    await Promise.all([
      db.from("chat_category").select("id, name, position").order("position", { ascending: true }),
      db.from("chat_channel").select(
        "id, category_id, slug, name, description, kind, post_policy, required_role_id, is_active, position",
      ).eq("is_active", true).order("position", { ascending: true }),
      db.from("chat_user_role").select("role_id").eq("user_id", userId),
      db.from("chat_role").select("id, key, name, color, priority").order("priority", { ascending: false }),
      db.from("chat_user_stat").select("xp, level").eq("user_id", userId).maybeSingle(),
    ]);

  const myRoleIds = new Set(((myRoleRows ?? []) as { role_id: number }[]).map((r) => r.role_id));
  const allRoles = (roleRows ?? []) as RoleRow[];
  const roleDto = (r: RoleRow): ChatRole => ({ id: r.id, key: r.key, name: r.name, color: r.color, priority: r.priority });

  const canAccess = (c: ChannelRow) =>
    c.required_role_id == null || isAdmin || myRoleIds.has(c.required_role_id);
  const canPost = (c: ChannelRow) =>
    canAccess(c) && (c.post_policy === "members" || (c.post_policy === "admins" && isAdmin));

  const channelsByCat = new Map<number, ChatChannel[]>();
  for (const c of (chans ?? []) as ChannelRow[]) {
    if (!canAccess(c)) continue;
    const dto: ChatChannel = {
      id: c.id, categoryId: c.category_id, slug: c.slug, name: c.name,
      description: c.description, kind: c.kind, postPolicy: c.post_policy,
      requiredRoleId: c.required_role_id, canPost: canPost(c),
    };
    const list = channelsByCat.get(c.category_id) ?? [];
    list.push(dto);
    channelsByCat.set(c.category_id, list);
  }

  const categories: ChatCategory[] = ((cats ?? []) as CategoryRow[])
    .map((cat) => ({ id: cat.id, name: cat.name, position: cat.position, channels: channelsByCat.get(cat.id) ?? [] }))
    .filter((cat) => cat.channels.length > 0);

  const myXp = (stat as { xp?: number } | null)?.xp ?? 0;
  const myLevel = (stat as { level?: number } | null)?.level ?? 0;
  const { count } = await db.from("chat_user_stat").select("user_id", { count: "exact", head: true }).gt("xp", myXp);

  const me: ChatMe = {
    userId,
    avatarUrl,
    level: myLevel,
    xp: myXp,
    rank: (count ?? 0) + 1,
    roles: allRoles.filter((r) => myRoleIds.has(r.id)).map(roleDto),
  };
  return { categories, me };
}

export async function getChatMessages(userId: string, channelId: number, before?: number): Promise<ChatMessage[]> {
  if (!(await canRead(userId, channelId))) throw new ChatError("forbidden", "No access to this channel.");
  const db = chatDb();
  let q = db.from("chat_message").select("*").eq("channel_id", channelId).is("deleted_at", null)
    .order("id", { ascending: false }).limit(PAGE);
  if (before && before > 0) q = q.lt("id", before);
  const { data } = await q;
  const rows = ((data ?? []) as MessageRow[]).reverse(); // ascending for display
  const authors = await enrichAuthors(rows.map((r) => r.user_id));
  const reactions = await reactionsFor(rows.map((r) => r.id), userId);
  return rows.map((r) => toMessage(r, authors, reactions, userId));
}

export type SendInput = { body?: string; imageUrl?: string | null; replyTo?: number | null };

export async function sendChatMessage(
  userId: string, channelId: number, input: SendInput,
): Promise<{ message: ChatMessage; level: number; leveledUp: boolean }> {
  const db = chatDb();
  const { data, error } = await db.rpc("send_chat_message", {
    p_user: userId, p_channel: channelId,
    p_body: input.body ?? "", p_image_url: input.imageUrl ?? null, p_reply_to: input.replyTo ?? null,
  });
  if (error) throw mapPgError(error);
  const head = (Array.isArray(data) ? data[0] : data) as { id: number; level: number; leveled_up: boolean };
  const { data: row } = await db.from("chat_message").select("*").eq("id", head.id).single();
  const authors = await enrichAuthors([userId]);
  return {
    message: toMessage(row as MessageRow, authors, new Map(), userId),
    level: head.level,
    leveledUp: head.leveled_up,
  };
}

export async function toggleChatReaction(userId: string, messageId: number, emoji: string, on: boolean): Promise<number> {
  const { data, error } = await chatDb().rpc("toggle_chat_reaction", {
    p_user: userId, p_message: messageId, p_emoji: emoji, p_on: on,
  });
  if (error) throw mapPgError(error);
  return Number(data ?? 0);
}

export async function editChatMessage(userId: string, messageId: number, body: string): Promise<void> {
  const { error } = await chatDb().rpc("edit_chat_message", { p_user: userId, p_message: messageId, p_body: body });
  if (error) throw mapPgError(error);
}

export async function deleteChatMessage(userId: string, messageId: number): Promise<void> {
  const { error } = await chatDb().rpc("delete_chat_message", { p_user: userId, p_message: messageId });
  if (error) throw mapPgError(error);
}

export async function getChatLeaderboard(viewerId: string, limit = 50): Promise<ChatLeaderboardRow[]> {
  const db = chatDb();
  const { data } = await db.from("chat_user_stat")
    .select("user_id, xp, level, message_count").order("xp", { ascending: false }).limit(limit);
  const rows = (data ?? []) as StatRow[];
  const authors = await enrichAuthors(rows.map((r) => r.user_id));
  return rows.map((r, i) => ({
    rank: i + 1, user: authorOr(authors, r.user_id), xp: r.xp, level: r.level, messageCount: r.message_count,
  }));
}

export async function getChatStarboard(viewerId: string, limit = 50): Promise<ChatMessage[]> {
  const db = chatDb();
  const { data } = await db.from("chat_message").select("*")
    .is("deleted_at", null).gte("star_count", STARBOARD_THRESHOLD)
    .order("star_count", { ascending: false }).limit(limit);
  const rows = (data ?? []) as MessageRow[];
  const authors = await enrichAuthors(rows.map((r) => r.user_id));
  const reactions = await reactionsFor(rows.map((r) => r.id), viewerId);
  return rows.map((r) => toMessage(r, authors, reactions, viewerId));
}

export async function getChatMembers(query: string, limit = 10): Promise<ChatMember[]> {
  const q = query.trim().replace(/[%_]/g, "");
  if (!q) return [];
  const { data } = await chatDb().from("profile")
    .select("user_id, username, avatar_url").ilike("username", `${q}%`).limit(limit);
  return ((data ?? []) as ProfileRow[]).map((p) => ({ id: p.user_id, username: p.username, avatarUrl: p.avatar_url }));
}

export async function getEnrichedUsers(ids: string[]): Promise<ChatAuthor[]> {
  const map = await enrichAuthors(ids);
  return [...map.values()];
}

/** Upload a chat image to the public `chat-images` bucket; returns its URL. */
export async function uploadChatImage(
  userId: string, bytes: Uint8Array, contentType: string, ext: string,
): Promise<string> {
  const safeExt = (ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${Date.now()}.${safeExt}`;
  const store = chatDb().storage.from("chat-images");
  const { error } = await store.upload(path, bytes, { contentType: contentType || "image/jpeg", upsert: false });
  if (error) throw new ChatError("internal", `Image upload failed: ${error.message}`);
  return store.getPublicUrl(path).data.publicUrl;
}

// ── Admin role management ────────────────────────────────────────────────────
export async function listChatRoles(): Promise<ChatRole[]> {
  const { data } = await chatDb().from("chat_role")
    .select("id, key, name, color, priority").order("priority", { ascending: false });
  return ((data ?? []) as RoleRow[]).map((r) => ({ id: r.id, key: r.key, name: r.name, color: r.color, priority: r.priority }));
}

export async function createChatRole(
  actorIsAdmin: boolean, input: { key: string; name: string; color: string; priority?: number },
): Promise<ChatRole> {
  if (!actorIsAdmin) throw new ChatError("forbidden", "Admins only.");
  const { data, error } = await chatDb().from("chat_role")
    .insert({ key: input.key, name: input.name, color: input.color, priority: input.priority ?? 10, assignable: true })
    .select("id, key, name, color, priority").single();
  if (error) throw new ChatError("conflict", error.message);
  const r = data as RoleRow;
  return { id: r.id, key: r.key, name: r.name, color: r.color, priority: r.priority };
}

export async function assignChatRole(actorId: string, targetId: string, roleId: number): Promise<void> {
  const { error } = await chatDb().rpc("assign_chat_role", { p_actor: actorId, p_target: targetId, p_role: roleId });
  if (error) throw mapPgError(error);
}

export async function removeChatRole(actorId: string, targetId: string, roleId: number): Promise<void> {
  const { error } = await chatDb().rpc("remove_chat_role", { p_actor: actorId, p_target: targetId, p_role: roleId });
  if (error) throw mapPgError(error);
}
