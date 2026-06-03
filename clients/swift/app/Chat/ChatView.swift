import SwiftUI
import PhotosUI

/// A live channel: paginated history that auto-scrolls on new messages, plus a
/// composer with text, image attach, @reply, and reactions. Realtime keeps it in
/// sync; sends are optimistic.
struct ChatView: View {
    @ObservedObject var store: ChatStore
    let channel: ChatChannel

    @State private var draft = ""
    @State private var replyTo: ChatMessage?
    @State private var editing: ChatMessage?
    @State private var editText = ""
    @State private var deleting: ChatMessage?
    @State private var reactingTo: ChatMessage?
    @State private var photoItem: PhotosPickerItem?
    @State private var mentionResults: [ChatMember] = []
    @State private var mentionTask: Task<Void, Never>?
    @FocusState private var composerFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            messageList
            typingIndicator
            Divider()
            if channel.canPost { composer } else { readOnlyNotice }
        }
        .animation(.default, value: store.typingNames)
        .navigationTitle(channel.name)
        .navigationBarTitleDisplayMode(.inline)
        .task { await store.open(channel) }
        .onDisappear { store.leave() }
        .alert("Edit message", isPresented: editingBinding) {
            TextField("Message", text: $editText)
            Button("Cancel", role: .cancel) { editing = nil }
            Button("Save") {
                if let m = editing { Task { await store.edit(messageId: m.id, body: editText) } }
                editing = nil
            }
        }
        .sheet(item: $reactingTo) { msg in
            ReactionPicker { emoji in
                Task { await store.toggleReaction(messageId: msg.id, emoji: emoji) }
            }
        }
        .confirmationDialog("Delete this message?", isPresented: deletingBinding, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let m = deleting { Task { await store.delete(messageId: m.id) } }
                deleting = nil
            }
            Button("Cancel", role: .cancel) { deleting = nil }
        }
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    if !store.reachedStart {
                        ProgressView().frame(maxWidth: .infinity).padding(.vertical, 8)
                            .task { await store.loadOlder() }
                    }
                    ForEach(store.messages) { msg in
                        if msg.id == store.unreadBoundaryId {
                            HStack {
                                VStack { Divider() }
                                Text("NEW").font(.caption2.bold()).foregroundStyle(.red)
                                VStack { Divider() }
                            }
                            .padding(.horizontal)
                        }
                        MessageRow(
                            message: msg,
                            replyPreview: msg.replyToId.flatMap { id in store.messages.first { $0.id == id } },
                            onReact: { emoji in Task { await store.toggleReaction(messageId: msg.id, emoji: emoji) } },
                            onMoreReactions: { reactingTo = msg },
                            onReply: { replyTo = msg; composerFocused = true },
                            onEdit: { editing = msg; editText = msg.body },
                            onDelete: { deleting = msg }
                        )
                        .id(msg.id)
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical, 8)
            }
            .onChange(of: store.messages.last?.id) { last in
                guard let last else { return }
                withAnimation { proxy.scrollTo(last, anchor: .bottom) }
            }
        }
    }

    @ViewBuilder private var typingIndicator: some View {
        if !store.typingNames.isEmpty {
            HStack(spacing: 6) {
                ProgressView().scaleEffect(0.6)
                Text(typingText).font(.caption).foregroundStyle(.secondary)
                Spacer()
            }
            .padding(.horizontal).padding(.bottom, 2)
            .transition(.opacity)
        }
    }

    private var typingText: String {
        let names = store.typingNames
        switch names.count {
        case 1: return "\(names[0]) is typing…"
        case 2: return "\(names[0]) and \(names[1]) are typing…"
        default: return "Several people are typing…"
        }
    }

    @ViewBuilder private var mentionBar: some View {
        if !mentionResults.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(mentionResults) { m in
                        Button { insertMention(m.username) } label: {
                            HStack(spacing: 6) {
                                ChatAvatar(url: m.avatarUrl, name: m.username, size: 24)
                                Text(m.username).font(.subheadline)
                            }
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Color.gray.opacity(0.12)).clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal)
            }
        }
    }

    private var composer: some View {
        VStack(spacing: 6) {
            mentionBar
            if let replyTo {
                HStack(spacing: 6) {
                    Image(systemName: "arrowshape.turn.up.left.fill").font(.caption)
                    Text("Replying to \(replyTo.author.username)").font(.caption).lineLimit(1)
                    Spacer()
                    Button { self.replyTo = nil } label: { Image(systemName: "xmark.circle.fill") }
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal)
            }
            HStack(spacing: 10) {
                PhotosPicker(selection: $photoItem, matching: .images) {
                    Image(systemName: "photo.on.rectangle").font(.title3)
                }
                TextField("Message #\(channel.name)", text: $draft, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...5)
                    .focused($composerFocused)
                    .onChange(of: draft) { _ in
                        if !draft.isEmpty { store.userIsTyping() }
                        updateMentionSearch()
                    }
                Button { Task { await sendDraft() } } label: {
                    Image(systemName: "arrow.up.circle.fill").font(.title2)
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(.horizontal).padding(.vertical, 6)
        }
        .onChange(of: photoItem) { item in
            guard let item else { return }
            Task { await sendPhoto(item) }
        }
    }

    private var readOnlyNotice: some View {
        Text("You don't have permission to post here.")
            .font(.footnote).foregroundStyle(.secondary)
            .frame(maxWidth: .infinity).padding()
    }

    private func sendDraft() async {
        let body = draft
        let reply = replyTo?.id
        draft = ""; replyTo = nil
        await store.send(body: body, replyTo: reply)
    }

    private func sendPhoto(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else { return }
        let body = draft; let reply = replyTo?.id
        draft = ""; replyTo = nil; photoItem = nil
        await store.send(body: body, imageData: data, replyTo: reply)
    }

    /// The trailing "@token" the user is currently typing, if any.
    private var mentionPrefix: String? {
        guard let range = draft.range(of: "@[A-Za-z0-9_]{1,20}$", options: .regularExpression) else { return nil }
        return String(draft[range].dropFirst())
    }

    private func updateMentionSearch() {
        mentionTask?.cancel()
        guard let prefix = mentionPrefix else { mentionResults = []; return }
        mentionTask = Task {
            try? await Task.sleep(nanoseconds: 200_000_000)
            guard !Task.isCancelled else { return }
            mentionResults = (try? await store.searchMembers(prefix)) ?? []
        }
    }

    private func insertMention(_ username: String) {
        if let range = draft.range(of: "@[A-Za-z0-9_]{1,20}$", options: .regularExpression) {
            draft.replaceSubrange(range, with: "@\(username) ")
        }
        mentionResults = []
    }

    private var editingBinding: Binding<Bool> {
        Binding(get: { editing != nil }, set: { if !$0 { editing = nil } })
    }
    private var deletingBinding: Binding<Bool> {
        Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } })
    }
}
