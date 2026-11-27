import { vi, type Mock } from "vitest";
import { defaultRankingQuery } from "../../leaderboardRules";
import {
  HeroClass,
  RankingStatus,
  type HeroStatisticsResponse,
  type LeaderboardApi,
  type RankingEntry,
  type RankingQuery,
  type RankingResponse,
} from "../../types";

export const ME = "me-id";
export const NOW = new Date("2026-10-21T12:00:00Z");
export const THREE_MINUTES_AGO = "2026-10-21T11:57:00Z";

export function query(overrides: Partial<RankingQuery> = {}): RankingQuery {
  return { ...defaultRankingQuery(ME), ...overrides };
}

export function entry(
  rank: number,
  playerId: string | null = `p-${rank}`,
  overrides: Partial<RankingEntry> = {},
): RankingEntry {
  return {
    rank,
    rankDelta: 0,
    heroId: `hero-${rank}`,
    heroName: `Hero ${rank}`,
    heroClass: HeroClass.WARRIOR,
    level: 10,
    totalXp: 10_000 - rank,
    runs: 20,
    winRate: 0.5,
    lastActivityAt: THREE_MINUTES_AGO,
    playerId,
    playerName: playerId === null ? null : `Player ${rank}`,
    isPending: false,
    ...overrides,
  };
}

export function ranking(overrides: Partial<RankingResponse> = {}): RankingResponse {
  return {
    consolidatedAt: THREE_MINUTES_AGO,
    status: RankingStatus.LIVE,
    statusDetail: {
      lagSeconds: null,
      pendingCount: null,
      correctUpTo: null,
      rebuildProgress: null,
      snapshotAt: null,
      frozenAt: null,
      reason: null,
    },
    season: {
      id: "season-3",
      label: "Season 3",
      openedAt: "2026-09-21T12:00:00Z",
      previousSeasonId: "season-2",
    },
    page: 1,
    pageSize: 10,
    totalCount: 42,
    entries: Array.from({ length: 10 }, (_, index) => entry(index + 1)),
    me: [],
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

type LeaderboardApiMock = {
  [Method in keyof LeaderboardApi]: Mock<LeaderboardApi[Method]>;
};

export function apiStub(
  overrides: Partial<Record<keyof LeaderboardApi, ReturnType<typeof vi.fn>>> = {},
): LeaderboardApiMock {
  return {
    getHeroStatistics: vi
      .fn<LeaderboardApi["getHeroStatistics"]>()
      .mockResolvedValue(heroStatistics()),
    getRanking: vi.fn<LeaderboardApi["getRanking"]>().mockResolvedValue(ranking()),
    getRankingHeroDetail: vi
      .fn<LeaderboardApi["getRankingHeroDetail"]>()
      .mockRejectedValue(new Error("not stubbed")),
    getRankingHeroFacts: vi
      .fn<LeaderboardApi["getRankingHeroFacts"]>()
      .mockRejectedValue(new Error("not stubbed")),
    getPublicRanking: vi
      .fn<LeaderboardApi["getPublicRanking"]>()
      .mockRejectedValue(new Error("not stubbed")),
    // Some overrides simulate malformed API responses to exercise error handling.
    ...(overrides as Partial<LeaderboardApiMock>),
  };
}
