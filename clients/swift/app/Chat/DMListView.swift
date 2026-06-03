import SwiftUI

/// Direct-message inbox: conversations sorted by recency, plus a "new message"
/// flow that searches members and opens a 1:1. Tapping a conversation pushes the
/// same live `ChatView` used for channels (DMs are just private channels).
struct DMListView: View {
    @ObservedObject var store: ChatStore
    @State private var startingNew = false
    @State private var target: ChatChannel?

    var body: some View {
        List {
            ForEach(store.dms) { dm in
                Button { Task { await open(userId: dm.other.id) } } label: {
                    DMRow(dm: dm)
                }
                .buttonStyle(.plain)
            }
            if store.dms.isEmpty {
                Text("No conversations yet.").foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Messages")
        .toolbar {
            Button { startingNew = true } label: { Image(systemName: "square.and.pencil") }
        }
        .navigationDestination(isPresented: Binding(get: { target != nil }, set: { if !$0 { target = nil } })) {
            if let target { ChatView(store: store, channel: target) }
        }
        .sheet(isPresented: $startingNew) {
            NewDMView(store: store) { channel in
                startingNew = false
                target = channel
            }
        }
        .refreshable { await store.loadDms() }
        .task { await store.loadDms() }
    }

    private func open(userId: String) async {
        if let channel = await store.openDirect(with: userId) { target = channel }
    }
}

private struct DMRow: View {
    let dm: ChatDmConversation
    var body: some View {
        HStack(spacing: 12) {
            ChatAvatar(url: dm.other.avatarUrl, name: dm.other.username, size: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(dm.other.username).font(.headline)
                Text(dm.lastBody ?? "Say hello 👋").font(.subheadline)
                    .foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            if dm.unread > 0 {
                Text("\(dm.unread)").font(.caption2.bold()).foregroundStyle(.white)
                    .padding(.horizontal, 7).padding(.vertical, 2)
                    .background(Color.accentColor).clipShape(Capsule())
            }
        }
    }
}

/// Username search → start a DM. Reuses the @mention member endpoint.
private struct NewDMView: View {
    @ObservedObject var store: ChatStore
    var onOpen: (ChatChannel) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [ChatMember] = []
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            List(results) { member in
                Button { Task { await open(member) } } label: {
                    HStack(spacing: 12) {
                        ChatAvatar(url: member.avatarUrl, name: member.username, size: 36)
                        Text(member.username)
                    }
                }
                .buttonStyle(.plain)
            }
            .searchable(text: $query, prompt: "Search people")
            .onChange(of: query) { q in debounceSearch(q) }
            .navigationTitle("New Message")
            .toolbar { Button("Cancel") { dismiss() } }
        }
    }

    private func debounceSearch(_ q: String) {
        searchTask?.cancel()
        let trimmed = q.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { results = []; return }
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            results = (try? await store.searchMembers(trimmed)) ?? []
        }
    }

    private func open(_ member: ChatMember) async {
        if let channel = await store.openDirect(with: member.id) {
            dismiss(); onOpen(channel)
        }
    }
}
