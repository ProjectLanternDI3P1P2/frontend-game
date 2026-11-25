/**
 * Simulated hero statistics (decision D1) and the simulated failure. Only
 * `api/simulatedLeaderboardApi.ts` imports `mocks/`; components never do.
 * The hero ranking data lives in `rankingMocks.ts`.
 *
 * Statistics by scenario:
 * - `empty`: no statistic, never consolidated.
 * - `consolidating`: a consolidation is running, the previous figures are
 *   served (one key is missing, shown as 0).
 * - any other scenario: every statistic has a value.
 * - `error`: the service answers 503 (see `simulatedFailure`).
 */
import { STATISTICS_CATALOGUE } from "../statisticsCatalogue";
import { MockScenario, type HeroStatisticsResponse } from "../types";
import { GatewayError } from "~/shared/utils/gateway";

/** Every scenario except `empty` was consolidated 3 minutes before `now`. */
export const CONSOLIDATED_MINUTES_AGO = 3;

export function minutesBefore(now: Date, minutes: number): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

/** Deterministic, varied values so the cards do not all look alike. */
function playedValue(index: number): number {
  return ((index * 37 + 11) % 90) + index * 4 + 1;
}

export function simulatedHeroStatistics(
  scenario: MockScenario,
  heroId: string,
  now: Date,
): HeroStatisticsResponse {
  if (scenario === MockScenario.EMPTY) {
    return { heroId, consolidatedAt: null, isConsolidating: false, statistics: [] };
  }

  const statistics = STATISTICS_CATALOGUE.map((definition, index) => ({
    key: definition.key,
    value: playedValue(index),
  }));

  return {
    heroId,
    consolidatedAt: minutesBefore(now, CONSOLIDATED_MINUTES_AGO),
    isConsolidating: scenario === MockScenario.CONSOLIDATING,
    statistics:
      scenario === MockScenario.CONSOLIDATING ? statistics.slice(0, -1) : statistics,
  };
}

export function simulatedFailure(): GatewayError {
  return new GatewayError(503, {
    code: "SERVICE_UNAVAILABLE",
    message: "The leaderboard service is unavailable (simulated).",
  });
}

export function simulatedNotFound(heroId: string): GatewayError {
  return new GatewayError(404, {
    code: "HERO_NOT_RANKED",
    message: `No ranked hero with id "${heroId}" (simulated).`,
  });
}
