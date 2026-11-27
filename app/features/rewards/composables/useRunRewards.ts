import { onScopeDispose, shallowRef, watch } from "vue";
import { GatewayError } from "~/shared/utils/gateway";
import { useRewardsApi } from "../api/rewardsApi";
import type { RunRewardSummary } from "../types";

type RewardsState =
  | {
      status: "idle" | "loading" | "unavailable" | "participationUnavailable" | "error";
    }
  | { status: "success"; summary: RunRewardSummary };

/**
 * 401/403/404: the run is unknown or the caller is not a participant; nothing is disclosed.
 * 503: Reward cannot ask Player to confirm the participation, so access is refused for now.
 */
function statusOf(
  cause: unknown,
): "unavailable" | "participationUnavailable" | "error" {
  if (!(cause instanceof GatewayError)) return "error";
  if ([401, 403, 404].includes(cause.status)) return "unavailable";
  if (cause.status === 503) return "participationUnavailable";
  return "error";
}

export function useRunRewards(getRunId: () => string | null | undefined) {
  const api = useRewardsApi();
  const state = shallowRef<RewardsState>({ status: "idle" });
  let pending: AbortController | undefined;

  async function load() {
    pending?.abort();
    const runId = getRunId();
    if (!runId) {
      state.value = { status: "idle" };
      return;
    }

    const request = new AbortController();
    pending = request;
    state.value = { status: "loading" };
    try {
      const summary = await api.getRunRewards(runId, request.signal);
      if (!request.signal.aborted) state.value = { status: "success", summary };
    } catch (cause) {
      if (request.signal.aborted) return;
      state.value = { status: statusOf(cause) };
    } finally {
      if (pending === request) pending = undefined;
    }
  }

  watch(getRunId, load, { immediate: true });
  onScopeDispose(() => pending?.abort());
  return { state, load };
}
