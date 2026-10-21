import { describe, expect, it, vi } from "vitest";
import { createLeaderboardApi } from "../api/leaderboardApi";
import { HeroClass, RankingPeriod, RankingSort } from "../types";
import { query } from "./fixtures/leaderboardFixtures";
import type { GatewayClient } from "~/shared/utils/gateway";

function gatewayStub(): GatewayClient {
  return {
    request: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as unknown as GatewayClient;
}

describe("Leaderboard API", () => {
  it("reads hero statistics on the provisional progression route", async () => {
    const gateway = gatewayStub();
    const signal = new AbortController().signal;

    await createLeaderboardApi(gateway).getHeroStatistics(
      "player id",
      "hero/id",
      signal,
    );

    expect(gateway.get).toHaveBeenCalledWith(
      "progression/players/player%20id/heroes/hero%2Fid/statistics",
      { signal },
    );
  });

  it("reads the hero ranking with every filter as a query parameter", async () => {
    const gateway = gatewayStub();
    const signal = new AbortController().signal;

    await createLeaderboardApi(gateway).getRanking(
      query({
        playerId: "player-1",
        heroClass: HeroClass.SHAMAN,
        period: RankingPeriod.WEEK,
        search: "  Brenna ",
        sort: RankingSort.WIN_RATE,
        page: 3,
      }),
      signal,
    );

    expect(gateway.get).toHaveBeenCalledWith("progression/leaderboard/heroes", {
      query: {
        playerId: "player-1",
        class: "shaman",
        period: "week",
        search: "Brenna",
        sort: "win-rate",
        page: 3,
        pageSize: 10,
      },
      signal,
    });
  });

  it("leaves out class for all classes and search when it is blank", async () => {
    const gateway = gatewayStub();

    await createLeaderboardApi(gateway).getRanking(
      query({ heroClass: null, search: "   " }),
    );

    const options = vi.mocked(gateway.get).mock.calls[0]![1]!;
    expect(options.query).not.toHaveProperty("class");
    expect(options.query).not.toHaveProperty("search");
    expect(options.query).toEqual({
      playerId: "me-id",
      period: "all-time",
      sort: "total-xp",
      page: 1,
      pageSize: 10,
    });
  });

  it("reads a hero's detail and facts with an encoded hero id", async () => {
    const gateway = gatewayStub();
    const api = createLeaderboardApi(gateway);
    const signal = new AbortController().signal;

    await api.getRankingHeroDetail("hero/1 2", signal);
    await api.getRankingHeroFacts("hero/1 2", signal);

    expect(gateway.get).toHaveBeenNthCalledWith(
      1,
      "progression/leaderboard/heroes/hero%2F1%202",
      { signal },
    );
    expect(gateway.get).toHaveBeenNthCalledWith(
      2,
      "progression/leaderboard/heroes/hero%2F1%202/facts",
      { signal },
    );
  });

  it("reads the public rankings", async () => {
    const gateway = gatewayStub();

    await createLeaderboardApi(gateway).getPublicRanking();

    expect(gateway.get).toHaveBeenCalledWith("progression/leaderboard/public", {
      signal: undefined,
    });
  });
});
