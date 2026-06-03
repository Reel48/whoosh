import SwiftUI

/// Renders the screen for the current `AppState`. There is intentionally **no
/// marketing/landing screen** — unauthenticated users go straight to sign-in,
/// and first-time users are forced through onboarding before reaching home.
struct RootView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                ProgressView("Loading…")
                    .task { await model.bootstrap() }
            case .unauthenticated:
                AuthView()
            case .onboarding:
                OnboardingView()
            case .home:
                HomeView()
            }
        }
        .animation(.default, value: model.state)
    }
}
