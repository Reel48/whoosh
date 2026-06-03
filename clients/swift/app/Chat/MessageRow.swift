import SwiftUI

/// A single message: avatar, author (tinted by top role) + level, body, optional
/// image, reply preview, and the reaction summary. Long-press exposes quick
/// reactions, reply, and (for your own / admin) edit + delete via a context menu.
struct MessageRow: View {
    let message: ChatMessage
    /// Body of the message this one replies to, if shown in-list (best-effort).
    let replyPreview: ChatMessage?
    var onReact: (String) -> Void
    var onMoreReactions: () -> Void
    var onReply: () -> Void
    var onEdit: () -> Void
    var onDelete: () -> Void

    /// A compact, friendly default reaction set (Phase 7 adds a full picker).
    static let quickReactions = ["👍", "❤️", "😂", "🔥", "⭐", "🎉"]

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            ChatAvatar(url: message.author.avatarUrl, name: message.author.username, size: 36)
            VStack(alignment: .leading, spacing: 3) {
                header
                if let reply = replyPreview { replyBanner(reply) }
                if !message.body.isEmpty {
                    Text(message.body).font(.body)
                }
                if let url = message.imageUrl, let u = URL(string: url) {
                    AsyncImage(url: u) { phase in
                        (phase.image ?? Image(systemName: "photo")).resizable().scaledToFit()
                    }
                    .frame(maxWidth: 240, maxHeight: 240)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                reactionBar
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
        .opacity(message.pending ? 0.6 : 1)
        .contextMenu { menu }
    }

    private var header: some View {
        HStack(spacing: 6) {
            Text(message.author.username)
                .font(.subheadline.bold())
                .foregroundStyle(Color(hex: message.author.roleColor))
            Text("Lv \(message.author.level)")
                .font(.caption2).foregroundStyle(.secondary)
            Text(ChatTime.short(message.createdAt))
                .font(.caption2).foregroundStyle(.tertiary)
            if message.editedAt != nil {
                Text("(edited)").font(.caption2).foregroundStyle(.tertiary)
            }
        }
    }

    private func replyBanner(_ reply: ChatMessage) -> some View {
        HStack(spacing: 4) {
            Image(systemName: "arrowshape.turn.up.left.fill").font(.caption2)
            Text(reply.author.username).font(.caption2.bold())
            Text(reply.body).font(.caption2).lineLimit(1)
        }
        .foregroundStyle(.secondary)
        .padding(.leading, 6)
        .overlay(alignment: .leading) { Rectangle().frame(width: 2).foregroundStyle(.tertiary) }
    }

    private var reactionBar: some View {
        HStack(spacing: 6) {
            ForEach(message.reactions) { r in
                Button { onReact(r.emoji) } label: {
                    HStack(spacing: 3) {
                        Text(r.emoji)
                        Text("\(r.count)").font(.caption2.monospacedDigit())
                            .contentTransition(.numericText())
                    }
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(r.mine ? Color.accentColor.opacity(0.2) : Color.gray.opacity(0.12))
                    .overlay(Capsule().stroke(r.mine ? Color.accentColor : .clear, lineWidth: 1))
                    .clipShape(Capsule())
                    .scaleEffect(r.mine ? 1.06 : 1)
                }
                .buttonStyle(.plain)
                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: r.mine)
                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: r.count)
            }
            Button { onMoreReactions() } label: {
                Image(systemName: "face.smiling").font(.caption)
                    .padding(.horizontal, 7).padding(.vertical, 3)
                    .background(Color.gray.opacity(0.12)).clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .transition(.scale.combined(with: .opacity))
    }

    @ViewBuilder private var menu: some View {
        ControlGroup {
            ForEach(Self.quickReactions, id: \.self) { e in
                Button(e) { onReact(e) }
            }
        }
        Button { onMoreReactions() } label: { Label("More reactions…", systemImage: "face.smiling") }
        Button { onReply() } label: { Label("Reply", systemImage: "arrowshape.turn.up.left") }
        if message.mine {
            Button { onEdit() } label: { Label("Edit", systemImage: "pencil") }
        }
        if message.mine {
            Button(role: .destructive) { onDelete() } label: { Label("Delete", systemImage: "trash") }
        }
    }
}
