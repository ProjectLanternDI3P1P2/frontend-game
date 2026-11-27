/**
 * Public rankings state (F04, decision D11): read once per request through
 * `useAsyncData`, so the server-rendered HTML already holds the podium and
 * the top 10, and the browser reuses the payload instead of reading again.
 *
 * The loader never rejects: a failed read becomes an ERROR state with a fixed,
 * readable message, so a Gateway outage can never break the server render
 * (CA8). On the server, that state answers 503: the `swr` cache only keeps
 * successful responses, so an outage never replaces the good page. The data
 * source (and `?mock=`, read from the route, never from `window`) is chosen
 * by `useLeaderboardApi()`.
 */
import { computed } from "vue";
import { useLeaderboardApi } from "../api/leaderboardSource";
import { parseConsolidationDate } from "../statisticsRules";
import { LoadStatus, type LeaderboardApi, type PublicRankingResponse } from "../types";
import { GENERIC_LOAD_ERROR } from "./loadError";
import type { LoaderOptions } from "./loaderOptions";

/** Serialisable (plain JSON) so it travels in the Nuxt payload. */
export interface PublicRankingState {
  status: LoadStatus;
  ranking: PublicRankingResponse | null;
  errorMessage: string;
}

export const PUBLIC_RANKING_KEY = "leaderboard-public-ranking";

/**
 * The page is public and shared by the cache: it never shows the Gateway's own
 * wording (internal details, other languages), only this explicit message.
 */
export const PUBLIC_RANKING_ERROR = GENERIC_LOAD_ERROR;

/** Not cached by `swr`, and tells crawlers to come back later. */
export const PUBLIC_RANKING_ERROR_STATUS = 503;

export const LOADING_PUBLIC_RANKING: Readonly<PublicRankingState> = Object.freeze({
  status: LoadStatus.LOADING,
  ranking: null,
  errorMessage: "",
});

/** A body with no ranked hero at all reads "No ranked run yet", not an error. */
export function isPublicRankingEmpty(ranking: PublicRankingResponse | null): boolean {
  return (
    !ranking ||
    ((ranking.totalCount ?? 0) <= 0 &&
      (ranking.podium?.length ?? 0) === 0 &&
      (ranking.top?.length ?? 0) === 0)
  );
}

/** Missing lists in a provisional contract are read as empty ones. */
function normalise(ranking: PublicRankingResponse): PublicRankingResponse {
  return {
    ...ranking,
    totalCount: Number.isFinite(ranking.totalCount) ? ranking.totalCount : 0,
    podium: ranking.podium ?? [],
    leadersByClass: ranking.leadersByClass ?? [],
    top: ranking.top ?? [],
  };
}

/** Reads the public ranking; resolves to a state, never rejects. */
export async function loadPublicRanking(
  api: LeaderboardApi,
  signal?: AbortSignal,
): Promise<PublicRankingState> {
  try {
    const response = await api.getPublicRanking(signal);
    const ranking = response ? normalise(response) : null;
    return {
      status: isPublicRankingEmpty(ranking) ? LoadStatus.EMPTY : LoadStatus.READY,
      ranking,
      errorMessage: "",
    };
  } catch {
    return {
      status: LoadStatus.ERROR,
      ranking: null,
      errorMessage: PUBLIC_RANKING_ERROR,
    };
  }
}

const freshnessFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export interface Freshness {
  /** "Updated 21 Oct 2026, 11:57 UTC" or "Not consolidated yet". */
  label: string;
  /** For `<time datetime>`; null when the date is missing or invalid. */
  datetime: string | null;
}

/**
 * An absolute UTC date rather than "3 min ago": the HTML is shared for up to
 * a minute (`swr: 60`) and must read the same on the server and the client.
 * An invalid date never breaks the page (D7).
 */
export function formatFreshness(consolidatedAt: string | null | undefined): Freshness {
  const date = parseConsolidationDate(consolidatedAt);
  if (!date) return { label: "Not consolidated yet", datetime: null };
  return {
    label: `Updated ${freshnessFormat.format(date)} UTC`,
    datetime: date.toISOString(),
  };
}

/** "1 ranked hero", "120 ranked heroes". */
export function formatRankedHeroes(count: number): string {
  const safe = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  return `${new Intl.NumberFormat("en-GB").format(safe)} ranked ${safe === 1 ? "hero" : "heroes"}`;
}

export type PublicRankingOptions = Pick<LoaderOptions, "api">;

export function usePublicRanking(options: PublicRankingOptions = {}) {
  const api = options.api ?? useLeaderboardApi();
  // Undefined in the browser; captured now, while the setup context exists.
  const event = useRequestEvent();

  const { data, status, error, refresh } = useAsyncData(
    PUBLIC_RANKING_KEY,
    async (_nuxtApp, { signal }) => {
      const state = await loadPublicRanking(api, signal);
      // The page still renders its message; only the status keeps it out of
      // the shared `swr` cache.
      if (event && state.status === LoadStatus.ERROR) {
        setResponseStatus(event, PUBLIC_RANKING_ERROR_STATUS);
      }
      return state;
    },
  );

  const state = computed<PublicRankingState>(() => {
    if (data.value) return data.value;
    // The loader never rejects; this only guards against the framework itself.
    if (error.value) {
      return {
        status: LoadStatus.ERROR,
        ranking: null,
        errorMessage: PUBLIC_RANKING_ERROR,
      };
    }
    return LOADING_PUBLIC_RANKING;
  });

  /** True while re-reading over a state already on screen (Retry). */
  const refreshing = computed(() => status.value === "pending" && !!data.value);

  return {
    state,
    refreshing,
    retry: () => refresh(),
  };
}
