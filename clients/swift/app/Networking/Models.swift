import Foundation

/// Codable models mirroring `openapi/whoosh-v1.yaml`. Intentionally PARTIAL:
/// `JSONDecoder` ignores keys we don't declare, so we model only the fields the
/// scaffold screens render. The API returns camelCase JSON, matching these
/// property names (no key conversion needed).

// MARK: - Envelope

/// Every response is `{ ok, data }` on success or `{ ok, error }` on failure.
struct Envelope<T: Decodable>: Decodable {
    let ok: Bool
    let data: T?
    let error: APIErrorBody?
}

struct APIErrorBody: Decodable, Sendable {
    let code: String     // stable, switch on this (e.g. "conflict", "unauthorized")
    let message: String  // human-readable, safe to show
}

// MARK: - Account / profile

struct Account: Decodable, Sendable {
    let id: String
    let username: String
    let avatarUrl: String?
    let onboarded: Bool
}

struct UsernameAvailability: Decodable, Sendable {
    let available: Bool
    let normalized: String
    let reason: String?
}

struct ProfileResult: Decodable, Sendable {
    let id: String
    let username: String
    let avatarUrl: String?
    let onboarded: Bool
}

struct AvatarResult: Decodable, Sendable {
    let avatarUrl: String
}

// MARK: - Home (aggregate; partial)

struct Home: Decodable, Sendable {
    let sections: [HomeSection]
    let topArticle: TopArticle?
}

struct HomeSection: Decodable, Sendable, Identifiable {
    let key: String
    let label: String
    let tagline: String
    let live: Bool
    var id: String { key }
}

struct TopArticle: Decodable, Sendable {
    let title: String
    let link: String
}

// MARK: - Request bodies

struct SetUsernameBody: Encodable { let username: String }
