import Foundation

/// App configuration. None of these are secrets — the Supabase anon key is
/// publishable and the URLs are public. Fill them in from the backend env
/// (see docs/ios-getting-started.md, Step 5).
enum Config {
    /// Deployed backend origin — the OpenAPI `servers` URL. The api/v1 routes
    /// live here. For Simulator-against-dev use your Mac's LAN IP, e.g.
    /// "http://192.168.1.20:3000".
    static let apiBaseURL = URL(string: "https://REPLACE_WITH_YOUR_HOST")!

    /// Supabase project URL (NEXT_PUBLIC_SUPABASE_URL on the backend).
    static let supabaseURL = URL(string: "https://yjmohosxtemjamwrsffw.supabase.co")!

    /// Supabase publishable/anon key (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).
    /// Safe to ship in the app binary.
    static let supabaseAnonKey = "REPLACE_WITH_PUBLISHABLE_ANON_KEY"
}
