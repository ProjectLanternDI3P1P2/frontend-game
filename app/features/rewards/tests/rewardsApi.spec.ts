import { describe, expect, it, vi } from "vitest";
import { createRewardsApi, rewardsApiVersion } from "../api/rewardsApi";
import { createGatewayClient } from "~/shared/utils/gateway";

describe("Rewards API", () => {
  it("reads the group reward summary of a run", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          dungeonRunId: "run/1",
          viewerPlayerId: null,
          distributions: [],
        }),
      ),
    );
    const api = createRewardsApi(
      createGatewayClient({
        baseUrl: "https://gw.test",
        apiVersion: rewardsApiVersion("v1"),
        fetchImpl,
      }),
    );

    await api.getRunRewards("run/1");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://gw.test/api/rewards/v1/runs/run%2F1/rewards",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
