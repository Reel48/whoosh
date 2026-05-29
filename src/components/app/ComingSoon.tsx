import { Bolt } from "@/components/Bolt";

/**
 * Themed placeholder for sections that don't have content yet (Fantasy, Pool).
 * Inherits the surrounding section's [data-theme] scope, so the display font,
 * border weight, radius, and shadow all match the section's personality while
 * drawing from the shared palette.
 */
export function ComingSoon({
  eyebrow,
  title,
  blurb,
  bullets,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
  bullets: string[];
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <div className="rounded-theme border-theme border-ink/10 bg-surface p-8 text-center shadow-theme sm:p-12">
        <Bolt className="mx-auto h-10 w-10 text-ink" />
        <p className="mt-6 text-xs font-display font-bold uppercase tracking-[0.28em] text-ink/50">
          {eyebrow}
        </p>
        <h1 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-lg font-medium text-ink/70">
          {blurb}
        </p>

        <span className="mt-8 inline-flex items-center gap-2 rounded-full border-theme border-ink bg-ink px-5 py-2 text-sm font-bold text-white">
          Coming soon
        </span>

        <ul className="mx-auto mt-10 grid max-w-md gap-3 text-left">
          {bullets.map((b) => (
            <li
              key={b}
              className="flex items-start gap-3 rounded-theme border-theme border-ink/10 bg-surface p-4"
            >
              <Bolt className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
              <span className="font-medium text-ink/80">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
