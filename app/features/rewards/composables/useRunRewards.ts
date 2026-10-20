import { useRewardsApi } from "../api/rewardsApi";
import type { RunRewardSummary } from "../types";

/**
 * Reward never notifies the front, so the summary is read once when the
 * end-of-activity screen is displayed. No polling.
 */
export function useRunRewards(dungeonRunId: Ref<string | null | undefined>) {
  const api = useRewardsApi();
  const summary = ref<RunRewardSummary | null>(null);
  const loading = ref(false);
  const error = ref("");

  async function load(): Promise<void> {
    if (!dungeonRunId.value) return;
    loading.value = true;
    error.value = "";
    try {
      summary.value = await api.getRunRewards(dungeonRunId.value);
    } catch {
      error.value = "Unable to load the group rewards.";
    } finally {
      loading.value = false;
    }
  }

  const isEmpty = computed(() => summary.value?.distributions.length === 0);

  return { summary, loading, error, isEmpty, load };
}
