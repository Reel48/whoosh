import SwiftUI

/// Small shared helpers for the chat UI: role-color parsing, avatars, and time
/// formatting. Kept separate so the view files stay focused on layout.

extension Color {
    /// Parse a `#rrggbb` (or `#rgb`) hex string; falls back to a neutral gray.
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet(charactersIn: "# ")).uppercased()
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        switch s.count {
        case 6:
            self.init(red: Double((v >> 16) & 0xff) / 255,
                      green: Double((v >> 8) & 0xff) / 255,
                      blue: Double(v & 0xff) / 255)
        case 3:
            self.init(red: Double((v >> 8) & 0xf) / 15,
                      green: Double((v >> 4) & 0xf) / 15,
                      blue: Double(v & 0xf) / 15)
        default:
            self.init(red: 0.60, green: 0.63, blue: 0.65)
        }
    }
}

/// Round avatar: remote image when available, deterministic initials otherwise.
struct ChatAvatar: View {
    let url: String?
    let name: String
    var size: CGFloat = 36

    var body: some View {
        Group {
            if let url, let u = URL(string: url) {
                AsyncImage(url: u) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() }
                    else { initials }
                }
            } else {
                initials
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var initials: some View {
        ZStack {
            Circle().fill(Self.palette[abs(name.hashValue) % Self.palette.count])
            Text(String(name.first.map(String.init)?.uppercased() ?? "?"))
                .font(.system(size: size * 0.44, weight: .semibold))
                .foregroundStyle(.white)
        }
    }

    private static let palette: [Color] = [
        Color(hex: "#2563eb"), Color(hex: "#16a34a"), Color(hex: "#dc2626"),
        Color(hex: "#7c3aed"), Color(hex: "#ea580c"), Color(hex: "#0891b2"),
        Color(hex: "#db2777"), Color(hex: "#ca8a04"),
    ]
}

enum ChatTime {
    private static let parser = ISO8601DateFormatter()
    private static let clock: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "h:mm a"; return f
    }()

    /// Short clock time (e.g. "3:42 PM") for a message timestamp.
    static func short(_ iso: String) -> String {
        guard let d = parser.date(from: iso) ?? withFractional(iso) else { return "" }
        return clock.string(from: d)
    }

    private static func withFractional(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: iso)
    }
}
