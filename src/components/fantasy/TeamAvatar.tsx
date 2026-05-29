import Image from "next/image";

/**
 * Small round team/league avatar. Falls back to a monogram disc when Sleeper
 * has no avatar for the team. Sleeper thumbs are served from sleeper.app
 * (whitelisted in next.config.ts).
 */
export function TeamAvatar({
  url,
  name,
  size = 28,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full border-2 border-ink object-cover"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white-smoke font-display font-bold"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  );
}
