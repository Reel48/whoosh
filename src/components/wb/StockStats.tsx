import type { StockSnapshot } from "@/lib/wb/history";
import type { CompanyProfile } from "@/lib/wb/profile";

type Props = {
  snapshot: StockSnapshot;
  profile: CompanyProfile | null;
};

function fmtMoney(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
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
      value:
        profile?.shareOutstandingMillions != null
          ? fmtBigNumber(profile.shareOutstandingMillions * 1_000_000)
          : "—",
    },
    { label: "IPO", value: fmtDate(profile?.ipo ?? null) },
    { label: "Exchange", value: snapshot.exchange ?? profile?.exchange ?? "—" },
    {
      label: "Country",
      value: profile?.country ?? "—",
    },
  ];

  return (
    <div className="rounded-theme shadow-theme border-theme border-ink bg-surface p-6 sm:p-8">
      <h3 className="font-display text-xl font-bold text-ink">Key stats</h3>
      <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-xs font-bold uppercase tracking-wider text-ink/60">
              {s.label}
            </dt>
            <dd className="mt-1 font-display text-lg font-black tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      {(profile?.weburl || profile?.industry) && (
        <p className="mt-6 text-sm text-ink/60">
          {profile?.industry && <span className="font-medium">{profile.industry}</span>}
          {profile?.industry && profile?.weburl && <span> · </span>}
          {profile?.weburl && (
            <a
              href={profile.weburl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline underline-offset-2 hover:text-ink"
            >
              Company site →
            </a>
          )}
        </p>
      )}
    </div>
  );
}
