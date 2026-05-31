import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  listActiveLeagues,
  getLeagueOverview,
  type FantasyLeagueConfig,
  type LeagueOverview,
  type LeagueKind,
} from "@/lib/fantasy/leagues";
import { getPoolDetail, type PoolSummary } from "@/lib/fantasy/pools";
import { getLink } from "@/lib/fantasy/link";
import { getEntitlements } from "@/lib/fantasy/entitlements";
import { LeagueCard } from "@/components/fantasy/LeagueCard";
import { PoolCard } from "@/components/fantasy/PoolCard";
import { JoinCard, type JoinOption } from "@/components/fantasy/JoinCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leagues — Whoosh Fantasy" };

const BADGE: Record<LeagueKind, string> = {
  standard: "League",
  pickem: "Pick 'Em",
  survivor: "Survivor",
};

function blurbFor(kind: LeagueKind, capacity: number): string {
  if (kind === "pickem") return "Weekly Pick 'Em pool — make your picks on Sleeper.";
  if (kind === "survivor") return "Last team standing. One pick a week.";
  return `Head-to-head PPR · up to ${capacity} teams`;
}

type Group = {
  groupKey: string;
  kind: LeagueKind;
  leagues: FantasyLeagueConfig[];
  /** The league the member is seated in (from an active entitlement), if any. */
  mineLeagueId: string | null;
  purchasable: boolean;
};

export default async function LeaguesPage({
  searchParams,
}: {
  searchParams: Promise<{ joined?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");
  const { joined } = await searchParams;

  const [configs, link, entitlements] = await Promise.all([
    listActiveLeagues(),
    getLink(session.id).catch(() => null),
    getEntitlements(session.id).catch(() => []),
  ]);

  // Group interchangeable leagues under their shared product key.
  const byGroup = new Map<string, Group>();
  for (const c of configs) {
    const g = byGroup.get(c.groupKey) ?? {
      groupKey: c.groupKey,
      kind: c.kind,
      leagues: [],
      mineLeagueId: null,
      purchasable: (c.entryFeeCents ?? 0) > 0,
    };
    g.leagues.push(c);
    byGroup.set(c.groupKey, g);
  }
  // Resolve which concrete league (if any) the member is seated in per group.
  for (const g of byGroup.values()) {
    const season = g.leagues[0].season;
    const ent = entitlements.find(
      (e) => e.groupKey === g.groupKey && e.season === season && e.status === "active",
    );
    g.mineLeagueId = ent?.assignedLeagueId ?? null;
  }

  const groups = [...byGroup.values()];
  const leagueGroups = groups.filter((g) => g.kind === "standard");
  const poolGroups = groups.filter((g) => g.kind !== "standard");

  // Resolve the cards we actually render: entitled → full card; purchasable but
  // not entitled → a single Join card; free/legacy → full card for all leagues.
  const mineRosterId = (o: LeagueOverview): number | null =>
    link ? o.standings.find((s) => s.ownerId === link.sleeperUserId)?.rosterId ?? null : null;

  type LeagueCardData = { join: JoinOption } | { overviews: LeagueOverview[] };
  const leagueCards: LeagueCardData[] = await Promise.all(
    leagueGroups.map(async (g): Promise<LeagueCardData> => {
      const shown = visibleLeagueIds(g);
      if (shown === "join") return { join: joinOption(g) };
      const overviews = (
        await Promise.all(shown.map((id) => getLeagueOverview(id).catch(() => null)))
      ).filter((o): o is LeagueOverview => o !== null);
      return { overviews };
    }),
  );

  type PoolDetailData = NonNullable<Awaited<ReturnType<typeof getPoolDetail>>>;
  type PoolCardData = { join: JoinOption } | { summaries: PoolDetailData[] };
  const poolCards: PoolCardData[] = await Promise.all(
    poolGroups.map(async (g): Promise<PoolCardData> => {
      const shown = visibleLeagueIds(g);
      if (shown === "join") return { join: joinOption(g) };
      const summaries = (
        await Promise.all(shown.map((id) => getPoolDetail(id).catch(() => null)))
      ).filter((p): p is PoolDetailData => p !== null);
      return { summaries };
    }),
  );

  const hasLeagueContent = leagueCards.some(
    (c) => "join" in c || ("overviews" in c && c.overviews.length > 0),
  );

  return (
    <main className="ftb-page ftb-page--wide">
      <p className="text-eyebrow">Fantasy · Leagues</p>
      <h1 className="text-h1 ftb-mt-1">Whoosh leagues</h1>

      {joined && (
        <div className="card ftb-mt-lg" role="status">
          <p className="text-h3">You&apos;re in! 🎉</p>
          <p className="text-body-sm ftb-mt-sm">
            Your spot is confirmed. Open your league below to grab your Sleeper invite link.
          </p>
        </div>
      )}

      {!hasLeagueContent ? (
        <div className="card ftb-mt-lg ftb-empty">
          No leagues are set up yet. Check back once the commissioner adds them.
        </div>
      ) : (
        <div className="ftb-league-grid ftb-mt-lg">
          {leagueCards.map((c, i) =>
            "join" in c ? (
              <JoinCard key={`join-${i}`} option={c.join} />
            ) : (
              c.overviews.map((o) => (
                <LeagueCard
                  key={o.config.sleeperLeagueId}
                  overview={o}
                  mineRosterId={mineRosterId(o)}
                />
              ))
            ),
          )}
        </div>
      )}

      {poolCards.length > 0 && (
        <section className="ftb-mt-lg">
          <h2 className="text-h2 ftb-section-title">Pools</h2>
          <div className="ftb-league-grid">
            {poolCards.map((c, i) =>
              "join" in c ? (
                <JoinCard key={`pool-join-${i}`} option={c.join} />
              ) : (
                c.summaries.map((p) => (
                  <PoolCard key={p.config.sleeperLeagueId} pool={p as PoolSummary} />
                ))
              ),
            )}
          </div>
        </section>
      )}
    </main>
  );
}

/**
 * Which leagues in a group to render as full cards. "join" means show the
 * paywall card instead. Purchasable groups reveal only the seated league;
 * free/legacy groups show everything (prior behavior).
 */
function visibleLeagueIds(g: Group): string[] | "join" {
  if (!g.purchasable) return g.leagues.map((l) => l.sleeperLeagueId);
  if (g.mineLeagueId) return [g.mineLeagueId];
  return "join";
}

function joinOption(g: Group): JoinOption {
  const first = g.leagues[0];
  return {
    groupKey: g.groupKey,
    productName: first.productName?.trim() || first.name?.trim() || "Whoosh League",
    feeCents: first.entryFeeCents ?? 0,
    blurb: blurbFor(g.kind, first.capacity),
    badge: BADGE[g.kind],
    logoUrl: first.logoUrl,
  };
}
