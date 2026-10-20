export type ChestLootDifficulty = "NORMAL" | "HARD";

export interface ChestLootItem {
  itemId: string;
  name: string;
  rarity: string;
  quantity: number;
}

/** Immutable Reward snapshot returned through Dungeon after a chest interaction. */
export interface ChestLootResult {
  rewardId: string;
  dungeonRunId: string;
  chestId: string;
  floor: number;
  difficulty: ChestLootDifficulty;
  alreadyGenerated: boolean;
  items: ChestLootItem[];
}

export type ChestLootStatus = "loading" | "success" | "error";

/** State of the Reward-owned modal for one Dungeon chest interaction. */
export interface ChestLootInteraction {
  chestElementId: number;
  status: ChestLootStatus;
  result: ChestLootResult | null;
  errorMessage: string | null;
}
