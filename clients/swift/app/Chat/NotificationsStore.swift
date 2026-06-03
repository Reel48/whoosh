import Foundation
import Supabase
import Realtime

/// Owns the in-app notification feed: initial load, the unread badge count, and a
/// live Realtime subscription so new @mentions / DMs surface instantly. Lives for
/// the session; `start(userId:)` is idempotent.
@MainActor
final class NotificationsStore: ObservableObject {
    @Published private(set) var items: [AppNotification] = []
    @Published private(set) var unread: Int = 0

    private let api: WhooshAPI
    private let client: SupabaseClient
    private var channel: RealtimeChannelV2?
    private var pump: Task<Void, Never>?
    private var started = false

    init(api: WhooshAPI, client: SupabaseClient = SupabaseAuth.shared.client) {
        self.api = api
        self.client = client
    }

    func start(userId: String) {
        guard !started, !userId.isEmpty else { return }
        started = true
        Task { await reload() }
        subscribe(userId: userId)
    }

    func reload() async {
        if let r = try? await api.notifications() {
            items = r.items
            unread = r.unread
        }
    }

    func markAllRead() async {
        unread = 0
        unread = (try? await api.markNotificationsRead()) ?? 0
    }

    private func subscribe(userId: String) {
        let ch = client.realtimeV2.channel("notifications:\(userId)")
        channel = ch
        let inserts = ch.postgresChange(InsertAction.self, schema: "public", table: "notification",
                                        filter: "discord_user_id=eq.\(userId)")
        let dec = JSONDecoder()
        pump = Task { [weak self] in
            for await action in inserts {
                guard let row = try? action.decodeRecord(as: NotificationRow.self, decoder: dec) else { continue }
                await self?.prepend(row)
            }
        }
        Task { await ch.subscribe() }
    }

    private func prepend(_ row: NotificationRow) {
        items.insert(AppNotification(id: row.id, kind: row.kind, title: row.title,
                                     body: row.body, href: row.href, readAt: nil,
                                     createdAt: row.createdAt), at: 0)
        unread += 1
    }

    deinit { pump?.cancel(); if let ch = channel { Task { await client.realtimeV2.removeChannel(ch) } } }
}
