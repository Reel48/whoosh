import Foundation
import Supabase
import Realtime

/// A live event for an open chat channel. Postgres changes (messages/reactions)
/// are RLS-authorized by the user's JWT; presence + typing ride the same channel
/// via Realtime Presence/Broadcast (ephemeral, no DB writes).
enum ChatRealtimeEvent: Sendable {
    case messageInserted(ChatMessageRow)
    case messageUpdated(ChatMessageRow)   // edits, soft-deletes (deletedAt set), star_count
    case reactionChanged(messageId: Int)  // a reaction was added or removed
    case presence(Set<String>)            // user ids currently online in the channel
    case typing(userId: String, username: String, isTyping: Bool)
}

/// Subscribes to `chat_message` + `chat_reaction` changes for a single channel,
/// plus presence + typing, and surfaces them as an `AsyncStream`. One instance
/// per open channel; call `stop()` (or drop it) when leaving.
///
/// NOTE: supabase-swift's RealtimeV2 method names shift between minor versions.
/// If the build complains, reconcile `postgresChange`/`presenceChange`/
/// `broadcastStream`/`track`/`broadcast`/`subscribe` against the installed version
/// — the shapes here match supabase-swift 2.x. Presence/typing channels are keyed
/// by channelId; to make them strictly private, enable Realtime Authorization
/// (RLS on `realtime.messages`) — optional at this scale.
final class ChatRealtime {
    private let client: SupabaseClient
    private let channelId: Int
    private let decoder: JSONDecoder
    private var channel: RealtimeChannelV2?
    private var pumps: [Task<Void, Never>] = []

    init(client: SupabaseClient = SupabaseAuth.shared.client, channelId: Int) {
        self.client = client
        self.channelId = channelId
        self.decoder = JSONDecoder()
    }

    func start() -> AsyncStream<ChatRealtimeEvent> {
        AsyncStream { continuation in
            let ch = client.realtimeV2.channel("chat:\(channelId)")
            self.channel = ch
            let filter = "channel_id=eq.\(channelId)"

            let inserts = ch.postgresChange(InsertAction.self, schema: "public", table: "chat_message", filter: filter)
            let updates = ch.postgresChange(UpdateAction.self, schema: "public", table: "chat_message", filter: filter)
            let reactionIns = ch.postgresChange(InsertAction.self, schema: "public", table: "chat_reaction", filter: filter)
            let reactionDel = ch.postgresChange(DeleteAction.self, schema: "public", table: "chat_reaction", filter: filter)
            let presence = ch.presenceChange()
            let typing = ch.broadcastStream(event: "typing")

            let dec = decoder
            pumps = [
                Task { for await a in inserts {
                    if let row = try? a.decodeRecord(as: ChatMessageRow.self, decoder: dec) {
                        continuation.yield(.messageInserted(row))
                    }
                } },
                Task { for await a in updates {
                    if let row = try? a.decodeRecord(as: ChatMessageRow.self, decoder: dec) {
                        continuation.yield(.messageUpdated(row))
                    }
                } },
                Task { for await a in reactionIns {
                    if let row = try? a.decodeRecord(as: ChatReactionRow.self, decoder: dec) {
                        continuation.yield(.reactionChanged(messageId: row.messageId))
                    }
                } },
                Task { for await a in reactionDel {
                    if let row = try? a.decodeOldRecord(as: ChatReactionRow.self, decoder: dec) {
                        continuation.yield(.reactionChanged(messageId: row.messageId))
                    }
                } },
                Task { for await _ in presence {
                    // Re-read the full presence state on every join/leave.
                    let ids = Set(ch.presenceState().keys)
                    continuation.yield(.presence(ids))
                } },
                Task { for await message in typing {
                    if let p = TypingPayload(message) {
                        continuation.yield(.typing(userId: p.userId, username: p.username, isTyping: p.typing))
                    }
                } },
            ]

            continuation.onTermination = { [weak self] _ in self?.stop() }
            Task { await ch.subscribe() }
        }
    }

    /// Announce this user as present in the channel.
    func track(userId: String) async {
        guard let ch = channel else { return }
        try? await ch.track(state: ["user_id": .string(userId)])
    }

    /// Broadcast a typing start/stop to the other members.
    func sendTyping(_ isTyping: Bool, userId: String, username: String) async {
        guard let ch = channel else { return }
        try? await ch.broadcast(event: "typing", message: [
            "user_id": .string(userId), "username": .string(username), "typing": .bool(isTyping),
        ])
    }

    func stop() {
        pumps.forEach { $0.cancel() }
        pumps.removeAll()
        if let ch = channel {
            channel = nil
            Task { await client.realtimeV2.removeChannel(ch) }
        }
    }

    deinit { stop() }
}

/// Decodes a `typing` broadcast payload from the loosely-typed JSON message.
private struct TypingPayload {
    let userId: String
    let username: String
    let typing: Bool

    init?(_ message: JSONObject) {
        guard case let .string(uid)? = message["user_id"],
              case let .string(name)? = message["username"] else { return nil }
        userId = uid
        username = name
        if case let .bool(t)? = message["typing"] { typing = t } else { typing = true }
    }
}
