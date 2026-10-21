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
import { STATISTICS_CATALOGUE } from "../statisticsCatalogue";
import { LeaderboardSource, MockScenario } from "../types";
import { GatewayError, type GatewayClient } from "~/shared/utils/gateway";

const NOW = new Date("2026-10-21T12:00:00Z");

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

  it("reads the scenario from ?mock=, defaulting to played", () => {
    expect(resolveMockScenario("empty")).toBe(MockScenario.EMPTY);
    expect(resolveMockScenario(["error", "empty"])).toBe(MockScenario.ERROR);
    expect(resolveMockScenario("consolidating")).toBe(MockScenario.CONSOLIDATING);
    expect(resolveMockScenario(undefined)).toBe(MockScenario.PLAYED);
    expect(resolveMockScenario("nonsense")).toBe(MockScenario.PLAYED);
  });

  it("only builds the Gateway client in gateway mode", async () => {
    const get = vi.fn().mockResolvedValue({});
    const gateway = vi.fn(() => ({ get }) as unknown as GatewayClient);

    selectLeaderboardApi(LeaderboardSource.SIMULATED, { gateway });
    expect(gateway).not.toHaveBeenCalled();

    await selectLeaderboardApi(LeaderboardSource.GATEWAY, { gateway }).getLeaderboard(
      "p",
    );
    expect(get).toHaveBeenCalledWith("progression/leaderboard", expect.anything());
  });
});

describe("simulated leaderboard API", () => {
  it("answers after a short delay", async () => {
    vi.useFakeTimers();
    const api = createSimulatedLeaderboardApi({ now: () => NOW });
    let settled = false;
    const pending = api.getLeaderboard("me").then(() => (settled = true));

    await vi.advanceTimersByTimeAsync(SIMULATED_DELAY_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(settled).toBe(true);
    expect(SIMULATED_DELAY_MS).toBe(300);
  });

  it("stops waiting when the request is aborted", async () => {
    const controller = new AbortController();
    const pending = createSimulatedLeaderboardApi({ delayMs: 1000 }).getLeaderboard(
      "me",
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toBeDefined();
  });

  it("played: every statistic, top 50 with the current player 7th", async () => {
    const api = simulated(MockScenario.PLAYED);
    const statistics = await api.getHeroStatistics("me", "hero-1");
    const board = await api.getLeaderboard("me");

    expect(statistics.heroId).toBe("hero-1");
    expect(statistics.statistics).toHaveLength(STATISTICS_CATALOGUE.length);
    expect(statistics.consolidatedAt).toBe("2026-10-21T11:57:00.000Z");
    expect(board.entries).toHaveLength(50);
    expect(board.me).toMatchObject({ rank: 7, playerId: "me" });
    expect(board.entries[6]).toEqual(board.me);
  });

  it("empty: no statistic and nobody ranked", async () => {
    const api = simulated(MockScenario.EMPTY);
    expect(await api.getHeroStatistics("me", "h")).toMatchObject({
      consolidatedAt: null,
      statistics: [],
    });
    expect(await api.getLeaderboard("me")).toEqual({
      consolidatedAt: null,
      entries: [],
      me: null,
    });
  });

  it("consolidating: previous figures, current player outside the top 50", async () => {
    const api = simulated(MockScenario.CONSOLIDATING);
    const statistics = await api.getHeroStatistics("me", "h");
    const board = await api.getLeaderboard("me");

    expect(statistics.isConsolidating).toBe(true);
    expect(statistics.statistics.length).toBeLessThan(STATISTICS_CATALOGUE.length);
    expect(board.entries.some((row) => row.playerId === "me")).toBe(false);
    expect(board.me?.rank).toBe(87);
  });

  it("error: fails like the Gateway would", async () => {
    const api = simulated(MockScenario.ERROR);
    await expect(api.getLeaderboard("me")).rejects.toBeInstanceOf(GatewayError);
    await expect(api.getHeroStatistics("me", "h")).rejects.toMatchObject({
      status: 503,
    });
  });
});
