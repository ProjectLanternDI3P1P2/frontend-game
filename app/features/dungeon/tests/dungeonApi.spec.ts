import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DungeonRunResponse,
  GenerateChestLootRequest,
  GenerateChestLootResult,
} from "../types";
import * as gateway from "~/shared/composables/useGateway";
import { DungeonHubClient } from "../api/dungeonHub";
import { generateChestLoot, moveHero } from "../api/dungeonApi";

describe("dungeonApi movement and chest loot transports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: { apiGatewayUrl: "http://gateway.test" },
    }));
  });

  it("keeps confirmed Hub movement separate from the Reward HTTP request", async () => {
    const run = {
      id: "0199a5b2-0000-7000-8000-000000000099",
    } as DungeonRunResponse;
    const request: GenerateChestLootRequest = {
      commandId: "0199a5b2-0000-7000-8000-000000000100",
      dungeonRunId: run.id,
      chestElementId: 19,
      floor: 1,
      difficulty: "NORMAL",
    };
    const loot: GenerateChestLootResult = {
      rewardId: "0199a5b2-0000-7000-8000-000000000101",
      dungeonRunId: run.id,
      chestId: "0199a5b2-0000-7000-8000-000000000102",
      lootTableId: "0199a5b2-0000-7000-8000-000000000103",
      floor: 1,
      difficulty: "NORMAL",
      alreadyGenerated: false,
      items: [],
    };
    const signal = new AbortController().signal;
    const hubMove = vi
      .spyOn(DungeonHubClient.prototype, "moveHero")
      .mockResolvedValue(run);
    const post = vi.fn().mockResolvedValue(loot);
    vi.spyOn(gateway, "useGateway").mockReturnValue(
      { post } as unknown as ReturnType<typeof gateway.useGateway>,
    );

    await expect(moveHero(run.id, "south")).resolves.toBe(run);
    await expect(generateChestLoot(request, signal)).resolves.toBe(loot);

    expect(hubMove).toHaveBeenCalledWith(run.id, "south");
    expect(post).toHaveBeenCalledWith("rewards/chest-loot/generate", request, {
      signal,
    });
  });
});
