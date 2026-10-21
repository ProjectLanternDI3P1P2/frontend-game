/**
 * Leaderboard page state (decisions D3/D4): loading, ready, empty or error,
 * re-read on every visit and on "Refresh", no client cache.
 */
import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  type MaybeRefOrGetter,
} from "vue";
import { useLeaderboardApi } from "../api/leaderboardSource";
import { buildLeaderboardView } from "../leaderboardRules";
import { formatConsolidationAge } from "../statisticsRules";
import { LoadStatus, type ConsolidationInfo, type LeaderboardView } from "../types";
import { describeLoadError } from "./loadError";
import type { LoaderOptions } from "./useHeroStatistics";

export function useLeaderboard(
  currentPlayerId: MaybeRefOrGetter<string>,
  options: LoaderOptions = {},
) {
  const api = options.api ?? useLeaderboardApi();
  const now = options.now ?? (() => new Date());

  const status = ref<LoadStatus>(LoadStatus.LOADING);
  const view = ref<LeaderboardView>({ rows: [], me: null, pinnedMe: null });
  const consolidation = ref<ConsolidationInfo | null>(null);
  const errorMessage = ref("");
  /** True while re-reading over data already on screen. */
  const refreshing = ref(false);
  let controller: AbortController | null = null;

  const hasData = computed(
    () => status.value === LoadStatus.READY || status.value === LoadStatus.EMPTY,
  );

  async function load(): Promise<void> {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    errorMessage.value = "";
    if (hasData.value) refreshing.value = true;
    else status.value = LoadStatus.LOADING;

    try {
      const response = await api.getLeaderboard(
        toValue(currentPlayerId),
        current.signal,
      );
      if (controller !== current) return;
      view.value = buildLeaderboardView(response, toValue(currentPlayerId));
      consolidation.value = {
        consolidatedAt: response?.consolidatedAt ?? null,
        label: formatConsolidationAge(response?.consolidatedAt, now()),
        isConsolidating: false,
      };
      status.value = view.value.rows.length ? LoadStatus.READY : LoadStatus.EMPTY;
    } catch (cause) {
      if (controller !== current) return;
      errorMessage.value = describeLoadError(cause);
      status.value = LoadStatus.ERROR;
    } finally {
      if (controller === current) refreshing.value = false;
    }
  }

  if (getCurrentInstance() && options.immediate !== false) {
    onMounted(load);
    onBeforeUnmount(() => {
      controller?.abort();
      controller = null;
    });
  }

  return {
    status,
    view,
    consolidation,
    errorMessage,
    refreshing,
    load,
    refresh: load,
    retry: load,
  };
}
