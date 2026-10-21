import { describe, expect, it, vi } from "vitest";
import { createLeaderboardApi } from "../api/leaderboardApi";
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

  it("asks for the top 50 and the current player's position in one call", async () => {
    const gateway = gatewayStub();

    await createLeaderboardApi(gateway).getLeaderboard("player-1");

    expect(gateway.get).toHaveBeenCalledWith("progression/leaderboard", {
      query: { limit: 50, playerId: "player-1" },
      signal: undefined,
    });
  });
});
