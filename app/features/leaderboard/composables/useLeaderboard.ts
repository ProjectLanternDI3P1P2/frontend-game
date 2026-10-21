/**
 * Hero ranking state (decisions D3, D8): loading, ready, empty or error,
 * re-read on every visit, on "Refresh" and whenever the query changes; no
 * client cache. The response is kept as the backend sent it (contract F00).
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
import { formatConsolidationAge } from "../statisticsRules";
import {
  LoadStatus,
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

  async function load(): Promise<void> {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    errorMessage.value = "";
    if (hasData.value) refreshing.value = true;
    else status.value = LoadStatus.LOADING;

    try {
      const response = await api.getRanking({ ...toValue(query) }, current.signal);
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
    } catch (cause) {
      if (controller !== current) return;
      errorMessage.value = describeLoadError(cause);
      status.value = LoadStatus.ERROR;
    } finally {
      if (controller === current) refreshing.value = false;
    }
  }

  // A new filter, search, sort or page reads again (the previous answer is
  // ignored if it arrives late).
  watch(() => toValue(query), load, { deep: true });

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
    load,
    refresh: load,
    retry: load,
  };
}
