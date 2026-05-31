/**
 * User avatar. Renders the profile's avatar image when one is set (e.g. a linked
 * Discord avatar URL), otherwise a deterministic initials circle derived from
 * the username — so email-only members without a Discord avatar still get a
 * stable, colorful badge. Server-renderable.
 */

const PALETTE = [
  "#2563eb", "#16a34a", "#dc2626", "#7c3aed",
  "#ea580c", "#0891b2", "#db2777", "#ca8a04",
];

function initials(username: string): string {
  const trimmed = username.trim().replace(/^@/, "");
  if (!trimmed) return "?";
  const parts = trimmed.split(/[\s_.-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

function colorFor(username: string): string {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function Avatar({
  username,
  avatarUrl,
  size = 32,
  className = "",
}: {
  username: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={username}
        width={size}
        height={size}
        className={`rounded-full ${className}`}
      />
    );
  }
  return (
    <span
      aria-label={username}
      className={`inline-flex items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: colorFor(username),
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initials(username)}
    </span>
  );
}
