import { describe, expect, it } from "vitest";
import { createSimulatedLeaderboardApi } from "../api/simulatedLeaderboardApi";
import { defaultRankingQuery } from "../leaderboardRules";
import {
  FactStatus,
  HeroClass,
  MockScenario,
  RankingPeriod,
  RankingSort,
  type RankingEntry,
  type RankingQuery,
} from "../types";
import { GatewayError } from "~/shared/utils/gateway";
import { SEEDED_PLAYER_ID } from "~/features/player/seededPlayer";

const NOW = new Date("2026-10-21T12:00:00Z");
/** The simulated API caps the page size at 100. */
const ALL = 100;

function api(scenario = MockScenario.PLAYED) {
  return createSimulatedLeaderboardApi({ scenario, delayMs: 0, now: () => NOW });
}

function read(overrides: Partial<RankingQuery> = {}, scenario = MockScenario.PLAYED) {
  return api(scenario).getRanking({
    ...defaultRankingQuery(SEEDED_PLAYER_ID),
    ...overrides,
  });
}

/** Every line of the ranking for the query, all pages at once. */
async function everything(overrides: Partial<RankingQuery> = {}) {
  const entries: RankingEntry[] = [];
  for (let page = 1; ; page++) {
    const response = await read({ ...overrides, pageSize: 100, page });
    entries.push(...response.entries);
    if (!response.entries.length || entries.length >= response.totalCount) {
      return entries;
    }
  }
}

function ranks(entries: RankingEntry[]): number[] {
  return entries.map((entry) => entry.rank);
}

describe("simulated ranking data", () => {
  it("is deterministic", async () => {
    expect(await read()).toEqual(await read());
  });

  it("ranks 220 heroes all time and about 120 this season", async () => {
    expect((await read()).totalCount).toBe(220);
    expect((await read({ period: RankingPeriod.SEASON })).totalCount).toBe(120);
    const week = (await read({ period: RankingPeriod.WEEK })).totalCount;
    expect(week).toBeGreaterThan(0);
    expect(week).toBeLessThan(120);
  });

  it("gives me a Warrior 7th, a Shaman 58th and a Mage 210th, absent from the season", async () => {
    const me = (await read()).me;
    expect(me.map((entry) => [entry.heroClass, entry.rank])).toEqual([
      [HeroClass.WARRIOR, 7],
      [HeroClass.SHAMAN, 58],
      [HeroClass.MAGE, 210],
    ]);
    expect(me.every((entry) => entry.playerId === SEEDED_PLAYER_ID)).toBe(true);

    const season = (await read({ period: RankingPeriod.SEASON })).me;
    expect(season.map((entry) => entry.heroClass)).toEqual([
      HeroClass.WARRIOR,
      HeroClass.SHAMAN,
    ]);
  });

  it("contains deleted players, NEW and moving trends, and pending lines", async () => {
    const entries = await everything();
    const deleted = entries.filter((entry) => entry.playerName === null);

    expect(entries).toHaveLength(220);
    expect(deleted.length).toBeGreaterThanOrEqual(2);
    expect(deleted.every((entry) => entry.playerId === null)).toBe(true);
    expect(entries.some((entry) => entry.rankDelta === null)).toBe(true);
    expect(entries.some((entry) => (entry.rankDelta ?? 0) > 0)).toBe(true);
    expect(entries.some((entry) => (entry.rankDelta ?? 0) < 0)).toBe(true);
    expect(entries.some((entry) => entry.isPending)).toBe(true);
    expect(entries.some((entry) => entry.lastActivityAt === null)).toBe(true);
    expect(new Set(entries.map((entry) => entry.heroId)).size).toBe(220);
    for (const entry of entries) {
      expect(entry.winRate).toBeGreaterThanOrEqual(0);
      expect(entry.winRate).toBeLessThanOrEqual(1);
    }
  });

  it("ranks by total XP over the period, ranks 1..n without gaps", async () => {
    for (const period of Object.values(RankingPeriod)) {
      const entries = await everything({ period });
      expect(ranks(entries)).toEqual(entries.map((_, index) => index + 1));
      for (let index = 1; index < entries.length; index++) {
        expect(entries[index]!.totalXp).toBeLessThanOrEqual(
          entries[index - 1]!.totalXp,
        );
      }
    }
  });
});

