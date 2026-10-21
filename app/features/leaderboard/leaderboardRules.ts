/**
 * Pure presentation rules for the hero ranking (ADR-FE-012, decision D8).
 * No framework, no I/O. Shared by the ranking page (F02), the row detail (F03)
 * and the public rankings (F04).
 */
import {
  HeroClass,
  RankingPeriod,
  RankingSort,
  type RankingEntry,
  type RankingQuery,
} from "./types";

/** The ranking is paginated by 10 (D8). */
export const RANKING_PAGE_SIZE = 10;

export const HERO_CLASS_LABELS: Record<HeroClass, string> = {
  [HeroClass.WARRIOR]: "Warrior",
  [HeroClass.SHAMAN]: "Shaman",
  [HeroClass.MAGE]: "Mage",
};

/** The season label carries its number ("Season 3"): see `RankingSeason.label`. */
export const RANKING_PERIOD_LABELS: Record<RankingPeriod, string> = {
  [RankingPeriod.ALL_TIME]: "All time",
  [RankingPeriod.SEASON]: "Season",
  [RankingPeriod.WEEK]: "This week",
};

export const RANKING_SORT_LABELS: Record<RankingSort, string> = {
  [RankingSort.TOTAL_XP]: "Total XP",
  [RankingSort.LEVEL]: "Level",
  [RankingSort.WIN_RATE]: "Win rate",
  [RankingSort.LAST_ACTIVITY]: "Last activity",
};

/** The ranking state carried by the URL: everything but the current player. */
export type RankingUrlState = Omit<RankingQuery, "playerId">;

export const DEFAULT_RANKING_STATE: Readonly<RankingUrlState> = Object.freeze({
  heroClass: null,
  period: RankingPeriod.ALL_TIME,
  search: "",
  sort: RankingSort.TOTAL_XP,
  page: 1,
  pageSize: RANKING_PAGE_SIZE,
});

/** The default query for a player: first page, all classes, all time, by XP. */
export function defaultRankingQuery(playerId: string): RankingQuery {
  return { ...DEFAULT_RANKING_STATE, playerId };
}

// ------------------------------------------------------------------ trend

export enum RankDeltaDirection {
  UP = "up",
  DOWN = "down",
  STABLE = "stable",
  NEW = "new",
}

export interface FormattedRankDelta {
  /** "▲ 3", "▼ 2", "— 0" or "NEW". */
  label: string;
  direction: RankDeltaDirection;
}

/** `null` (or anything not a finite number) means the hero is new to the ranking. */
export function formatRankDelta(delta: number | null | undefined): FormattedRankDelta {
  if (typeof delta !== "number" || !Number.isFinite(delta)) {
    return { label: "NEW", direction: RankDeltaDirection.NEW };
  }
  const places = Math.abs(Math.trunc(delta));
  if (places === 0) return { label: "— 0", direction: RankDeltaDirection.STABLE };
  return delta > 0
    ? { label: `▲ ${places}`, direction: RankDeltaDirection.UP }
    : { label: `▼ ${places}`, direction: RankDeltaDirection.DOWN };
}

// ------------------------------------------------------------------ ranks

export type PodiumMedal = "gold" | "silver" | "bronze";

const MEDALS: Record<number, PodiumMedal> = { 1: "gold", 2: "silver", 3: "bronze" };

export function podiumMedal(rank: number): PodiumMedal | null {
  return MEDALS[rank] ?? null;
}

/**
 * Ranks strictly between the last visible line and mine ("47 positions
 * between rank 10 and yours"); 0 when mine is adjacent or above.
 */
export function positionsBetween(lastVisibleRank: number, myRank: number): number {
  if (!Number.isFinite(lastVisibleRank) || !Number.isFinite(myRank)) return 0;
  return Math.max(0, Math.trunc(myRank) - Math.trunc(lastVisibleRank) - 1);
}

// ------------------------------------------------------------------ figures

