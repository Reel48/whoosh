import Foundation

/// Codable models for the chat surface, mirroring `src/lib/chat/types.ts`
/// (and `openapi/whoosh-v1.yaml`). The API returns camelCase JSON matching these
/// property names. Realtime rows arrive as the raw Postgres columns (snake_case)
/// and are modeled separately by the `*Row` types at the bottom.

// MARK: - API DTOs

struct ChatRole: Decodable, Sendable, Identifiable, Hashable {
    let id: Int
    let key: String
    let name: String
    let color: String
    let priority: Int
}

struct ChatChannel: Decodable, Sendable, Identifiable, Hashable {
    let id: Int
    let categoryId: Int
    let slug: String
    let name: String
    let description: String?
    /// "text" | "media" | "leaderboard" | "starboard" | "dm"
    let kind: String
    /// "members" | "admins" | "system"
    let postPolicy: String
    let requiredRoleId: Int?
    /// Whether the viewer may post here (post policy + role).
    let canPost: Bool
    /// Messages newer than the viewer's last-read mark.
    var unread: Int
    /// Timestamp of the most recent message, or nil if empty.
    let lastActivityAt: String?
}

struct ChatCategory: Decodable, Sendable, Identifiable, Hashable {
    let id: Int
    let name: String
    let position: Int
    let channels: [ChatChannel]
}

/// A message author, denormalized for display (name color = top role).
struct ChatAuthor: Decodable, Sendable, Hashable {
    let id: String
    let username: String
    let avatarUrl: String?
    let level: Int
    let roleColor: String
}

struct ChatReactionSummary: Decodable, Sendable, Hashable, Identifiable {
    let emoji: String
    var count: Int
    var mine: Bool
    var id: String { emoji }
}

struct ChatMessage: Decodable, Sendable, Identifiable, Hashable {
    let id: Int
    let channelId: Int
    var author: ChatAuthor
    var body: String
    var imageUrl: String?
    let replyToId: Int?
    var starCount: Int
    var reactions: [ChatReactionSummary]
    let mine: Bool
    let createdAt: String
    var editedAt: String?

    /// Client-only flag for optimistic sends not yet confirmed by the server.
    var pending: Bool = false

    private enum CodingKeys: String, CodingKey {
        case id, channelId, author, body, imageUrl, replyToId, starCount, reactions, mine, createdAt, editedAt
    }
}

struct ChatMe: Decodable, Sendable {
    let userId: String
    let avatarUrl: String?
    let level: Int
    let xp: Int
    let rank: Int
    let roles: [ChatRole]
}

struct ChatOverview: Decodable, Sendable {
    let categories: [ChatCategory]
    let me: ChatMe
}

struct ChatMember: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    let username: String
    let avatarUrl: String?
}

struct ChatDmConversation: Decodable, Sendable, Identifiable {
    let channelId: Int
    let other: ChatAuthor
    let lastBody: String?
    let lastAt: String?
    var unread: Int
    var id: Int { channelId }
}

struct ChatLeaderboardRow: Decodable, Sendable, Identifiable {
    let rank: Int
    let user: ChatAuthor
    let xp: Int
    let level: Int
    let messageCount: Int
    var id: String { user.id }
}

// MARK: - Response wrappers (the `data` payload of the envelope)

struct ChatMessagesResponse: Decodable, Sendable { let messages: [ChatMessage] }
struct SendChatMessageResponse: Decodable, Sendable {
    let message: ChatMessage
    let level: Int
    let leveledUp: Bool
}
struct ChatReactResponse: Decodable, Sendable { let count: Int }
struct ChatUploadResponse: Decodable, Sendable { let url: String }
struct ChatUsersResponse: Decodable, Sendable { let users: [ChatAuthor] }
struct ChatMembersResponse: Decodable, Sendable { let members: [ChatMember] }
struct ChatSearchResponse: Decodable, Sendable { let messages: [ChatMessage] }
struct ChatDmsResponse: Decodable, Sendable { let conversations: [ChatDmConversation] }
struct ChatDmOpenResponse: Decodable, Sendable { let channel: ChatChannel }
struct ChatOkResponse: Decodable, Sendable { let ok: Bool }

// MARK: - Request bodies

struct SendChatMessageBody: Encodable {
    let body: String?
    let imageUrl: String?
    let replyTo: Int?
}
struct ChatReactBody: Encodable { let emoji: String; let on: Bool }
struct ChatEditBody: Encodable { let body: String }
struct ChatReadBody: Encodable { let messageId: Int }
struct ChatDmOpenBody: Encodable { let userId: String }

// MARK: - Realtime row shapes (raw Postgres columns, snake_case)

/// A `chat_message` row as streamed by Supabase Realtime. Lacks the enriched
/// author/reactions of `ChatMessage`; the store resolves the author via the
/// `chatUsers` cache and treats reactions as empty until the next fetch.
struct ChatMessageRow: Decodable, Sendable {
    let id: Int
    let channelId: Int
    let userId: String
    let body: String
    let imageUrl: String?
    let replyToId: Int?
    let starCount: Int
    let createdAt: String
    let editedAt: String?
    let deletedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case channelId = "channel_id"
        case userId = "user_id"
        case body
        case imageUrl = "image_url"
        case replyToId = "reply_to_id"
        case starCount = "star_count"
        case createdAt = "created_at"
        case editedAt = "edited_at"
        case deletedAt = "deleted_at"
    }
}

/// A `chat_reaction` row as streamed by Supabase Realtime.
struct ChatReactionRow: Decodable, Sendable {
    let messageId: Int
    let userId: String
    let emoji: String
    let channelId: Int

    private enum CodingKeys: String, CodingKey {
        case messageId = "message_id"
        case userId = "user_id"
        case emoji
        case channelId = "channel_id"
    }
}
