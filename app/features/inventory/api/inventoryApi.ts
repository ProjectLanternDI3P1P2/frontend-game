/**
 * The inventory feature's API boundary (ADR-FE-009, ADR-FE-011). Reward owns the
 * inventory; the client only reads it and never credits an item locally (ADR-FE-008).
 */
import type { HeroInventory } from "../types";
import { useGateway } from "~/shared/composables/useGateway";
import type { GatewayClient } from "~/shared/utils/gateway";

export function createInventoryApi(client: GatewayClient) {
  return {
    /** GET /api/v1/heroes/{heroId}/inventory — 404 when Reward has no inventory yet. */
    getHeroInventory(heroId: string, signal?: AbortSignal): Promise<HeroInventory> {
      return client.get<HeroInventory>(
        `heroes/${encodeURIComponent(heroId)}/inventory`,
        { signal },
      );
    },
  };
}

export function useInventoryApi() {
  return createInventoryApi(useGateway());
}