/** 0.43 → "43%"; clamped to 0..100 %, anything not a number → "0%". */
export function formatWinRate(winRate: number): string {
  const ratio = Number.isFinite(winRate) ? Math.min(1, Math.max(0, winRate)) : 0;
  return `${Math.round(ratio * 100)}%`;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

/**
 * "just now", "12 seconds ago", "3 min ago", "2 h ago", "5 days ago".
 * A future date (clock skew) reads "just now"; a missing or invalid date reads
 * "Never".
 */
export function formatRelativeTime(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return "Never";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "Never";

  const elapsed = now.getTime() - time;
  if (elapsed < SECOND) return "just now";
  if (elapsed < MINUTE) return plural(Math.floor(elapsed / SECOND), "second");
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  return plural(Math.floor(elapsed / DAY), "day");
}

export const ANONYMOUS_HERO = "Anonymous hero";

/** The owner's display name, or "Anonymous hero" for a deleted player. */
export function displayPlayerName(entry: Pick<RankingEntry, "playerName">): string {
  return entry.playerName?.trim() || ANONYMOUS_HERO;
}

// ------------------------------------------------------------------ URL

/** `useRoute().query`, or any untrusted key/value bag. */
export type RankingRouteQuery = Readonly<Record<string, unknown>>;

/** URL keys, the same as the Gateway query parameters. */
export const RANKING_QUERY_KEYS = {
  heroClass: "class",
  period: "period",
  search: "search",
  sort: "sort",
  page: "page",
} as const;

const MAX_SEARCH_LENGTH = 64;

function firstString(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" ? candidate : null;
}

function enumValue<T extends string>(values: readonly T[], raw: unknown): T | null {
  const candidate = firstString(raw)?.trim().toLowerCase();
  return values.find((value) => value === candidate) ?? null;
}

function pageNumber(raw: unknown): number {
  const candidate = firstString(raw)?.trim() ?? "";
  if (!/^\d{1,6}$/.test(candidate)) return 1;
  return Math.max(1, Number(candidate));
}

/**
 * Reads the ranking state from the route query. Anything missing or invalid
 * falls back to its default; unknown keys (e.g. `mock`) are ignored. The page
 * size is not part of the URL.
 */
export function parseRankingQuery(
  routeQuery: RankingRouteQuery | null | undefined,
): RankingUrlState {
  const query = routeQuery ?? {};
  return {
    heroClass: enumValue(Object.values(HeroClass), query[RANKING_QUERY_KEYS.heroClass]),
    period:
      enumValue(Object.values(RankingPeriod), query[RANKING_QUERY_KEYS.period]) ??
      DEFAULT_RANKING_STATE.period,
    search: (firstString(query[RANKING_QUERY_KEYS.search]) ?? "")
      .trim()
      .slice(0, MAX_SEARCH_LENGTH),
    sort:
      enumValue(Object.values(RankingSort), query[RANKING_QUERY_KEYS.sort]) ??
      DEFAULT_RANKING_STATE.sort,
    page: pageNumber(query[RANKING_QUERY_KEYS.page]),
    pageSize: RANKING_PAGE_SIZE,
  };
}

/**
 * The route query for a ranking state. Default values are omitted so that the
 * default ranking is plain `/leaderboard`; merge it with any other key to keep
 * (e.g. `{ ...route.query, ...toRouteQuery(state) }` after removing ours).
 */
export function toRouteQuery(
  query: Pick<RankingQuery, "heroClass" | "period" | "search" | "sort" | "page">,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (query.heroClass) result[RANKING_QUERY_KEYS.heroClass] = query.heroClass;
  if (query.period !== DEFAULT_RANKING_STATE.period) {
    result[RANKING_QUERY_KEYS.period] = query.period;
  }
  const search = query.search.trim();
  if (search) result[RANKING_QUERY_KEYS.search] = search;
  if (query.sort !== DEFAULT_RANKING_STATE.sort) {
    result[RANKING_QUERY_KEYS.sort] = query.sort;
  }
  if (Number.isInteger(query.page) && query.page > 1) {
    result[RANKING_QUERY_KEYS.page] = String(query.page);
  }
  return result;
}
