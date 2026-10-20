import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { GatewayError } from "~/shared/utils/gateway";
import { useHeroInventory } from "../composables/useHeroInventory";

const getHeroInventory = vi.fn();

vi.mock("../api/inventoryApi", () => ({
  useInventoryApi: () => ({ getHeroInventory }),
}));

const inventory = {
  heroId: "hero-1",
  items: [],
  consumables: [
    {
      id: "stack-1",
      type: "POTION",
      name: "Health Potion",
      rarity: "Common",
      state: "AVAILABLE",
      quantity: 3,
      isEquipped: false,
      isReserved: false,
    },
  ],
};

describe("useHeroInventory", () => {
  beforeEach(() => {
    getHeroInventory.mockReset();
  });

  it("exposes the inventory Reward returned", async () => {
    getHeroInventory.mockResolvedValue(inventory);
    const state = useHeroInventory(ref("hero-1"));

    await state.refresh();

    expect(state.inventory.value).toEqual(inventory);
    expect(state.unavailable.value).toBe(false);
  });

  it("reads the same inventory again when a grant was replayed", async () => {
    getHeroInventory.mockResolvedValue(inventory);
    const state = useHeroInventory(ref("hero-1"));

    await state.refresh();
    await state.refresh();

    expect(state.inventory.value?.consumables[0]?.quantity).toBe(3);
  });

  it("shows an unknown hero (404) as an empty inventory", async () => {
    getHeroInventory.mockRejectedValue(
      new GatewayError(404, { code: "NOT_FOUND", message: "Not found" }),
    );
    const state = useHeroInventory(ref("hero-1"));

    await state.refresh();

    expect(state.inventory.value).toEqual({
      heroId: "hero-1",
      items: [],
      consumables: [],
    });
    expect(state.unavailable.value).toBe(false);
  });

  it("flags Reward as unavailable on any other failure", async () => {
    getHeroInventory.mockRejectedValue(
      new GatewayError(503, { code: "UNAVAILABLE", message: "Down" }),
    );
    const state = useHeroInventory(ref("hero-1"));

    await state.refresh();

    expect(state.inventory.value).toBeNull();
    expect(state.unavailable.value).toBe(true);
  });
});
