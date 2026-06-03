import SwiftUI

/// App entry point. Owns the single `AppModel` and hands it to the view tree.
@main
struct WhooshApp: App {
    @StateObject private var model = AppModel()
    @UIApplicationDelegateAdaptor(PushAppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
        }
    }
}
