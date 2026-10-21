/**
 * Hero detail of an expanded ranking row (F03, CA1, CA6): loading, ready or
 * error, read on mount and whenever the hero changes; no client cache.
 */
import {
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
import { LoadStatus, type RankingHeroDetail } from "../types";
import { describeLoadError } from "./loadError";
import type { LoaderOptions } from "./loaderOptions";

export function useRankingHeroDetail(
  heroId: MaybeRefOrGetter<string>,
  options: LoaderOptions = {},
) {
  const api = options.api ?? useLeaderboardApi();

  const status = ref<LoadStatus>(LoadStatus.LOADING);
  const detail = shallowRef<RankingHeroDetail | null>(null);
  const errorMessage = ref("");
  let controller: AbortController | null = null;

  async function load(): Promise<void> {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    status.value = LoadStatus.LOADING;
    errorMessage.value = "";

    try {
      const response = await api.getRankingHeroDetail(toValue(heroId), current.signal);
      if (controller !== current) return;
      if (!response) throw new Error("Empty hero detail");
      detail.value = response;
      status.value = LoadStatus.READY;
    } catch (cause) {
      if (controller !== current) return;
      detail.value = null;
      errorMessage.value = describeLoadError(cause);
      status.value = LoadStatus.ERROR;
    }
  }

  watch(() => toValue(heroId), load);

  if (getCurrentInstance() && options.immediate !== false) {
    onMounted(load);
    onBeforeUnmount(() => {
      controller?.abort();
      controller = null;
    });
  }

  return { status, detail, errorMessage, load, retry: load };
}
