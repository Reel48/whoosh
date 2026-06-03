import SwiftUI

/// Root of the Chat tab: the accessible categories → channels, Discord-style.
/// Tapping a channel pushes the live `ChatView`.
struct ChannelsListView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ChannelsList(store: model.chatStore, notifications: model.notifications)
    }
}

private struct ChannelsList: View {
    @ObservedObject var store: ChatStore
    @ObservedObject var notifications: NotificationsStore
    @ObservedObject private var push = PushManager.shared
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            List {
                if let me = store.overview?.me {
                    Section {
                        HStack(spacing: 12) {
                            ChatAvatar(url: me.avatarUrl, name: store.myUsername, size: 40)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("@\(store.myUsername)").font(.headline)
                                Text("Level \(me.level) · Rank #\(me.rank)")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                ForEach(store.overview?.categories ?? []) { category in
                    Section(category.name.uppercased()) {
                        ForEach(category.channels) { channel in
                            NavigationLink(value: channel) {
                                ChannelRow(channel: channel, unread: store.unread(for: channel))
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Chat")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    NavigationLink { ChatSearchView(store: store) } label: {
                        Image(systemName: "magnifyingglass")
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    NavigationLink { NotificationsView(store: notifications, chat: store) } label: {
                        Image(systemName: "bell")
                            .overlay(alignment: .topTrailing) {
                                if notifications.unread > 0 {
                                    Circle().fill(.red).frame(width: 8, height: 8).offset(x: 4, y: -2)
                                }
                            }
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    NavigationLink { DMListView(store: store) } label: {
                        Image(systemName: "paperplane")
                    }
                }
            }
            .navigationDestination(for: ChatChannel.self) { channel in
                ChatView(store: store, channel: channel)
            }
            .overlay {
                if store.overview == nil { ProgressView() }
            }
            .refreshable { await store.loadOverview() }
            .task { if store.overview == nil { await store.loadOverview() } }
            .onChange(of: push.pendingDeepLink) { link in routeDeepLink(link) }
        }
    }

    /// "chat:<channelId>:<messageId>" from a tapped push → open the channel.
    private func routeDeepLink(_ link: String?) {
        guard let link, link.hasPrefix("chat:") else { return }
        let parts = link.split(separator: ":")
        guard parts.count >= 2, let channelId = Int(parts[1]),
              let channel = store.channel(byId: channelId) else { return }
        path.append(channel)
        push.pendingDeepLink = nil
    }
}

private struct ChannelRow: View {
    let channel: ChatChannel
    let unread: Int

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon).foregroundStyle(.secondary).frame(width: 20)
            Text(channel.name).fontWeight(unread > 0 ? .semibold : .regular)
            Spacer()
            if channel.requiredRoleId != nil {
                Image(systemName: "lock.fill").font(.caption2).foregroundStyle(.tertiary)
            }
            if unread > 0 {
                Text("\(unread)")
                    .font(.caption2.bold()).foregroundStyle(.white)
                    .padding(.horizontal, 7).padding(.vertical, 2)
                    .background(Color.accentColor).clipShape(Capsule())
            }
        }
    }

    private var icon: String {
        switch channel.kind {
        case "media": return "photo"
        case "leaderboard": return "trophy"
        case "starboard": return "star"
        default: return "number"
        }
    }
}
