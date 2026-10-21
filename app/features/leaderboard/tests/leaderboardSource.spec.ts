import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEADERBOARD_SOURCE,
  resolveMockScenario,
  selectLeaderboardApi,
} from "../api/leaderboardSource";
import {
  createSimulatedLeaderboardApi,
  SIMULATED_DELAY_MS,
} from "../api/simulatedLeaderboardApi";
import { defaultRankingQuery } from "../leaderboardRules";
import { STATISTICS_CATALOGUE } from "../statisticsCatalogue";
import { LeaderboardSource, MockScenario, RankingStatus } from "../types";
import { GatewayError, type GatewayClient } from "~/shared/utils/gateway";
import { SEEDED_PLAYER_ID } from "~/features/player/seededPlayer";

const NOW = new Date("2026-10-21T12:00:00Z");
const QUERY = defaultRankingQuery(SEEDED_PLAYER_ID);

function simulated(scenario: MockScenario) {
  return createSimulatedLeaderboardApi({ scenario, delayMs: 0, now: () => NOW });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("leaderboard data source", () => {
  it("is simulated until the leaderboard service publishes its contract", () => {
    expect(LEADERBOARD_SOURCE).toBe(LeaderboardSource.SIMULATED);
  });

  it("reads every scenario from ?mock=, defaulting to played", () => {
    for (const scenario of Object.values(MockScenario)) {
      expect(resolveMockScenario(scenario)).toBe(scenario);
    }
    expect(resolveMockScenario(["error", "empty"])).toBe(MockScenario.ERROR);
    expect(resolveMockScenario(undefined)).toBe(MockScenario.PLAYED);
    expect(resolveMockScenario("nonsense")).toBe(MockScenario.PLAYED);
    expect(resolveMockScenario(42)).toBe(MockScenario.PLAYED);
  });

  it("only builds the Gateway client in gateway mode", async () => {
    const get = vi.fn().mockResolvedValue({});
    const gateway = vi.fn(() => ({ get }) as unknown as GatewayClient);

    selectLeaderboardApi(LeaderboardSource.SIMULATED, { gateway });
    expect(gateway).not.toHaveBeenCalled();

    await selectLeaderboardApi(LeaderboardSource.GATEWAY, { gateway }).getRanking(
      QUERY,
    );
    expect(get).toHaveBeenCalledWith(
      "progression/leaderboard/heroes",
      expect.anything(),
    );
  });
});

describe("simulated leaderboard API", () => {
  it("answers after about 300 ms", async () => {
    vi.useFakeTimers();
    const api = createSimulatedLeaderboardApi({ now: () => NOW });
    let settled = false;
    const pending = api.getRanking(QUERY).then(() => (settled = true));

    await vi.advanceTimersByTimeAsync(SIMULATED_DELAY_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(settled).toBe(true);
    expect(SIMULATED_DELAY_MS).toBe(300);
  });

  it("stops waiting when the request is aborted", async () => {
    const controller = new AbortController();
    const pending = createSimulatedLeaderboardApi({ delayMs: 1000 }).getRanking(
      QUERY,
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toBeDefined();
  });

  it("played (default): LIVE, consolidated 3 min ago, every statistic", async () => {
    const api = createSimulatedLeaderboardApi({ delayMs: 0, now: () => NOW });
    const board = await api.getRanking(QUERY);
    const statistics = await api.getHeroStatistics("me", "hero-1");

    expect(board.status).toBe(RankingStatus.LIVE);
    expect(board.consolidatedAt).toBe("2026-10-21T11:57:00.000Z");
    expect(Object.values(board.statusDetail).every((value) => value === null)).toBe(
      true,
    );
    expect(board.entries).toHaveLength(10);
    expect(statistics.statistics).toHaveLength(STATISTICS_CATALOGUE.length);
  });

  it("empty: nobody ranked in a new season that follows the previous one", async () => {
    const api = simulated(MockScenario.EMPTY);
    const board = await api.getRanking(QUERY);
    const publicBoard = await api.getPublicRanking();

    expect(board).toMatchObject({ totalCount: 0, entries: [], me: [] });
    expect(board.season.previousSeasonId).not.toBeNull();
    expect(publicBoard).toMatchObject({ totalCount: 0, podium: [], top: [] });
    expect(publicBoard.leadersByClass.every((leader) => leader.entry === null)).toBe(
      true,
    );
    expect(await api.getHeroStatistics("me", "h")).toMatchObject({
      consolidatedAt: null,
      statistics: [],
    });
  });

  it("lagging: LAGGING with its details and more pending lines", async () => {
    const board = await simulated(MockScenario.LAGGING).getRanking({
      ...QUERY,
      pageSize: 100,
    });
    const played = await simulated(MockScenario.PLAYED).getRanking({
      ...QUERY,
      pageSize: 100,
    });

    expect(board.status).toBe(RankingStatus.LAGGING);
    expect(board.statusDetail).toMatchObject({
      lagSeconds: expect.any(Number),
      pendingCount: expect.any(Number),
      correctUpTo: expect.any(String),
      reason: expect.any(String),
    });
    const pending = (response: typeof board) =>
      response.entries.filter((entry) => entry.isPending).length;
    expect(pending(board)).toBeGreaterThan(pending(played));
  });

  it("rebuilding: REBUILDING at 62 %, as of a snapshot", async () => {
    const board = await simulated(MockScenario.REBUILDING).getRanking(QUERY);

    expect(board.status).toBe(RankingStatus.REBUILDING);
    expect(board.statusDetail.rebuildProgress).toBe(0.62);
    expect(board.statusDetail.snapshotAt).toEqual(expect.any(String));
    expect(board.entries).toHaveLength(10);
  });

  it("frozen: FROZEN since a date, with a reason", async () => {
    const board = await simulated(MockScenario.FROZEN).getRanking(QUERY);

    expect(board.status).toBe(RankingStatus.FROZEN);
    expect(board.statusDetail.frozenAt).toEqual(expect.any(String));
    expect(board.statusDetail.reason).toEqual(expect.any(String));
  });

  it("consolidating: previous statistics, the ranking answers as played", async () => {
    const api = simulated(MockScenario.CONSOLIDATING);
    const statistics = await api.getHeroStatistics("me", "h");
    const board = await api.getRanking(QUERY);

    expect(statistics.isConsolidating).toBe(true);
    expect(statistics.statistics.length).toBeLessThan(STATISTICS_CATALOGUE.length);
    expect(board).toEqual(await simulated(MockScenario.PLAYED).getRanking(QUERY));
  });

  it("error: every method fails like the Gateway would", async () => {
    const api = simulated(MockScenario.ERROR);
    const calls = [
      api.getHeroStatistics("me", "h"),
      api.getRanking(QUERY),
      api.getRankingHeroDetail("simulated-hero-007"),
      api.getRankingHeroFacts("simulated-hero-007"),
      api.getPublicRanking(),
    ];
    for (const call of calls) {
      await expect(call).rejects.toBeInstanceOf(GatewayError);
    }
    await expect(api.getRanking(QUERY)).rejects.toMatchObject({ status: 503 });
  });
});
