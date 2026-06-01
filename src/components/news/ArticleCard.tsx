import type { Article } from "@/lib/news/espn";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Format an RSS pubDate string; returns null if it's missing or unparseable. */
function formatDate(pubDate: string | null): string | null {
  if (!pubDate) return null;
  const t = Date.parse(pubDate);
  return Number.isNaN(t) ? null : DATE_FMT.format(new Date(t));
}

/** ESPN brand avatar — the red rounded mark with the italic wordmark. */
function EspnLogo() {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: "#d50a0a" }}
      aria-hidden="true"
    >
      <span className="font-display text-[11px] font-black italic tracking-tight text-white">
        ESPN
      </span>
    </span>
  );
}

/**
 * A single ESPN headline rendered as a social-feed post: an ESPN attribution
 * header (logo + "ESPN", then the byline author · time), the headline, a
 * summary, and any images at the bottom. The whole card links out to the
 * article on espn.com in a new tab.
 */
export function ArticleCard({ article }: { article: Article }) {
  const date = formatDate(article.pubDate);
  const byline = [article.author, date].filter(Boolean).join(" · ");
  // Show the hero image only — some articles carry a whole gallery, which would
  // bury the feed. The full set is on the linked article.
  const hero = article.images[0] ?? null;

  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-theme border-theme border-ink/10 bg-surface shadow-theme transition-colors hover:border-ink/30"
    >
      <div className="p-5">
        {/* Attribution header */}
        <header className="flex items-center gap-3">
          <EspnLogo />
          <div className="min-w-0 leading-tight">
            <p className="font-display text-sm font-bold text-ink">ESPN</p>
            {byline && <p className="truncate text-xs text-ink/55">{byline}</p>}
          </div>
        </header>

        {/* Headline + summary */}
        <h2 className="mt-3 font-display text-lg font-bold leading-snug text-ink group-hover:underline">
          {article.title}
        </h2>
        {article.description && (
          <p className="mt-2 text-sm text-ink/70">{article.description}</p>
        )}
      </div>

      {/* Hero image at the bottom, when the feed provides one */}
      {hero && (
        // Remote ESPN CDN images; plain <img> avoids next/image remotePatterns config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hero}
          alt=""
          loading="lazy"
          className="w-full border-t border-ink/10 object-cover"
        />
      )}
    </a>
  );
}