describe("simulated ranking query", () => {
  it("paginates by the requested size and echoes page and size", async () => {
    const first = await read();
    const second = await read({ page: 2 });

    expect(first).toMatchObject({ page: 1, pageSize: 10 });
    expect(ranks(first.entries)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(ranks(second.entries)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect((await read({ page: 23 })).entries).toEqual([]);
    expect((await read({ page: 0, pageSize: -3 })).entries).toHaveLength(10);
  });

  it("filters by class, keeping the rank over all classes", async () => {
    const response = await read({ heroClass: HeroClass.SHAMAN, pageSize: ALL });

    expect(response.entries.length).toBe(response.totalCount);
    expect(response.totalCount).toBeLessThan(220);
    expect(
      response.entries.every((entry) => entry.heroClass === HeroClass.SHAMAN),
    ).toBe(true);
    expect(response.me.map((entry) => entry.rank)).toEqual([58]);
  });

  it("leaves me empty when none of my heroes matches", async () => {
    const response = await read({
      heroClass: HeroClass.MAGE,
      period: RankingPeriod.SEASON,
    });

    expect(response.totalCount).toBeGreaterThan(0);
    expect(response.me).toEqual([]);
  });

  it("searches player and hero names, case-insensitively", async () => {
    const byPlayer = await read({ search: "  maelisRUNE ", pageSize: ALL });
    expect(byPlayer.totalCount).toBe(3);
    expect(byPlayer.me).toHaveLength(3);

    const byHero = await read({ search: "stormcall", pageSize: ALL });
    expect(byHero.entries.map((entry) => entry.heroName)).toEqual(["Ysolde Stormcall"]);
    expect(byHero.me.map((entry) => entry.rank)).toEqual([58]);

    const nobody = await read({ search: "zzz-nobody" });
    expect(nobody).toMatchObject({ totalCount: 0, entries: [], me: [] });
  });

  it("sorts by level, win rate or last activity without changing ranks", async () => {
    const byLevel = await everything({ sort: RankingSort.LEVEL });
    const byWinRate = await everything({ sort: RankingSort.WIN_RATE });
    const byActivity = await everything({ sort: RankingSort.LAST_ACTIVITY });

    const isSorted = (values: number[]) =>
      values.every((value, index) => index === 0 || values[index - 1]! >= value);
    expect(isSorted(byLevel.map((entry) => entry.level))).toBe(true);
    expect(isSorted(byWinRate.map((entry) => entry.winRate))).toBe(true);
    expect(
      isSorted(
        byActivity.map((entry) =>
          entry.lastActivityAt ? Date.parse(entry.lastActivityAt) : -Infinity,
        ),
      ),
    ).toBe(true);
    expect(byActivity[0]!.heroName).toBe("Maelis the Warden");
    expect([...ranks(byWinRate)].sort((a, b) => a - b)).toEqual(
      ranks(await everything()),
    );
  });

  it("reflects the filters in totalCount and me together", async () => {
    const response = await read({
      period: RankingPeriod.SEASON,
      heroClass: HeroClass.WARRIOR,
      search: "maelis",
    });

    expect(response.totalCount).toBe(1);
    expect(response.entries).toEqual(response.me);
    expect(response.me[0]).toMatchObject({ heroClass: HeroClass.WARRIOR });
  });
});

describe("simulated hero detail, facts and public rankings", () => {
  it("describes a ranked hero consistently with the ranking", async () => {
    const [warrior] = (await read()).me;
    const detail = await api().getRankingHeroDetail(warrior!.heroId);

    expect(detail).toMatchObject({
      heroId: warrior!.heroId,
      heroName: warrior!.heroName,
      heroClass: warrior!.heroClass,
      level: warrior!.level,
      playerId: SEEDED_PLAYER_ID,
    });
    expect(detail.lastRuns.length).toBeLessThanOrEqual(4);
    expect(detail.lastRuns.length).toBeGreaterThan(0);
    const ended = detail.lastRuns.map((run) => Date.parse(run.endedAt));
    expect([...ended].sort((a, b) => b - a)).toEqual(ended);
    expect(detail.xpIntoLevel).toBeLessThanOrEqual(detail.xpForNextLevel);
  });

  it("gives a deleted player's hero no player id", async () => {
    const deleted = (await everything()).find((entry) => entry.playerName === null)!;
    expect((await api().getRankingHeroDetail(deleted.heroId)).playerId).toBeNull();
  });

  it("lists facts whose XP matches the ranking, with rejected and pending ones", async () => {
    const [warrior] = (await read()).me;
    const facts = await api().getRankingHeroFacts(warrior!.heroId);

    expect(facts.heroId).toBe(warrior!.heroId);
    expect(facts.xpFromFacts).toBe(warrior!.totalXp);
    expect(facts.idempotencyKey).not.toBe("");
    const statuses = facts.facts.map((fact) => fact.status);
    expect(statuses).toContain(FactStatus.REJECTED);
    expect(statuses).toContain(FactStatus.PENDING);
    expect(statuses).toContain(FactStatus.APPLIED);
    for (const fact of facts.facts) {
      expect(fact.reason === null).toBe(fact.status === FactStatus.APPLIED);
    }
  });

  it("answers 404 for a hero that is not ranked", async () => {
    await expect(api().getRankingHeroDetail("unknown")).rejects.toMatchObject({
      status: 404,
    });
    await expect(api().getRankingHeroFacts("unknown")).rejects.toBeInstanceOf(
      GatewayError,
    );
  });

  it("publishes the podium, the leader of each class and the top 10 of the ranking", async () => {
    const board = await read();
    const publicBoard = await api().getPublicRanking();

    expect(publicBoard.totalCount).toBe(board.totalCount);
    expect(publicBoard.top).toEqual(board.entries);
    expect(publicBoard.podium).toEqual(board.entries.slice(0, 3));
    expect(publicBoard.leadersByClass.map((leader) => leader.heroClass)).toEqual([
      HeroClass.WARRIOR,
      HeroClass.SHAMAN,
      HeroClass.MAGE,
    ]);
    for (const { heroClass, entry } of publicBoard.leadersByClass) {
      const best = (await read({ heroClass })).entries[0];
      expect(entry).toEqual(best);
    }
  });
});
