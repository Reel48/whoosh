import Foundation

/// Owns chat state for the signed-in user: the channel list (overview), the
/// currently-open channel's messages, the Realtime subscription lifecycle, and
/// optimistic sends. One instance lives for the chat tab.
@MainActor
final class ChatStore: ObservableObject {
    @Published private(set) var overview: ChatOverview?
    @Published private(set) var dms: [ChatDmConversation] = []
    @Published private(set) var messages: [ChatMessage] = []
    @Published private(set) var loadingOlder = false
    @Published private(set) var reachedStart = false
    @Published var error: String?
    /// Local unread overrides (channelId → count) so badges clear instantly when
    /// a channel is opened, ahead of the next overview refresh.
    @Published private(set) var unreadOverride: [Int: Int] = [:]

    /// Id of the first unread message in the open channel, for the "new messages"
    /// divider. Nil when the channel was already caught up.
    private(set) var unreadBoundaryId: Int?

    /// Presence + typing for the open channel.
    @Published private(set) var onlineUserIds: Set<String> = []
    @Published private(set) var typingNames: [String] = []

    /// The viewer's handle + id (from AppModel) — for optimistic sends + presence.
    var myUsername: String = ""
    var myUserId: String = ""

    private let api: WhooshAPI
    private var authorCache: [String: ChatAuthor] = [:]
    private(set) var currentChannel: ChatChannel?

    private var realtime: ChatRealtime?
    private var pump: Task<Void, Never>?
    private var reactionReconcile: Task<Void, Never>?
    private var typingUsers: [String: String] = [:]            // userId → username
    private var typingTimers: [String: Task<Void, Never>] = [:] // auto-expire stale typers
    private var typingSendTask: Task<Void, Never>?
    private var lastTypingSentAt: Date?

    init(api: WhooshAPI) { self.api = api }

    // MARK: Overview

    func loadOverview() async {
        do { overview = try await api.chatOverview() }
        catch let e as APIError { error = e.message }
        catch { error = error.localizedDescription }
    }

    // MARK: Direct messages

    func loadDms() async {
        do { dms = try await api.chatDms() }
        catch let e as APIError { error = e.message }
        catch { error = error.localizedDescription }
    }

    /// @mention / new-DM people search by username prefix.
    func searchMembers(_ query: String) async throws -> [ChatMember] {
        try await api.chatMembers(query: query)
    }

    /// Open (or create) a DM and return its channel for navigation.
    func openDirect(with userId: String) async -> ChatChannel? {
        do { return try await api.openDm(userId: userId) }
        catch let e as APIError { error = e.message; return nil }
        catch { error = error.localizedDescription; return nil }
    }

    private var myAuthor: ChatAuthor {
        let me = overview?.me
        let color = (me?.roles.max(by: { $0.priority < $1.priority })?.color) ?? "#9aa0a6"
        return ChatAuthor(id: me?.userId ?? "", username: myUsername,
                          avatarUrl: me?.avatarUrl, level: me?.level ?? 0, roleColor: color)
    }

    // MARK: Open / leave a channel

    func open(_ channel: ChatChannel) async {
        leave()
        currentChannel = channel
        messages = []
        reachedStart = false
        unreadBoundaryId = nil
        let unread = unreadOverride[channel.id] ?? channel.unread
        do {
            let page = try await api.chatMessages(channelId: channel.id)
            cacheAuthors(page)
            messages = page
            reachedStart = page.count < 50
            // First unread = the (count - unread)th message, when it's on this page.
            if unread > 0, page.count >= unread {
                unreadBoundaryId = page[page.count - unread].id
            }
        } catch let e as APIError { error = e.message }
        catch { error = error.localizedDescription }
        subscribe(channelId: channel.id)
        await realtime?.track(userId: myUserId)
        await markReadLatest()
    }

    /// Advance the read mark to the newest real message and clear the badge.
    func markReadLatest() async {
        guard let channel = currentChannel, let last = messages.last(where: { $0.id > 0 }) else { return }
        unreadOverride[channel.id] = 0
        try? await api.markChatRead(channelId: channel.id, messageId: last.id)
    }

    func unread(for channel: ChatChannel) -> Int { unreadOverride[channel.id] ?? channel.unread }

    /// Resolve a (non-DM) channel from the loaded overview, e.g. for a search result.
    func channel(byId id: Int) -> ChatChannel? {
        overview?.categories.flatMap(\.channels).first { $0.id == id }
    }

