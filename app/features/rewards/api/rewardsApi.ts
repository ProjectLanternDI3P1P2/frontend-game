/** Rewards capability's typed boundary to the API Gateway (ADR-FE-009, ADR-FE-011). */
import type { RunRewardSummary } from "../types";
import { useGateway } from "~/shared/composables/useGateway";
import type { GatewayClient } from "~/shared/utils/gateway";

/** The Gateway client maps the service path to /api/rewards/v1. */
export function createRewardsApi(client: GatewayClient) {
  return {
    getRunRewards(
      dungeonRunId: string,
      signal?: AbortSignal,
    ): Promise<RunRewardSummary> {
      return client.get<RunRewardSummary>(
        `rewards/runs/${encodeURIComponent(dungeonRunId)}/rewards`,
        { signal },
      );
    },
  };
}

export function useRewardsApi() {
  return createRewardsApi(useGateway({ redirectOnUnauthorized: false }));
}
