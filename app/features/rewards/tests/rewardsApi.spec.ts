import { describe, expect, it, vi } from "vitest";
import { createRewardsApi } from "../api/rewardsApi";
import type { GatewayClient } from "~/shared/utils/gateway";

describe("Rewards API", () => {
  it("reads the group reward summary of a run", async () => {
    const get = vi.fn().mockResolvedValue({ dungeonRunId: "run/1", distributions: [] });
    const api = createRewardsApi({ get } as unknown as GatewayClient);

    await api.getRunRewards("run/1");

    expect(get).toHaveBeenCalledWith("rewards/runs/run%2F1/rewards", {
      signal: undefined,
    });
  });
});
