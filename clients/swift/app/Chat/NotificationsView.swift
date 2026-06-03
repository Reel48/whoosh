import SwiftUI

/// In-app notification inbox. New @mentions / DMs stream in live via
/// `NotificationsStore`; tapping a chat notification deep-links to its channel.
struct NotificationsView: View {
    @ObservedObject var store: NotificationsStore
    @ObservedObject var chat: ChatStore
    @State private var target: ChatChannel?

    var body: some View {
        List(store.items) { n in
            Button { open(n) } label: { row(n) }
                .buttonStyle(.plain)
        }
        .overlay { if store.items.isEmpty { Text("No notifications yet.").foregroundStyle(.secondary) } }
        .navigationTitle("Notifications")
        .toolbar { Button("Mark read") { Task { await store.markAllRead() } } }
        .navigationDestination(isPresented: Binding(get: { target != nil }, set: { if !$0 { target = nil } })) {
            if let target { ChatView(store: chat, channel: target) }
        }
        .task { await store.markAllRead() }   // opening the inbox clears the badge
    }

    private func row(_ n: AppNotification) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon(n.kind)).foregroundStyle(Color.accentColor).frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(n.title).font(.subheadline.bold())
                if let body = n.body, !body.isEmpty {
                    Text(body).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                }
            }
            Spacer()
            if n.readAt == nil { Circle().fill(Color.accentColor).frame(width: 8, height: 8) }
        }
    }

    private func icon(_ kind: String) -> String {
        switch kind {
        case "chat_mention": return "at"
        case "chat_dm": return "paperplane.fill"
        default: return "bell.fill"
        }
    }

    /// href is "chat:<channelId>:<messageId>" — open the channel when we know it.
    private func open(_ n: AppNotification) {
        guard let href = n.href, href.hasPrefix("chat:") else { return }
        let parts = href.split(separator: ":")
        guard parts.count >= 2, let channelId = Int(parts[1]) else { return }
        if let channel = chat.channel(byId: channelId) { target = channel }
    }
}
