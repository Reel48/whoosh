import SwiftUI

/// A categorized emoji grid for reacting to a message. Presented as a sheet from
/// the message's "more reactions" affordance; calls `onPick` with the chosen emoji.
struct ReactionPicker: View {
    var onPick: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    private let columns = Array(repeating: GridItem(.adaptive(minimum: 44)), count: 6)

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    ForEach(Self.groups, id: \.title) { group in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(group.title.uppercased())
                                .font(.caption2).foregroundStyle(.secondary)
                            LazyVGrid(columns: columns, spacing: 8) {
                                ForEach(group.emojis, id: \.self) { e in
                                    Button { onPick(e); dismiss() } label: {
                                        Text(e).font(.system(size: 30))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Add Reaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Close") { dismiss() } }
        }
        .presentationDetents([.medium, .large])
    }

    private struct Group { let title: String; let emojis: [String] }
    private static let groups: [Group] = [
        Group(title: "Popular", emojis: ["👍", "❤️", "😂", "🔥", "⭐", "🎉", "😮", "😢", "🙏", "👀", "💯", "👏"]),
        Group(title: "Smileys", emojis: ["😀", "😅", "😍", "😎", "🤔", "😏", "😭", "😡", "🥳", "🤩", "😴", "🤯"]),
        Group(title: "Gestures", emojis: ["👋", "🤙", "✌️", "🤝", "💪", "🙌", "👊", "🫡", "🤞", "👌", "🫶", "🖐️"]),
        Group(title: "Sports", emojis: ["🏈", "⚾️", "🏀", "⚽️", "🎾", "⛳️", "🥊", "🏆", "🥇", "🎯", "🏒", "🏐"]),
        Group(title: "Misc", emojis: ["💰", "📈", "📉", "🚀", "✅", "❌", "⚡️", "🍻", "🎮", "🎵", "📺", "🤑"]),
    ]
}
