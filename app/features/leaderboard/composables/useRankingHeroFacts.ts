/**
 * Facts behind a ranking row (F03, CA5, CA6). Never read on mount: the drawer
 * calls `load()` when it opens; `cancel()` drops an answer still on its way.
 */
import {
  getCurrentInstance,
  onBeforeUnmount,
  ref,
  shallowRef,
  toValue,
  type MaybeRefOrGetter,
} from "vue";
import { useLeaderboardApi } from "../api/leaderboardSource";
import { LoadStatus, type RankingFactsResponse } from "../types";
import { describeLoadError } from "./loadError";
import type { LoaderOptions } from "./loaderOptions";

export function useRankingHeroFacts(
  heroId: MaybeRefOrGetter<string>,
  options: Pick<LoaderOptions, "api"> = {},
) {
  const api = options.api ?? useLeaderboardApi();

  const status = ref<LoadStatus>(LoadStatus.LOADING);
  const facts = shallowRef<RankingFactsResponse | null>(null);
  const errorMessage = ref("");
  let controller: AbortController | null = null;

  function cancel(): void {
    controller?.abort();
    controller = null;
  }

  async function load(): Promise<void> {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    status.value = LoadStatus.LOADING;
    errorMessage.value = "";
    // Never show the previous reading as current while re-reading.
    facts.value = null;

    try {
      const response = await api.getRankingHeroFacts(toValue(heroId), current.signal);
      if (controller !== current) return;
      if (!response) throw new Error("Empty facts");
      facts.value = response;
      status.value =
        (response.facts?.length ?? 0) > 0 ? LoadStatus.READY : LoadStatus.EMPTY;
    } catch (cause) {
      if (controller !== current) return;
      facts.value = null;
      errorMessage.value = describeLoadError(cause);
      status.value = LoadStatus.ERROR;
    }
  }

  if (getCurrentInstance()) onBeforeUnmount(cancel);

  return { status, facts, errorMessage, load, retry: load, cancel };
}
