import SwiftUI
import UserNotifications

/// Bridges APNs registration into the app. The `PushAppDelegate` receives the
/// device token from the system; `PushManager` holds it and (once the API is
/// ready) registers it with the backend. Tapping a chat push deep-links via the
/// shared `pendingDeepLink`.
@MainActor
final class PushManager: ObservableObject {
    static let shared = PushManager()

    /// Latest APNs device token (hex), set by the app delegate.
    @Published private(set) var deviceToken: String?
    /// "chat:<channelId>:<messageId>" from a tapped notification, consumed by the UI.
    @Published var pendingDeepLink: String?

    private var api: WhooshAPI?

    /// Called once the session is ready; registers any token we already have.
    func configure(api: WhooshAPI) {
        self.api = api
        if let token = deviceToken { Task { await register(token) } }
    }

    func setToken(_ token: String) {
        deviceToken = token
        Task { await register(token) }
    }

    private func register(_ token: String) async {
        guard let api else { return }
        try? await api.registerDeviceToken(token)
    }

    /// Ask for permission and register with APNs (call after sign-in).
    func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            guard granted else { return }
            Task { @MainActor in UIApplication.shared.registerForRemoteNotifications() }
        }
    }
}

/// Minimal app delegate: forwards the APNs token and notification taps to `PushManager`.
final class PushAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { @MainActor in PushManager.shared.setToken(hex) }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Non-fatal: in-app notifications still work without push.
    }

    // Show banners while the app is foregrounded.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }

    // Handle a tap → stash the deep link for the UI to route.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse) async {
        if let href = response.notification.request.content.userInfo["href"] as? String {
            await MainActor.run { PushManager.shared.pendingDeepLink = href }
        }
    }
}
