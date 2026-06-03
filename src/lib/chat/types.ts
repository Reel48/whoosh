/**
 * Domain DTOs for the chat feature — the shapes the api/v1 chat routes return
 * (and the iOS client codes against). Internal DB row types live alongside but
 * are not part of the API contract.
 */

// ── Internal row shapes (untyped chat client casts to these) ─────────────────
export type CategoryRow = { id: number; name: string; position: number };
export type ChannelRow = {
  id: number;
  category_id: number;
  slug: string;
  name: string;
  description: string | null;
  kind: string;
  post_policy: string;
  required_role_id: number | null;
  is_active: boolean;
  position: number;
};
export type RoleRow = {
  id: number; key: string; name: string; color: string;
  priority: number; is_system: boolean; assignable: boolean;
};
export type MessageRow = {
  id: number; channel_id: number; user_id: string; body: string;
  image_url: string | null; reply_to_id: number | null; star_count: number;
  created_at: string; edited_at: string | null; deleted_at: string | null;
};
export type ReactionRow = { message_id: number; user_id: string; emoji: string };
export type StatRow = { user_id: string; xp: number; message_count: number; level: number };
export type ProfileRow = { user_id: string; username: string; avatar_url: string | null };

// ── API DTOs ─────────────────────────────────────────────────────────────────
export type ChatRole = {
  id: number; key: string; name: string; color: string; priority: number;
};

export type ChatChannel = {
  id: number;
  categoryId: number;
  slug: string;
  name: string;
  description: string | null;
  /** "text" | "media" | "leaderboard" | "starboard" */
  kind: string;
  /** "members" | "admins" | "system" */
  postPolicy: string;
  requiredRoleId: number | null;
  /** Whether the viewer may post here (post policy + role). */
  canPost: boolean;
};

export type ChatCategory = {
  id: number;
  name: string;
  position: number;
  channels: ChatChannel[];
};

/** A message author, denormalized for display (name color = top role). */
export type ChatAuthor = {
  id: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  roleColor: string;
};

export type ChatReactionSummary = { emoji: string; count: number; mine: boolean };

export type ChatMessage = {
  id: number;
  channelId: number;
  author: ChatAuthor;
  body: string;
  imageUrl: string | null;
  replyToId: number | null;
  starCount: number;
  reactions: ChatReactionSummary[];
  mine: boolean;
  createdAt: string;
  editedAt: string | null;
};

export type ChatMe = {
  userId: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  rank: number;
  roles: ChatRole[];
};

export type ChatOverview = { categories: ChatCategory[]; me: ChatMe };

export type ChatLeaderboardRow = {
  rank: number;
  user: ChatAuthor;
  xp: number;
  level: number;
  messageCount: number;
};

export type ChatMember = { id: string; username: string; avatarUrl: string | null };
