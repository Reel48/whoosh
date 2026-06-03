import Foundation

/// Thrown when the API returns a `{ ok: false, error }` envelope or a transport
/// error. Switch on `code` (stable) — e.g. show a "handle taken" message on
/// `"conflict"`, or sign the user out on `"unauthorized"`.
struct APIError: Error, Sendable {
    let code: String
    let message: String
    static let unknown = APIError(code: "unknown", message: "Something went wrong.")
}

/// Hand-rolled client for the Whoosh `api/v1` surface. Injects the bearer token
/// (from Supabase) and `X-Client: ios` on every request, and unwraps the
/// `{ ok, data }` envelope. The whole app talks to the backend through this one
/// type — swap it for the generated OpenAPI client later without touching views.
actor WhooshAPI {
    private let baseURL: URL
    private let session: URLSession
    /// Supplies the current access token (or nil when signed out).
    private let token: @Sendable () async -> String?

    init(baseURL: URL = Config.apiBaseURL,
         token: @escaping @Sendable () async -> String?) {
        self.baseURL = baseURL
        self.token = token
        self.session = .shared
    }

    // MARK: Public calls (one method per screen need)

    func account() async throws -> Account {
        try await get("/api/v1/account")
    }

    func home() async throws -> Home {
        try await get("/api/v1/home")
    }

    func usernameAvailable(_ handle: String) async throws -> UsernameAvailability {
        let q = handle.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return try await get("/api/v1/account/username-available?handle=\(q)")
    }

    func setUsername(_ username: String) async throws -> ProfileResult {
        try await post("/api/v1/account/profile", body: SetUsernameBody(username: username))
    }

    /// Multipart upload of a profile photo (JPEG/PNG bytes).
    func uploadAvatar(imageData: Data, fileName: String = "avatar.jpg",
                      mimeType: String = "image/jpeg") async throws -> AvatarResult {
        var req = try await request("POST", "/api/v1/account/avatar")
        let boundary = "Boundary-\(UUID().uuidString)"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        body.append("--\(boundary)\r\n")
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n")
        body.append("Content-Type: \(mimeType)\r\n\r\n")
        body.append(imageData)
        body.append("\r\n--\(boundary)--\r\n")
        req.httpBody = body
        return try await send(req)
    }

    /// Get a hosted Stripe checkout/portal URL to open in the browser
    /// (External Purchase Link). `path` is e.g. "/api/v1/wb/buy".
    func checkoutURL(path: String, body: some Encodable) async throws -> URL {
        struct R: Decodable { let url: String }
        let r: R = try await post(path, body: body)
        guard let u = URL(string: r.url) else { throw APIError.unknown }
        return u
    }

    // MARK: Chat

    func chatOverview() async throws -> ChatOverview {
        try await get("/api/v1/chat/overview")
    }

    /// Newest page (or older page when `before` is set). Returns oldest→newest.
    func chatMessages(channelId: Int, before: Int? = nil) async throws -> [ChatMessage] {
        var path = "/api/v1/chat/channels/\(channelId)/messages"
        if let before { path += "?before=\(before)" }
        let r: ChatMessagesResponse = try await get(path)
        return r.messages
    }

    func sendChatMessage(channelId: Int, body: String?, imageUrl: String? = nil,
                         replyTo: Int? = nil) async throws -> SendChatMessageResponse {
        try await post("/api/v1/chat/channels/\(channelId)/messages",
                       body: SendChatMessageBody(body: body, imageUrl: imageUrl, replyTo: replyTo))
    }

    /// Older page (`before`) or, for "jump to unread", the oldest page above a
    /// mark (`after`). Returns oldest→newest.
    func chatMessages(channelId: Int, after: Int) async throws -> [ChatMessage] {
        let r: ChatMessagesResponse = try await get("/api/v1/chat/channels/\(channelId)/messages?after=\(after)")
        return r.messages
    }

    /// Advance the viewer's last-read mark for a channel.
    func markChatRead(channelId: Int, messageId: Int) async throws {
        let _: ChatOkResponse = try await post("/api/v1/chat/channels/\(channelId)/read",
                                               body: ChatReadBody(messageId: messageId))
    }

    /// Toggle a reaction; returns the emoji's new count.
    @discardableResult
    func toggleReaction(messageId: Int, emoji: String, on: Bool) async throws -> Int {
        let r: ChatReactResponse = try await post("/api/v1/chat/messages/\(messageId)/react",
                                                  body: ChatReactBody(emoji: emoji, on: on))
        return r.count
    }

    func editChatMessage(messageId: Int, body: String) async throws {
        let _: ChatOkResponse = try await patch("/api/v1/chat/messages/\(messageId)",
                                                body: ChatEditBody(body: body))
    }

    func deleteChatMessage(messageId: Int) async throws {
        let _: ChatOkResponse = try await delete("/api/v1/chat/messages/\(messageId)")
    }

    /// Multipart upload of a chat image; returns its public URL.
    func uploadChatImage(imageData: Data, fileName: String = "image.jpg",
                         mimeType: String = "image/jpeg") async throws -> String {
        var req = try await request("POST", "/api/v1/chat/upload")
        let boundary = "Boundary-\(UUID().uuidString)"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        body.append("--\(boundary)\r\n")
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n")
        body.append("Content-Type: \(mimeType)\r\n\r\n")
        body.append(imageData)
        body.append("\r\n--\(boundary)--\r\n")
        req.httpBody = body
        let r: ChatUploadResponse = try await send(req)
        return r.url
    }

    /// Enrich a set of user ids for the realtime author cache.
    func chatUsers(ids: [String]) async throws -> [ChatAuthor] {
        guard !ids.isEmpty else { return [] }
        let q = ids.joined(separator: ",").addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let r: ChatUsersResponse = try await get("/api/v1/chat/users?ids=\(q)")
        return r.users
    }

    /// @mention picker: profiles by username prefix.
    func chatMembers(query: String) async throws -> [ChatMember] {
        let q = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let r: ChatMembersResponse = try await get("/api/v1/chat/members?q=\(q)")
        return r.members
    }

    /// Full-text search over messages the viewer can read.
    func chatSearch(query: String, channelId: Int? = nil) async throws -> [ChatMessage] {
        let q = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        var path = "/api/v1/chat/search?q=\(q)"
        if let channelId { path += "&channelId=\(channelId)" }
        let r: ChatSearchResponse = try await get(path)
        return r.messages
    }

    /// The viewer's DM conversations (most recent first).
    func chatDms() async throws -> [ChatDmConversation] {
        let r: ChatDmsResponse = try await get("/api/v1/chat/dms")
        return r.conversations
    }

    /// Open or create the 1:1 DM with another user; returns it as a channel.
    func openDm(userId: String) async throws -> ChatChannel {
        let r: ChatDmOpenResponse = try await post("/api/v1/chat/dms", body: ChatDmOpenBody(userId: userId))
        return r.channel
    }

    // MARK: Notifications (shared feed; chat uses chat_mention / chat_dm kinds)

    func notifications() async throws -> NotificationsResponse {
        try await get("/api/v1/wb/notifications")
    }

    @discardableResult
    func markNotificationsRead() async throws -> Int {
        struct Empty: Encodable {}
        let r: MarkReadResponse = try await post("/api/v1/wb/notifications", body: Empty())
        return r.unread
    }

    /// Register this device's APNs token for push notifications.
    func registerDeviceToken(_ token: String) async throws {
        struct Body: Encodable { let token: String; let platform = "ios" }
        let _: DeviceTokenResponse = try await post("/api/v1/account/device-token", body: Body(token: token))
    }

    // MARK: Plumbing

    private func get<T: Decodable>(_ path: String) async throws -> T {
        try await send(try await request("GET", path))
    }

    private func post<T: Decodable>(_ path: String, body: some Encodable) async throws -> T {
        var req = try await request("POST", path)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(body)
        return try await send(req)
    }

    private func patch<T: Decodable>(_ path: String, body: some Encodable) async throws -> T {
        var req = try await request("PATCH", path)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(body)
        return try await send(req)
    }

    private func delete<T: Decodable>(_ path: String) async throws -> T {
        try await send(try await request("DELETE", path))
    }

    private func request(_ method: String, _ path: String) async throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: baseURL) else { throw APIError.unknown }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("ios", forHTTPHeaderField: "X-Client")   // per-client capability gating
        if let t = await token() { req.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization") }
        return req
    }

    private func send<T: Decodable>(_ req: URLRequest) async throws -> T {
        let (data, _) = try await session.data(for: req)
        let envelope = try JSONDecoder().decode(Envelope<T>.self, from: data)
        if envelope.ok, let value = envelope.data { return value }
        throw envelope.error.map { APIError(code: $0.code, message: $0.message) } ?? .unknown
    }
}

private extension Data {
    mutating func append(_ s: String) { append(Data(s.utf8)) }
}
