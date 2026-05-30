import Image from "next/image";

/** Deterministic team accent from the Whoosh chromatic anchors (for logos
 *  without a custom image). Same name → same color. */
const PALETTE = ["#0381ED", "#FC7B00", "#009640", "#AE78D2", "#FF0C31", "#0269C2", "#674580", "#C66200"];
export function teamAccent(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/**
 * Inner logo content for the design-system `.logo` / `.matchup__logo` wrappers
 * (which set size, radius, and centering). Renders the uploaded image if any,
 * otherwise a colored monogram. Pass the DS wrapper class via `className`.
 */
export function TeamLogo({
  url,
  name,
  className,
}: {
  url: string | null;
  name: string;
  className: string;
}) {
  if (url) {
    return (
      <span className={className}>
        <Image src={url} alt="" width={48} height={48} unoptimized className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className={className} style={{ background: teamAccent(name) }}>
      {initial(name)}
    </span>
  );
}

/**
 * Standalone rounded-square team/league avatar (used in cards and headers,
 * where there's no DS wrapper class). Uploaded image or colored monogram.
 */
export function TeamAvatar({
  url,
  name,
  size = 32,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  const radius = Math.round(size * 0.3);
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="shrink-0 object-cover"
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-grid shrink-0 place-items-center font-display font-extrabold text-white"
      style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.42, background: teamAccent(name) }}
    >
      {initial(name)}
    </span>
  );
}