    func search(_ query: String, channelId: Int? = nil) async throws -> [ChatMessage] {
        try await api.chatSearch(query: query, channelId: channelId)
    }

    func leave() {
        pump?.cancel(); pump = nil
        reactionReconcile?.cancel(); reactionReconcile = nil
        typingSendTask?.cancel(); typingSendTask = nil
        typingTimers.values.forEach { $0.cancel() }; typingTimers.removeAll()
        typingUsers.removeAll(); typingNames = []; onlineUserIds = []
        realtime?.stop(); realtime = nil
        currentChannel = nil
    }

    // MARK: Typing

    /// Call as the composer text changes. Throttles a "typing" broadcast and
    /// schedules a "stopped" after a short idle.
    func userIsTyping() {
        let now = Date()
        if lastTypingSentAt == nil || now.timeIntervalSince(lastTypingSentAt!) > 2 {
            lastTypingSentAt = now
            Task { await realtime?.sendTyping(true, userId: myUserId, username: myUsername) }
        }
        typingSendTask?.cancel()
        typingSendTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            guard !Task.isCancelled, let self else { return }
            self.lastTypingSentAt = nil
            await self.realtime?.sendTyping(false, userId: self.myUserId, username: self.myUsername)
        }
    }

    private func setTyping(userId: String, username: String, isTyping: Bool) {
        guard userId != myUserId else { return }
        typingTimers[userId]?.cancel()
        if isTyping {
            typingUsers[userId] = username
            typingTimers[userId] = Task { [weak self] in
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                guard !Task.isCancelled else { return }
                self?.typingUsers[userId] = nil
                self?.recomputeTyping()
            }
        } else {
            typingUsers[userId] = nil
        }
        recomputeTyping()
    }

    private func recomputeTyping() { typingNames = Array(typingUsers.values).sorted() }

    func loadOlder() async {
        guard !loadingOlder, !reachedStart, let channel = currentChannel,
              let oldest = messages.first?.id else { return }
        loadingOlder = true
        defer { loadingOlder = false }
        do {
            let older = try await api.chatMessages(channelId: channel.id, before: oldest)
            cacheAuthors(older)
            if older.isEmpty { reachedStart = true } else { messages.insert(contentsOf: older, at: 0) }
        } catch { /* keep current view; transient */ }
    }

    // MARK: Sending

    func send(body: String, imageData: Data? = nil, replyTo: Int? = nil) async {
        guard let channel = currentChannel else { return }
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty || imageData != nil else { return }

        // Optimistic placeholder with a temporary negative id.
        let tempId = -Int(Date().timeIntervalSince1970 * 1000)
        let temp = ChatMessage(
            id: tempId, channelId: channel.id, author: myAuthor, body: trimmed,
            imageUrl: nil, replyToId: replyTo, starCount: 0, reactions: [], mine: true,
            createdAt: ISO8601DateFormatter().string(from: Date()), editedAt: nil, pending: true)
        messages.append(temp)

        do {
            var imageUrl: String?
            if let imageData { imageUrl = try await api.uploadChatImage(imageData: imageData) }
            let result = try await api.sendChatMessage(
                channelId: channel.id, body: trimmed.isEmpty ? nil : trimmed,
                imageUrl: imageUrl, replyTo: replyTo)
            replaceTemp(tempId, with: result.message)
        } catch let e as APIError {
            error = e.message
            messages.removeAll { $0.id == tempId }
        } catch {
            self.error = error.localizedDescription
            messages.removeAll { $0.id == tempId }
        }
    }

    private func replaceTemp(_ tempId: Int, with message: ChatMessage) {
        cacheAuthors([message])
        // The Realtime echo may have already inserted the confirmed row.
        if let dup = messages.firstIndex(where: { $0.id == message.id }) {
            messages.remove(at: dup)
        }
        if let i = messages.firstIndex(where: { $0.id == tempId }) {
            messages[i] = message
        } else {
            insertSorted(message)
        }
    }

    // MARK: Reactions / edit / delete

    func toggleReaction(messageId: Int, emoji: String) async {
        guard let i = messages.firstIndex(where: { $0.id == messageId }) else { return }
        let currentlyMine = messages[i].reactions.first(where: { $0.emoji == emoji })?.mine ?? false
        applyReaction(at: i, emoji: emoji, on: !currentlyMine)   // optimistic
        do { _ = try await api.toggleReaction(messageId: messageId, emoji: emoji, on: !currentlyMine) }
        catch { applyReaction(at: i, emoji: emoji, on: currentlyMine) }   // revert
    }

    private func applyReaction(at i: Int, emoji: String, on: Bool) {
        var reactions = messages[i].reactions
        if let j = reactions.firstIndex(where: { $0.emoji == emoji }) {
            reactions[j].mine = on
            reactions[j].count = max(0, reactions[j].count + (on ? 1 : -1))
            if reactions[j].count == 0 { reactions.remove(at: j) }
        } else if on {
            reactions.append(ChatReactionSummary(emoji: emoji, count: 1, mine: true))
        }
        messages[i].reactions = reactions
    }

    func edit(messageId: Int, body: String) async {
        do {
            try await api.editChatMessage(messageId: messageId, body: body)
            if let i = messages.firstIndex(where: { $0.id == messageId }) {
                messages[i].body = body
                messages[i].editedAt = ISO8601DateFormatter().string(from: Date())
            }
        } catch let e as APIError { error = e.message }
        catch { error = error.localizedDescription }
    }

    func delete(messageId: Int) async {
        do {
            try await api.deleteChatMessage(messageId: messageId)
            messages.removeAll { $0.id == messageId }
        } catch let e as APIError { error = e.message }
        catch { error = error.localizedDescription }
    }

    // MARK: Realtime

    private func subscribe(channelId: Int) {
        let rt = ChatRealtime(channelId: channelId)
        realtime = rt
        let stream = rt.start()
        pump = Task { [weak self] in
            for await event in stream {
                await self?.handle(event)
            }
        }
    }

    private func handle(_ event: ChatRealtimeEvent) async {
        switch event {
        case .messageInserted(let row):
            guard row.channelId == currentChannel?.id else { return }
            if row.deletedAt != nil { return }
            if messages.contains(where: { $0.id == row.id }) { return }
            let author = await author(for: row.userId)
            insertSorted(message(from: row, author: author))
            await markReadLatest()   // user is looking at the channel
        case .messageUpdated(let row):
            guard let i = messages.firstIndex(where: { $0.id == row.id }) else { return }
            if row.deletedAt != nil { messages.remove(at: i); return }
            messages[i].body = row.body
            messages[i].imageUrl = row.imageUrl
            messages[i].editedAt = row.editedAt
            messages[i].starCount = row.starCount
        case .reactionChanged:
            scheduleReactionReconcile()
        case .presence(let ids):
            onlineUserIds = ids
        case .typing(let userId, let username, let isTyping):
            setTyping(userId: userId, username: username, isTyping: isTyping)
        }
    }

    /// Reactions stream only carries ids; refetch the visible page to get exact
    /// counts/`mine` flags. Coalesced so a burst of toggles triggers one refetch.
    private func scheduleReactionReconcile() {
        reactionReconcile?.cancel()
        reactionReconcile = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard !Task.isCancelled, let self, let channel = self.currentChannel else { return }
            if let fresh = try? await self.api.chatMessages(channelId: channel.id) {
                let byId = Dictionary(uniqueKeysWithValues: fresh.map { ($0.id, $0) })
                for i in self.messages.indices {
                    if let f = byId[self.messages[i].id] {
                        self.messages[i].reactions = f.reactions
                        self.messages[i].starCount = f.starCount
                    }
                }
            }
        }
    }

    // MARK: Helpers

    private func insertSorted(_ message: ChatMessage) {
        let idx = messages.firstIndex(where: { $0.id > message.id }) ?? messages.endIndex
        messages.insert(message, at: idx)
    }

    private func message(from row: ChatMessageRow, author: ChatAuthor) -> ChatMessage {
        ChatMessage(id: row.id, channelId: row.channelId, author: author, body: row.body,
                    imageUrl: row.imageUrl, replyToId: row.replyToId, starCount: row.starCount,
                    reactions: [], mine: author.id == overview?.me.userId,
                    createdAt: row.createdAt, editedAt: row.editedAt)
    }

    private func cacheAuthors(_ msgs: [ChatMessage]) {
        for m in msgs { authorCache[m.author.id] = m.author }
    }

    private func author(for userId: String) async -> ChatAuthor {
        if let cached = authorCache[userId] { return cached }
        if let fetched = try? await api.chatUsers(ids: [userId]).first {
            authorCache[userId] = fetched
            return fetched
        }
        return ChatAuthor(id: userId, username: "unknown", avatarUrl: nil, level: 0, roleColor: "#9aa0a6")
    }
}
