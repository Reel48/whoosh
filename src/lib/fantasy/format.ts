import type { NflState } from "@/lib/sleeper/types";

/** Human label for the current NFL scoring period. */
export function weekLabel(state: NflState): string {
  const week = state.display_week ?? state.week;
  switch (state.season_type) {
    case "pre":
      return `Preseason · Week ${week}`;
    case "post":
      return "Playoffs";
    case "off":
      return "Offseason";
    case "regular":
    default:
      return `Week ${week}`;
  }
}

/** The week to score/display; clamps to 1 so off/pre-season never asks for week 0. */
export function currentScoringWeek(state: NflState | null): number {
  if (!state) return 1;
  const w = state.display_week ?? state.week;
  return w && w > 0 ? w : 1;
}
