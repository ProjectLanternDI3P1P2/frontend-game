/**
 * The ranking state lives in the URL (D15): read with `parseRankingQuery`,
 * written with `toRouteQuery`, so that a shared link reopens the same ranking.
 * Keys that are not ours (e.g. `?mock=`) are kept. The URL is replaced, not
 * pushed: filters do not pile up in the history.
 */
import { computed, type WritableComputedRef } from "vue";
import {
  RANKING_QUERY_KEYS,
  parseRankingQuery,
  toRouteQuery,
  type RankingRouteQuery,
  type RankingUrlState,
} from "../leaderboardRules";

export interface RankingQueryOptions {
  /** The current route query (defaults to `useRoute().query`). */
  routeQuery?: () => RankingRouteQuery;
  /** Replaces the route query (defaults to `navigateTo({ query }, { replace: true })`). */
  replaceQuery?: (query: Record<string, string>) => unknown;
}

const OUR_KEYS = new Set<string>(Object.values(RANKING_QUERY_KEYS));

/** Keys of the route query that the ranking does not own, kept as strings. */
function foreignKeys(routeQuery: RankingRouteQuery): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [key, value] of Object.entries(routeQuery)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (!OUR_KEYS.has(key) && typeof first === "string") kept[key] = first;
  }
  return kept;
}

export function useRankingQuery(
  options: RankingQueryOptions = {},
): WritableComputedRef<RankingUrlState> {
  const route = options.routeQuery ? null : useRoute();
  const readQuery = options.routeQuery ?? (() => route!.query);
  const replaceQuery =
    options.replaceQuery ?? ((query) => navigateTo({ query }, { replace: true }));

  return computed<RankingUrlState>({
    get: () => parseRankingQuery(readQuery()),
    set: (state) => {
      void replaceQuery({ ...foreignKeys(readQuery()), ...toRouteQuery(state) });
    },
  });
}
