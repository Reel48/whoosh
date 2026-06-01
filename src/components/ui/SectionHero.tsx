import { Bolt } from "../Bolt";
import { Avatar } from "../Avatar";

/**
 * Branded section hero — the "expressive" half of the hybrid design language.
 *
 * Each signed-in section opens with one of these vivid accent bands (Bolt +
 * hatch motif) so the Whoosh brand carries INTO the app, while everything below
 * stays on the refined, functional surface. Uses the raw chromatic ANCHOR
 * tokens (`--color-*-500`) rather than the section-remapped palette aliases, so
 * the band reads loud and on-brand inside any [data-theme] scope. Ink text on a
 * saturated block — the same contrast pairing the marketing site uses.
 */
export type HeroAccent = "volt" | "sky" | "ember" | "iris" | "forest";

const ACCENT_BG: Record<HeroAccent, string> = {
  volt: "var(--color-volt-500)",
  sky: "var(--color-sky-500)",
  ember: "var(--color-ember-500)",
  iris: "var(--color-iris-500)",
  forest: "var(--color-forest-500)",
};

export function SectionHero({
  accent = "sky",
  eyebrow,
  title,
  avatarUrl,
  username,
  aside,
}: {
  accent?: HeroAccent;
  eyebrow: string;
  title: string;
  /** When provided (with username), shows a member avatar on the left. */
  avatarUrl?: string | null;
  username?: string;
  /** Optional trailing slot — a badge, stat, or CTA. */
  aside?: React.ReactNode;
}) {
  const showAvatar = username !== undefined;
  return (
    <header
      className="relative overflow-hidden rounded-theme"
      style={{ background: ACCENT_BG[accent] }}
    >
      <div
        className="hatch pointer-events-none absolute inset-0"
        style={{ color: "rgba(0,0,0,0.10)" }}
      />
      <div className="relative flex items-center gap-4 p-7 sm:p-8">
        {showAvatar && (
          <Avatar
            avatarUrl={avatarUrl ?? null}
            username={username ?? ""}
            size={48}
            className="shrink-0 border-2 border-ink"
          />
        )}
        <div className="min-w-0 flex-1">
          <p
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-ink/70"
          >
            <Bolt className="h-3.5 w-3.5" aria-hidden="true" />
            {eyebrow}
          </p>
          <h1 className="mt-1 truncate font-display text-3xl font-black tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
    </header>
  );
}
