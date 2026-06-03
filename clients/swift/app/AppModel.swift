import Foundation

/// The app's top-level state. `RootView` renders one screen per case.
enum AppState: Equatable {
    case loading           // checking for an existing session
    case unauthenticated   // show sign-in (no marketing screen)
    case onboarding        // signed in but profile not yet created
    case home              // fully set up
}

/// Owns auth + the API client and decides which screen to show. The whole
/// "skip the marketing page / force first-run onboarding" behavior lives here.
@MainActor
final class AppModel: ObservableObject {
    @Published private(set) var state: AppState = .loading
    @Published var currentUsername: String = ""

    let auth = SupabaseAuth.shared
    lazy var api = WhooshAPI(token: { [auth] in await auth.accessToken() })

    /// Decide the initial screen: no session → sign in; session → ask the
    /// backend whether onboarding is done.
    func bootstrap() async {
        guard await auth.hasSession() else { state = .unauthenticated; return }
        await resolveFromAccount()
    }

    /// Called by AuthView after a successful sign-in / sign-up.
    func didAuthenticate() async {
        state = .loading
        await resolveFromAccount()
    }

    /// Called by OnboardingView once the profile is created.
    func didFinishOnboarding() { state = .home }

    func signOut() async {
        try? await auth.signOut()
        currentUsername = ""
        state = .unauthenticated
    }

    private func resolveFromAccount() async {
        do {
            let account = try await api.account()
            currentUsername = account.username
            state = account.onboarded ? .home : .onboarding
        } catch let e as APIError where e.code == "unauthorized" {
            state = .unauthenticated     // token rejected/expired → re-auth
        } catch {
            // Network hiccup, etc. Fall back to sign-in so the user isn't stuck.
            state = .unauthenticated
        }
    }
}
