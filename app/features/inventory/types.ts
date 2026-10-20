/** Mirrors Reward's `HeroInventory` response (GET /api/v1/heroes/{heroId}/inventory). */
export interface InventoryItem {
  id: string;
  type: string;
  name: string;
  rarity: string;
  state: string;
  quantity: number;
  isEquipped: boolean;
  isReserved: boolean;
}

export interface HeroInventory {
  heroId: string;
  items: InventoryItem[];
  consumables: InventoryItem[];
}
