/**
 * Hero statistics page state (decision D3): loading, ready or error, re-read on
 * every visit, no client cache. A hero who never played is READY with zeros.
 */
import {
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  type MaybeRefOrGetter,
} from "vue";
import { useLeaderboardApi } from "../api/leaderboardSource";
import { formatConsolidationAge, groupHeroStatistics } from "../statisticsRules";
import { LoadStatus, type ConsolidationInfo, type StatisticGroup } from "../types";
import { describeLoadError } from "./loadError";
import type { LoaderOptions } from "./loaderOptions";

export function useHeroStatistics(
  playerId: MaybeRefOrGetter<string>,
  heroId: MaybeRefOrGetter<string>,
  options: LoaderOptions = {},
) {
  const api = options.api ?? useLeaderboardApi();
  const now = options.now ?? (() => new Date());

  const status = ref<LoadStatus>(LoadStatus.LOADING);
  const groups = ref<StatisticGroup[]>([]);
  const consolidation = ref<ConsolidationInfo | null>(null);
  const errorMessage = ref("");
  let controller: AbortController | null = null;

  async function load(): Promise<void> {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    status.value = LoadStatus.LOADING;
    errorMessage.value = "";

    try {
      const response = await api.getHeroStatistics(
        toValue(playerId),
        toValue(heroId),
        current.signal,
      );
      if (controller !== current) return;
      groups.value = groupHeroStatistics(response);
      consolidation.value = {
        consolidatedAt: response?.consolidatedAt ?? null,
        label: formatConsolidationAge(response?.consolidatedAt, now()),
        isConsolidating: response?.isConsolidating === true,
      };
      status.value = LoadStatus.READY;
    } catch (cause) {
      if (controller !== current) return;
      errorMessage.value = describeLoadError(cause);
      status.value = LoadStatus.ERROR;
    }
  }

  if (getCurrentInstance() && options.immediate !== false) {
    onMounted(load);
    onBeforeUnmount(() => {
      controller?.abort();
      controller = null;
    });
  }

  return { status, groups, consolidation, errorMessage, load, retry: load };
}
