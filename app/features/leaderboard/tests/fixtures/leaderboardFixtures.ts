import { vi } from "vitest";
import type {
  HeroStatisticsResponse,
  LeaderboardApi,
  LeaderboardEntry,
  LeaderboardResponse,
} from "../../types";

export const ME = "me-id";
export const NOW = new Date("2026-10-21T12:00:00Z");
export const THREE_MINUTES_AGO = "2026-10-21T11:57:00Z";

export function entry(rank: number, playerId = `p-${rank}`): LeaderboardEntry {
  return { rank, playerId, playerName: `Player ${rank}`, score: 10_000 - rank };
}

export function leaderboard(
  overrides: Partial<LeaderboardResponse> = {},
): LeaderboardResponse {
  return {
    consolidatedAt: THREE_MINUTES_AGO,
    entries: Array.from({ length: 50 }, (_, index) => entry(index + 1)),
    me: null,
    ...overrides,
  };
}

export function heroStatistics(
  overrides: Partial<HeroStatisticsResponse> = {},
): HeroStatisticsResponse {
  return {
    heroId: "hero-1",
    consolidatedAt: THREE_MINUTES_AGO,
    isConsolidating: false,
    statistics: [{ key: "games_played", value: 12 }],
    ...overrides,
  };
}

export function apiStub(
  overrides: Partial<Record<keyof LeaderboardApi, ReturnType<typeof vi.fn>>> = {},
) {
  return {
    getHeroStatistics: vi.fn().mockResolvedValue(heroStatistics()),
    getLeaderboard: vi.fn().mockResolvedValue(leaderboard()),
    ...overrides,
  } satisfies LeaderboardApi;
}
