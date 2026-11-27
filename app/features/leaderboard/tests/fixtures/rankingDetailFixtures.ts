import {
  FactStatus,
  HeroClass,
  RunOutcome,
  type RankingFactsResponse,
  type RankingHeroDetail,
} from "../../types";

export function heroDetail(
  overrides: Partial<RankingHeroDetail> = {},
): RankingHeroDetail {
  return {
    heroId: "hero-1",
    heroName: "Brakka",
    heroClass: HeroClass.WARRIOR,
    level: 12,
    ngTier: 2,
    createdAt: "2026-03-04T10:00:00Z",
    xpIntoLevel: 1200,
    xpForNextLevel: 3000,
    lastRuns: [
      {
        outcome: RunOutcome.VICTORY,
        room: 12,
        maxRoom: 12,
        boss: "Lich King",
        xp: 340,
        endedAt: "2026-10-21T11:57:00Z",
      },
      {
        outcome: RunOutcome.DEFEAT,
        room: 7,
        maxRoom: 12,
        boss: null,
        xp: 80,
        endedAt: "2026-10-20T11:00:00Z",
      },
      {
        outcome: RunOutcome.ABANDONED,
        room: 2,
        maxRoom: 12,
        boss: null,
        xp: 0,
        endedAt: "2026-10-19T11:00:00Z",
      },
    ],
    bossesDefeated: 9,
    deepestRoom: 12,
    playerId: "player-1",
    ...overrides,
  };
}

export function heroFacts(
  overrides: Partial<RankingFactsResponse> = {},
): RankingFactsResponse {
  return {
    heroId: "hero-1",
    xpFromFacts: 15400,
    idempotencyKey: "hero-1:v42",
    facts: [
      {
        factId: "fact-1",
        type: "RunCompleted",
        ingestedAt: "2026-10-21T11:57:00Z",
        status: FactStatus.APPLIED,
        xp: 340,
        reason: null,
      },
      {
        factId: "fact-2",
        type: "RunCompleted",
        ingestedAt: "2026-10-21T11:58:00Z",
        status: FactStatus.PENDING,
        xp: 80,
        reason: null,
      },
      {
        factId: "fact-3",
        type: "RunCompleted",
        ingestedAt: "2026-10-21T11:59:00Z",
        status: FactStatus.REJECTED,
        xp: 0,
        reason: "Duplicate fact",
      },
    ],
    ...overrides,
  };
}
