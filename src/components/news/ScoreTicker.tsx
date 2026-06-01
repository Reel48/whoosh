"use client";

import { useEffect, useState } from "react";
import type { Game } from "@/lib/news/scores";
import { formatCentral } from "@/lib/datetime";

/**
 * A thin live-scores strip pinned to the top of the news section that glides
 * continuously across the screen (ESPN-style). The track renders the games
 * twice and animates -50% so the loop is seamless; it pauses on hover. Scores
 * refresh every 45s from /api/news/scores. Renders nothing when there are no
 * games (e.g. an all-quiet day).
 */
export function ScoreTicker() {
  const [games, setGames] = useState<Game[] | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/news/scores");
        if (!r.ok) return;
        const j = (await r.json()) as { games: Game[] };
        if (alive) setGames(j.games);
      } catch {
        /* keep prior data */
      }
    }
    load();
    const id = window.setInterval(load, 45_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (!games || games.length === 0) return null;

  // Duplicate for a seamless loop; pace the glide to the amount of content.
  const loop = [...games, ...games];
  const durationS = Math.max(24, games.length * 5);

  return (
    <div className="group border-b border-ink/10 bg-white">
      <div className="mx-auto w-full max-w-6xl overflow-hidden">
        <div
          className="flex w-max group-hover:[animation-play-state:paused]"
          style={{
            animation: `news-ticker ${durationS}s linear infinite`,
          }}
        >
          {loop.map((g, i) => (
            <ScoreCard key={`${g.id}-${i}`} game={g} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamRow({ abbr, logo, score, dim }: { abbr: string; logo: string | null; score: string | null; dim: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1.5">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote ESPN logo
          <img src={logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}
        <span className={`font-display text-xs font-bold ${dim ? "text-ink/45" : "text-ink"}`}>{abbr}</span>
      </span>
      {score != null && (
        <span className={`font-display text-xs font-black tabular-nums ${dim ? "text-ink/45" : "text-ink"}`}>
          {score}
        </span>
      )}
    </div>
  );
}

function ScoreCard({ game }: { game: Game }) {
  const live = game.state === "in";
  const showScores = game.state !== "pre";
  // ESPN's pre-game status string is in Eastern; reformat the kickoff in Central.
  // Live/final details ("Q3 5:21", "Final") carry no clock time, so keep them.
  const status =
    game.state === "pre" && game.startsAt
      ? `${formatCentral(game.startsAt, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })} CT`
      : game.detail;
  // Dim the loser in finished games.
  const aNum = Number(game.away.score);
  const hNum = Number(game.home.score);
  const awayDim = game.state === "post" && hNum > aNum;
  const homeDim = game.state === "post" && aNum > hNum;

  const inner = (
    <div className="flex h-16 w-[176px] shrink-0 flex-col justify-center gap-0.5 border-r border-ink/10 px-4">
      <TeamRow {...game.away} dim={awayDim} score={showScores ? game.away.score : null} />
      <TeamRow {...game.home} dim={homeDim} score={showScores ? game.home.score : null} />
      <div className="mt-0.5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-ink/40">{game.league}</span>
        <span
          className={`flex items-center gap-1 truncate text-[10px] font-semibold ${
            live ? "text-imperial-red" : "text-ink/50"
          }`}
        >
          {live && <span className="inline-block h-1.5 w-1.5 rounded-full bg-imperial-red" />}
          {status}
        </span>
      </div>
    </div>
  );

  return game.link ? (
    <a href={game.link} target="_blank" rel="noopener noreferrer" className="transition-colors hover:bg-ink/5">
      {inner}
    </a>
  ) : (
    inner
  );
}
