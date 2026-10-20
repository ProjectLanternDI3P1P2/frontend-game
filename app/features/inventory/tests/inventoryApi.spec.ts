import { describe, expect, it, vi } from "vitest";
import { createInventoryApi } from "../api/inventoryApi";
import type { GatewayClient } from "~/shared/utils/gateway";

describe("Inventory API", () => {
  it("reads the hero inventory from Reward through the Gateway", async () => {
    const get = vi.fn().mockResolvedValue({ heroId: "h", items: [], consumables: [] });
    const api = createInventoryApi({ get } as unknown as GatewayClient);

    await api.getHeroInventory("hero/id");

    expect(get).toHaveBeenCalledWith("heroes/hero%2Fid/inventory", {
      signal: undefined,
    });
  });
});
