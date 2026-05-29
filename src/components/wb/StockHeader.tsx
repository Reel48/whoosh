import Image from "next/image";
import type { CompanyProfile } from "@/lib/wb/profile";
import type { StockSnapshot } from "@/lib/wb/history";

type Props = {
  profile: CompanyProfile | null;
  snapshot: StockSnapshot;
};

function fmtMoney(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * The hero card on a stock detail view. Logo + symbol + company name on the
 * left, current price + day change on the right. Both come from cheap APIs
 * (Finnhub profile, Yahoo snapshot meta) so this renders without an extra
 * round-trip beyond what the page already does.
 */
export function StockHeader({ profile, snapshot }: Props) {
  const name = profile?.name ?? snapshot.longName ?? snapshot.symbol;
  const subtitle = [profile?.industry, snapshot.exchange]
    .filter(Boolean)
    .join(" · ");

  // Day change: today vs. previous candle close (more reliable than Yahoo's
  // chart-meta change which sometimes lags).
  const last = snapshot.candles[snapshot.candles.length - 1];
  const prev = snapshot.candles[snapshot.candles.length - 2];
  let dayDeltaCents: number | null = null;
  let dayDeltaPct: number | null = null;
  if (last && prev) {
    dayDeltaCents = last.closeCents - prev.closeCents;
    dayDeltaPct = (dayDeltaCents / prev.closeCents) * 100;
  }
  const positive = (dayDeltaCents ?? 0) >= 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border-2 border-ink bg-blue p-6 text-ink sm:p-8">
      <div className="flex items-center gap-5 min-w-0">
        {profile?.logoUrl ? (
          <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-2xl border-2 border-ink bg-white-smoke">
            {/* Finnhub logos can be PNG or remote — using next/image with
                unoptimized to avoid bundling/fetching weirdness. */}
            <Image
              src={profile.logoUrl}
              alt={`${name} logo`}
              width={56}
              height={56}
              unoptimized
              className="max-h-14 max-w-14 object-contain"
            />
          </div>
        ) : (
          <div className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl border-2 border-ink bg-white-smoke font-heading text-2xl font-black">
            {snapshot.symbol.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
            {snapshot.symbol}
          </div>
          <div className="truncate font-medium text-ink/90">{name}</div>
          {subtitle && (
            <div className="mt-0.5 text-xs font-bold uppercase tracking-wider text-ink/60">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <div className="text-right">
        <div className="font-heading text-4xl font-black tracking-tight tabular-nums">
          {fmtMoney(snapshot.regularMarketPriceCents ?? last?.closeCents ?? null)}
        </div>
        {dayDeltaCents != null && (
          <div
            className={`mt-1 font-heading text-base font-black tabular-nums ${
              positive ? "text-pigment-green" : "text-imperial-red"
            }`}
          >
            {positive ? "+" : ""}
            {fmtMoney(dayDeltaCents)}{" "}
            <span className="font-bold">
              ({positive ? "+" : ""}
              {dayDeltaPct!.toFixed(2)}%)
            </span>
          </div>
        )}
        <div className="mt-1 text-xs font-bold uppercase tracking-wider text-ink/60">
          Today
        </div>
      </div>
    </div>
  );
}
