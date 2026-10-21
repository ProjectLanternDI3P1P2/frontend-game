/**
 * Hero ranking state (decisions D3, D8): loading, ready, empty or error,
 * re-read on every visit, on "Refresh" and whenever the query changes; no
 * client cache. The response is kept as the backend sent it (contract F00).
 * EMPTY says why (`emptyReason`): nobody is ranked, or nothing matches the
 * class filter or the search.
 */
import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { useLeaderboardApi } from "../api/leaderboardSource";
import {
  emptyReason as emptyReasonOf,
  isPlainRankOrder,
  pageCount,
  pageOfRank,
  rankingQueryKey,
  type EmptyReason,
} from "../rankingViewRules";
import { formatConsolidationAge } from "../statisticsRules";
import {
  LoadStatus,
  RankingSort,
  type ConsolidationInfo,
  type RankingQuery,
  type RankingResponse,
} from "../types";
import { describeLoadError } from "./loadError";
import type { LoaderOptions } from "./loaderOptions";

export function useLeaderboard(
  query: MaybeRefOrGetter<RankingQuery>,
  options: LoaderOptions = {},
) {
  const api = options.api ?? useLeaderboardApi();
  const now = options.now ?? (() => new Date());

  const status = ref<LoadStatus>(LoadStatus.LOADING);
  /** The last successful reading; null before it or when the body was empty. */
  const ranking = shallowRef<RankingResponse | null>(null);
  const consolidation = ref<ConsolidationInfo | null>(null);
  const errorMessage = ref("");
  /** True while re-reading over data already on screen. */
  const refreshing = ref(false);
  let controller: AbortController | null = null;

  const hasData = computed(
    () => status.value === LoadStatus.READY || status.value === LoadStatus.EMPTY,
  );
  const entries = computed(() => ranking.value?.entries ?? []);
  const me = computed(() => ranking.value?.me ?? []);
  /** Why the ranking is empty, for the query that was read; null otherwise. */
  const emptyReason = ref<EmptyReason | null>(null);

  async function load(): Promise<void> {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    errorMessage.value = "";
    if (hasData.value) refreshing.value = true;
    else status.value = LoadStatus.LOADING;

    const request = { ...toValue(query) };
    try {
      const response = await api.getRanking(request, current.signal);
      if (controller !== current) return;
      ranking.value = response ?? null;
      consolidation.value = {
        consolidatedAt: response?.consolidatedAt ?? null,
        label: formatConsolidationAge(response?.consolidatedAt, now()),
        isConsolidating: false,
      };
      // A page past the end is not "nobody ranked": F02 brings the user back.
      const ranked =
        (response?.entries?.length ?? 0) > 0 || (response?.totalCount ?? 0) > 0;
      status.value = ranked ? LoadStatus.READY : LoadStatus.EMPTY;
      emptyReason.value = ranked ? null : emptyReasonOf(request);
    } catch (cause) {
      if (controller !== current) return;
      errorMessage.value = describeLoadError(cause);
      status.value = LoadStatus.ERROR;
    } finally {
      if (controller === current) refreshing.value = false;
    }
  }

  /**
   * The page of the ranking ordered by total XP (current class, period and
   * search) that holds `rank`. Without filter, it is computed; otherwise the
   * pages are probed by dichotomy (ranks grow along the pages).
   */
  async function findPageOfRank(rank: number): Promise<number> {
    const base = { ...toValue(query), sort: RankingSort.TOTAL_XP };
    if (isPlainRankOrder(base)) return pageOfRank(rank, base.pageSize);
    let low = 1;
    let high = pageCount(ranking.value?.totalCount ?? 0, base.pageSize);
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const probe = await api.getRanking({ ...base, page: middle });
      const last = probe?.entries?.at(-1)?.rank ?? Infinity;
      if (rank > last) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  // A new filter, search, sort or page reads again (the previous answer is
  // ignored if it arrives late). The key ignores anything else in the route
  // (e.g. `?mock=`) and re-evaluations that leave the query unchanged.
  watch(
    () => rankingQueryKey(toValue(query)),
    (key, previous) => {
      if (key !== previous) void load();
    },
  );

  if (getCurrentInstance() && options.immediate !== false) {
    onMounted(load);
    onBeforeUnmount(() => {
      controller?.abort();
      controller = null;
    });
  }

  return {
    status,
    ranking,
    entries,
    me,
    consolidation,
    errorMessage,
    refreshing,
    hasData,
    emptyReason,
    findPageOfRank,
    load,
    refresh: load,
    retry: load,
  };
}
