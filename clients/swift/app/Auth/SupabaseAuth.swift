import Foundation
import Supabase

/// Thin wrapper over supabase-swift. Owns the `SupabaseClient`, which persists
/// and refreshes the session (JWT) in the Keychain for us. The rest of the app
/// only needs: is there a session, the access token, and sign-in/out actions.
///
/// NOTE: supabase-swift's exact method names shift between major versions. If the
/// build complains here, a Claude Code session in the iOS repo can reconcile
/// these few calls against your installed version.
final class SupabaseAuth: Sendable {
    static let shared = SupabaseAuth()

    let client: SupabaseClient

    private init() {
        client = SupabaseClient(supabaseURL: Config.supabaseURL,
                                supabaseKey: Config.supabaseAnonKey)
    }

    /// Current access token (the bearer the API client sends), or nil if signed out.
    func accessToken() async -> String? {
        try? await client.auth.session.accessToken
    }

    func hasSession() async -> Bool {
        (try? await client.auth.session) != nil
    }

    func signInEmail(_ email: String, password: String) async throws {
        try await client.auth.signIn(email: email, password: password)
    }

    /// Returns true if a session is active immediately (email confirmation off);
    /// false means "check your email to confirm" before a session exists.
    @discardableResult
    func signUpEmail(_ email: String, password: String) async throws -> Bool {
        let response = try await client.auth.signUp(email: email, password: password)
        return response.session != nil
    }

    /// Sign in with Apple. Pass the identity token + nonce from
    /// `ASAuthorizationAppleIDCredential` (see AuthView). Requires the Apple
    /// provider enabled in the Supabase dashboard + the Sign in with Apple
    /// capability in Xcode.
    func signInWithApple(idToken: String, nonce: String) async throws {
        try await client.auth.signInWithIdToken(
            credentials: .init(provider: .apple, idToken: idToken, nonce: nonce)
        )
    }

    func signOut() async throws {
        try await client.auth.signOut()
    }
}
