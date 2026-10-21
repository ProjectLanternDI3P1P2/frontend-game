/**
 * Pure rules of the ranking page (F02). No framework, no I/O. The shared
 * presentation rules stay in `leaderboardRules.ts` (F00).
 */
import {
  HERO_CLASS_LABELS,
  RANKING_PERIOD_LABELS,
  RankDeltaDirection,
  formatRankDelta,
  podiumMedal,
  type RankingUrlState,
} from "./leaderboardRules";
import {
  RankingPeriod,
  RankingSort,
  type RankingEntry,
  type RankingQuery,
} from "./types";

/** Display name of the seeded demo player (D5), used before any hero is ranked. */
export const DEMO_PLAYER_NAME = "MaelisRune";

/** Debounce of the display-name search, in milliseconds. */
export const SEARCH_DEBOUNCE_MS = 300;

/** A stable key for a query: two equal queries give the same key. */
export function rankingQueryKey(query: RankingQuery): string {
  return JSON.stringify([
    query.playerId,
    query.heroClass,
    query.period,
    query.search,
    query.sort,
    query.page,
    query.pageSize,
  ]);
}

// ------------------------------------------------------------------ empty

export enum EmptyReason {
  /** Nobody is ranked over the period. */
  NOBODY_RANKED = "nobody-ranked",
  /** Heroes are ranked, but none matches the class filter or the search. */
  NO_MATCH = "no-match",
}

/** True when the class filter or the search narrows the ranking. */
export function hasNarrowingFilters(
  state: Pick<RankingQuery, "heroClass" | "search">,
): boolean {
  return state.heroClass !== null || state.search.trim() !== "";
}

export function emptyReason(
  state: Pick<RankingQuery, "heroClass" | "search">,
): EmptyReason {
  return hasNarrowingFilters(state) ? EmptyReason.NO_MATCH : EmptyReason.NOBODY_RANKED;
}

/** The state once the class filter and the search are cleared (back to page 1). */
export function clearedFilters(state: RankingUrlState): RankingUrlState {
  return { ...state, heroClass: null, search: "", page: 1 };
}

/**
 * The new state after a control changes: any change but the page itself goes
 * back to page 1.
 */
export function withChange(
  state: RankingUrlState,
  change: Partial<RankingUrlState>,
): RankingUrlState {
  const next = { ...state, ...change };
  const onlyPage = Object.keys(change).every((key) => key === "page");
  return onlyPage ? next : { ...next, page: 1 };
}

// ------------------------------------------------------------------ labels

export function periodLabel(
  period: RankingPeriod,
  seasonLabel?: string | null,
): string {
  if (period === RankingPeriod.SEASON && seasonLabel?.trim()) return seasonLabel.trim();
  return RANKING_PERIOD_LABELS[period];
}

/** "Ranking · Warrior · Season 3". */
export function rankingTitle(
  state: Pick<RankingQuery, "heroClass" | "period">,
  seasonLabel?: string | null,
): string {
  const heroClass = state.heroClass
    ? HERO_CLASS_LABELS[state.heroClass]
    : "All classes";
  return `Ranking · ${heroClass} · ${periodLabel(state.period, seasonLabel)}`;
}

/** "1 hero ranked", "220 heroes ranked". */
export function rankedCountLabel(totalCount: number): string {
  const count = Math.max(0, Math.trunc(totalCount) || 0);
  return `${count.toLocaleString("en-GB")} ${count === 1 ? "hero" : "heroes"} ranked`;
}

export function pageCount(totalCount: number, pageSize: number): number {
  if (!(pageSize > 0) || !(totalCount > 0)) return 1;
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

/** "10 of 220 · page 1 of 22". */
export function paginationSummary(
  shown: number,
  totalCount: number,
  page: number,
  pageSize: number,
): string {
  const total = Math.max(0, totalCount);
  return `${shown} of ${total} · page ${page} of ${pageCount(total, pageSize)}`;
}

/** The page holding a rank when the ranking is neither filtered nor re-sorted. */
export function pageOfRank(rank: number, pageSize: number): number {
  if (!(rank > 0) || !(pageSize > 0)) return 1;
  return Math.ceil(rank / pageSize);
}

/** True when the page order is the plain rank order (rank = position). */
export function isPlainRankOrder(
  state: Pick<RankingQuery, "heroClass" | "search" | "sort">,
): boolean {
  return state.sort === RankingSort.TOTAL_XP && !hasNarrowingFilters(state);
}

const TREND_NAMES: Record<RankDeltaDirection, (places: number) => string> = {
  [RankDeltaDirection.UP]: (places) =>
    `Up ${places} ${places === 1 ? "place" : "places"}`,
  [RankDeltaDirection.DOWN]: (places) =>
    `Down ${places} ${places === 1 ? "place" : "places"}`,
  [RankDeltaDirection.STABLE]: () => "No change",
  [RankDeltaDirection.NEW]: () => "New in the ranking",
};

/** The accessible name of a trend: "Up 3 places", "No change", "New in the ranking". */
export function trendAccessibleName(delta: number | null | undefined): string {
  const { direction } = formatRankDelta(delta);
  const places = typeof delta === "number" ? Math.abs(Math.trunc(delta)) : 0;
  return TREND_NAMES[direction](places);
}

/** "Gold medal", "Silver medal", "Bronze medal" or null. */
export function medalLabel(rank: number): string | null {
  const medal = podiumMedal(rank);
  return medal ? `${medal[0]!.toUpperCase()}${medal.slice(1)} medal` : null;
}

// ------------------------------------------------------------------ mine

export function isMine(
  entry: Pick<RankingEntry, "playerId">,
  currentPlayerId: string,
): boolean {
  return entry.playerId !== null && entry.playerId === currentPlayerId;
}

/**
 * The row "Jump to my rank" targets: my best-ranked hero (`me[0]`), or my first
 * hero on the page when the API sent no `me`.
 */
export function jumpTargetHeroId(
  me: readonly RankingEntry[],
  entries: readonly RankingEntry[],
  currentPlayerId: string,
): string | null {
  return (
    me[0]?.heroId ??
    entries.find((entry) => isMine(entry, currentPlayerId))?.heroId ??
    null
  );
}

/** My heroes that are not on the page, by rank: pinned under the table. */
export function pinnedHeroes(
  me: readonly RankingEntry[],
  entries: readonly RankingEntry[],
): RankingEntry[] {
  const onPage = new Set(entries.map((entry) => entry.heroId));
  return me.filter((entry) => !onPage.has(entry.heroId));
}

/** Path of the statistics page (F01) of a hero. */
export function progressionPath(playerId: string, heroId: string): string {
  return `/players/${encodeURIComponent(playerId)}/heroes/${encodeURIComponent(heroId)}/statistics`;
}
