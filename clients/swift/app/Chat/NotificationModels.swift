import Foundation

/// A row from the per-user notification feed (`/api/v1/wb/notifications`). Chat
/// uses the `chat_mention` and `chat_dm` kinds; `href` deep-links as
/// "chat:<channelId>:<messageId>".
struct AppNotification: Decodable, Sendable, Identifiable {
    let id: Int
    let kind: String
    let title: String
    let body: String?
    let href: String?
    let readAt: String?
    let createdAt: String
}

struct NotificationsResponse: Decodable, Sendable {
    let items: [AppNotification]
    let unread: Int
}
struct MarkReadResponse: Decodable, Sendable { let unread: Int }
struct DeviceTokenResponse: Decodable, Sendable { let ok: Bool }

/// A `notification` row as streamed by Supabase Realtime (snake_case columns).
struct NotificationRow: Decodable, Sendable {
    let id: Int
    let kind: String
    let title: String
    let body: String?
    let href: String?
    let createdAt: String

    private enum CodingKeys: String, CodingKey {
        case id, kind, title, body, href
        case createdAt = "created_at"
    }
}
