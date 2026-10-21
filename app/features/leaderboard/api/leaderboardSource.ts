/**
 * THE single place where the leaderboard data source is chosen (CA12, D1).
 *
 * Switch `LEADERBOARD_SOURCE` to `LeaderboardSource.GATEWAY` once the
 * leaderboard service publishes its contract; no component changes. In
 * simulated mode, `?mock=played|empty|lagging|rebuilding|frozen|error|consolidating`
 * picks the scenario (default and unknown values: `played`).
 */
import { inject, type InjectionKey } from "vue";
import { LeaderboardSource, MockScenario, type LeaderboardApi } from "../types";
import { createLeaderboardApi } from "./leaderboardApi";
import { createSimulatedLeaderboardApi } from "./simulatedLeaderboardApi";
import { useGateway } from "~/shared/composables/useGateway";
import type { GatewayClient } from "~/shared/utils/gateway";

export const LEADERBOARD_SOURCE: LeaderboardSource = LeaderboardSource.SIMULATED;

/** Lets tests and stories hand a page its API (`provide(LEADERBOARD_API_KEY, api)`). */
export const LEADERBOARD_API_KEY: InjectionKey<LeaderboardApi> =
  Symbol("leaderboard-api");

const SCENARIOS = new Set<string>(Object.values(MockScenario));

/** `?mock=` value → scenario; anything unknown or absent falls back to `played`. */
export function resolveMockScenario(value: unknown): MockScenario {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" && SCENARIOS.has(candidate)
    ? (candidate as MockScenario)
    : MockScenario.PLAYED;
}

export function selectLeaderboardApi(
  source: LeaderboardSource,
  options: { scenario?: MockScenario; gateway: () => GatewayClient },
): LeaderboardApi {
  return source === LeaderboardSource.GATEWAY
    ? createLeaderboardApi(options.gateway())
    : createSimulatedLeaderboardApi({ scenario: options.scenario });
}

/** For pages: an injected API wins, otherwise the configured source. */
export function useLeaderboardApi(): LeaderboardApi {
  const injected = inject(LEADERBOARD_API_KEY, null);
  if (injected) return injected;
  return selectLeaderboardApi(LEADERBOARD_SOURCE, {
    scenario: resolveMockScenario(useRoute().query.mock),
    gateway: useGateway,
  });
}
