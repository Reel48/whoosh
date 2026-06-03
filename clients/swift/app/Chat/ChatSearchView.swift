import SwiftUI

/// Full-text message search across every channel the viewer can read. A result
/// deep-links into its channel (when it's a known, non-DM channel).
struct ChatSearchView: View {
    @ObservedObject var store: ChatStore
    @State private var query = ""
    @State private var results: [ChatMessage] = []
    @State private var searchTask: Task<Void, Never>?
    @State private var target: ChatChannel?

    var body: some View {
        List(results) { msg in
            row(msg)
        }
        .listStyle(.plain)
        .searchable(text: $query, prompt: "Search messages")
        .onChange(of: query) { q in debounce(q) }
        .overlay {
            if !query.isEmpty && results.isEmpty {
                ContentUnavailableViewCompat(text: "No matches")
            }
        }
        .navigationTitle("Search")
        .navigationDestination(isPresented: Binding(get: { target != nil }, set: { if !$0 { target = nil } })) {
            if let target { ChatView(store: store, channel: target) }
        }
    }

    @ViewBuilder private func row(_ msg: ChatMessage) -> some View {
        let channel = store.channel(byId: msg.channelId)
        Button {
            if let channel { target = channel }
        } label: {
            HStack(alignment: .top, spacing: 10) {
                ChatAvatar(url: msg.author.avatarUrl, name: msg.author.username, size: 32)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(msg.author.username).font(.subheadline.bold())
                        if let channel {
                            Text("#\(channel.name)").font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                    Text(msg.body).font(.subheadline).lineLimit(2)
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(store.channel(byId: msg.channelId) == nil)
    }

    private func debounce(_ q: String) {
        searchTask?.cancel()
        let trimmed = q.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 2 else { results = []; return }
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            results = (try? await store.search(trimmed)) ?? []
        }
    }
}

/// Minimal stand-in for `ContentUnavailableView` (iOS 17+) so this builds on 16.
private struct ContentUnavailableViewCompat: View {
    let text: String
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "magnifyingglass").font(.largeTitle).foregroundStyle(.secondary)
            Text(text).foregroundStyle(.secondary)
        }
    }
}
