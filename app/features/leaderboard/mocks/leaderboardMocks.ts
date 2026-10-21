/**
 * Simulated leaderboard data (decision D1). Only `api/simulatedLeaderboardApi.ts`
 * imports this file; components never do (CA12).
 *
 * Scenarios:
 * - `played`: every statistic has a value; the current player is ranked 7th.
 * - `empty`: no statistic, never consolidated; nobody ranked yet.
 * - `consolidating`: a consolidation is running, the previous figures are
 *   served (one key is missing, shown as 0); the current player is ranked 87th,
 *   outside the top 50, so their line is pinned under the table.
 * - `error`: the service answers 503.
 */
import { STATISTICS_CATALOGUE } from "../statisticsCatalogue";
import {
  MockScenario,
  type HeroStatisticsResponse,
  type LeaderboardEntry,
  type LeaderboardResponse,
} from "../types";
import { GatewayError } from "~/shared/utils/gateway";

const CONSOLIDATED_MINUTES_AGO = 3;
const MY_NAME = "MaelisRune";

const PLAYER_NAMES = [
  "Aldric",
  "Brenna",
  "Corvin",
  "Dahlia",
  "Eamon",
  "Fenna",
  "Garrick",
  "Hestia",
  "Ivor",
  "Juna",
];

function minutesBefore(now: Date, minutes: number): string {
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

function entry(rank: number, playerId: string, playerName: string): LeaderboardEntry {
  return { rank, playerId, playerName, score: 25_000 - rank * 173 - (rank % 7) * 11 };
}

function otherPlayer(rank: number): LeaderboardEntry {
  const name = PLAYER_NAMES[rank % PLAYER_NAMES.length];
  return entry(
    rank,
    `simulated-player-${String(rank).padStart(3, "0")}`,
    `${name}${rank}`,
  );
}

export function simulatedLeaderboard(
  scenario: MockScenario,
  playerId: string,
  now: Date,
): LeaderboardResponse {
  if (scenario === MockScenario.EMPTY) {
    return { consolidatedAt: null, entries: [], me: null };
  }

  const myRank = scenario === MockScenario.CONSOLIDATING ? 87 : 7;
  const me = entry(myRank, playerId, MY_NAME);
  const entries = Array.from({ length: 50 }, (_, index) =>
    index + 1 === myRank ? me : otherPlayer(index + 1),
  );

  return {
    consolidatedAt: minutesBefore(now, CONSOLIDATED_MINUTES_AGO),
    entries,
    me,
  };
}

export function simulatedFailure(): GatewayError {
  return new GatewayError(503, {
    code: "SERVICE_UNAVAILABLE",
    message: "The leaderboard service is unavailable (simulated).",
  });
}
