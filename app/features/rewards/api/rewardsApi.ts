/** Rewards capability's typed boundary to the API Gateway (ADR-FE-009, ADR-FE-011). */
import type { RunRewardSummary } from "../types";
import { useGateway } from "~/shared/composables/useGateway";
import type { GatewayClient } from "~/shared/utils/gateway";

/**
 * The Gateway prefix is routed as `/api/rewards/...` and rewritten to
 * `/api/v1/...` by Traefik (`rewards-owned-api`), so the Reward route
 * `GET /api/v1/runs/{id}/rewards` is reached through `rewards/runs/{id}/rewards`.
 */
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
  return createRewardsApi(useGateway());
}
