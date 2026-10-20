import type { HeroInventory } from "../types";
import { useInventoryApi } from "../api/inventoryApi";
import { GatewayError } from "~/shared/utils/gateway";

/**
 * Authoritative, read-only view of a hero's inventory. Reward grants are idempotent
 * server-side, so a duplicated grant never changes what `refresh()` returns; the
 * client therefore always re-reads instead of adding a reward locally (ADR-FE-008).
 */
export function useHeroInventory(heroId: Ref<string>) {
  const inventory = ref<HeroInventory | null>(null);
  const loading = ref(false);
  /** Reward unreachable or failing: the rest of the hero sheet stays usable. */
  const unavailable = ref(false);

  async function refresh() {
    loading.value = true;
    unavailable.value = false;
    try {
      inventory.value = await useInventoryApi().getHeroInventory(heroId.value);
    } catch (cause) {
      if (cause instanceof GatewayError && cause.status === 404) {
        inventory.value = { heroId: heroId.value, items: [], consumables: [] };
      } else {
        inventory.value = null;
        unavailable.value = true;
      }
    } finally {
      loading.value = false;
    }
  }

  return { inventory, loading, unavailable, refresh };
}
