/** Rewards capability's typed boundary to the API Gateway (ADR-FE-009, ADR-FE-011). */
import type { RunRewardSummary } from "../types";
import { createGatewayClient, type GatewayClient } from "~/shared/utils/gateway";

/**
 * Reward serves `/api/rewards/<version>/...`. The shared client builds
 * `/api/<apiVersion>/<path>`, so the Rewards prefix is carried by the version.
 */
export function rewardsApiVersion(apiVersion: string): string {
  return `rewards/${apiVersion}`;
}

export function createRewardsApi(client: GatewayClient) {
  return {
    getRunRewards(
      dungeonRunId: string,
      signal?: AbortSignal,
    ): Promise<RunRewardSummary> {
      return client.get<RunRewardSummary>(
        `runs/${encodeURIComponent(dungeonRunId)}/rewards`,
        { signal },
      );
    },
  };
}

/**
 * No session refresh nor login redirect: a 401 is shown as unavailable rewards
 * rather than navigating away from the screen that displays them.
 */
export function useRewardsApi() {
  const config = useRuntimeConfig();
  const nuxtApp = useNuxtApp();
  return createRewardsApi(
    createGatewayClient({
      baseUrl: config.public.apiGatewayUrl,
      apiVersion: rewardsApiVersion(config.public.apiVersion),
      getToken: () => (import.meta.client ? (nuxtApp.$keycloak.token ?? null) : null),
    }),
  );
}
