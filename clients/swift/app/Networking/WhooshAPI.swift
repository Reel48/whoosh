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
