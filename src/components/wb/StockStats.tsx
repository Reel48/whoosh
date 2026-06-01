import type { StockSnapshot } from "@/lib/wb/history";
import type { CompanyProfile } from "@/lib/wb/profile";

type Props = {
  snapshot: StockSnapshot;
  profile: CompanyProfile | null;
};

function fmtMoney(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtBigDollars(dollars: number | null): string {
  if (dollars == null || !Number.isFinite(dollars)) return "—";
  if (dollars >= 1e12) return `$${(dollars / 1e12).toFixed(2)}T`;
  if (dollars >= 1e9) return `$${(dollars / 1e9).toFixed(2)}B`;
  if (dollars >= 1e6) return `$${(dollars / 1e6).toFixed(2)}M`;
  return `$${dollars.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtBigNumber(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "America/Chicago" });
}

export function StockStats({ snapshot, profile }: Props) {
  const stats: { label: string; value: string }[] = [
    { label: "Day high", value: fmtMoney(snapshot.regularMarketDayHighCents) },
    { label: "Day low", value: fmtMoney(snapshot.regularMarketDayLowCents) },
    { label: "52-week high", value: fmtMoney(snapshot.fiftyTwoWeekHighCents) },
    { label: "52-week low", value: fmtMoney(snapshot.fiftyTwoWeekLowCents) },
    { label: "Volume", value: fmtBigNumber(snapshot.regularMarketVolume) },
    { label: "Market cap", value: fmtBigDollars(profile?.marketCap ?? null) },
    {
      label: "Shares outstanding",
      value: profile?.shareOutstandingMillions != null ? fmtBigNumber(profile.shareOutstandingMillions * 1_000_000) : "—",
    },
    { label: "IPO", value: fmtDate(profile?.ipo ?? null) },
    { label: "Exchange", value: snapshot.exchange ?? profile?.exchange ?? "—" },
    { label: "Country", value: profile?.country ?? "—" },
  ];

  return (
    <div className="card">
      <h3 className="text-h3">Key stats</h3>
      <dl className="cap-stats cap-mt">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="kpi__label">{s.label}</dt>
            <dd className="num cap-stats__val">{s.value}</dd>
          </div>
        ))}
      </dl>

      {(profile?.weburl || profile?.industry) && (
        <p className="text-body-sm cap-mt">
          {profile?.industry && <span>{profile.industry}</span>}
          {profile?.industry && profile?.weburl && <span> · </span>}
          {profile?.weburl && (
            <a href={profile.weburl} target="_blank" rel="noopener noreferrer" className="cap-link">
              Company site →
            </a>
          )}
        </p>
      )}
    </div>
  );
}
