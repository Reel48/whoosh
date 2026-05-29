import Image from "next/image";
import type { CompanyProfile } from "@/lib/wb/profile";
import type { StockSnapshot } from "@/lib/wb/history";

type Props = {
  profile: CompanyProfile | null;
  snapshot: StockSnapshot;
};

function fmtMoney(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Hero card on a stock detail view — Capital design system. Logo + symbol +
 * company name on the left, current price + day change (mono, green/red) on
 * the right.
 */
export function StockHeader({ profile, snapshot }: Props) {
  const name = profile?.name ?? snapshot.longName ?? snapshot.symbol;
  const subtitle = [profile?.industry, snapshot.exchange].filter(Boolean).join(" · ");

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
    <div className="card cap-stockhead">
      <div className="cap-stockhead__id">
        {profile?.logoUrl ? (
          <div className="cap-stockhead__logo">
            <Image src={profile.logoUrl} alt={`${name} logo`} width={56} height={56} unoptimized className="cap-stockhead__logoimg" />
          </div>
        ) : (
          <div className="cap-stockhead__logo cap-stockhead__logo--text">{snapshot.symbol.slice(0, 2)}</div>
        )}
        <div className="min-w-0">
          <div className="text-h2">{snapshot.symbol}</div>
          <div className="cap-stockhead__name">{name}</div>
          {subtitle && <div className="text-caption">{subtitle}</div>}
        </div>
      </div>

      <div className="cap-stockhead__price">
        <div className="cap-stockhead__last">
          {fmtMoney(snapshot.regularMarketPriceCents ?? last?.closeCents ?? null)}
        </div>
        {dayDeltaCents != null && (
          <div className="num" style={{ color: positive ? "var(--positive-text)" : "var(--negative-text)" }}>
            {positive ? "▲ +" : "▼ "}
            {fmtMoney(dayDeltaCents)} ({positive ? "+" : ""}{dayDeltaPct!.toFixed(2)}%)
          </div>
        )}
        <div className="text-caption">Today</div>
      </div>
    </div>
  );
}
