/**
 * The final boss of the floor on screen, derived from the decoded floor the
 * explorer holds (where the backend placed it). Whether it still stands is the
 * run's `floorBossDefeated`. Nothing is stored here: after a reload, the boss
 * follows the floor read again (ADR-FE-008).
 */
import type { Ref } from "vue";
import { computed } from "vue";
import type { FloorBoss, FloorBossFailure, FloorBossResult } from "../bossRules";
import { findFloorBoss } from "../bossRules";
import type { DecodedFloor } from "../dungeonMap";

export interface FloorBossSources {
  floor: Readonly<Ref<DecodedFloor | null>>;
}

export function useFloorBoss({ floor }: FloorBossSources) {
  /** Null until a floor is loaded. */
  const bossCheck = computed<FloorBossResult | null>(() =>
    floor.value ? findFloorBoss(floor.value) : null,
  );
  /** Where the backend placed the boss; null when not loaded or the invariant is broken. */
  const floorBoss = computed<FloorBoss | null>(() =>
    bossCheck.value?.ok ? bossCheck.value.boss : null,
  );
  /** Why the boss could not be located; null when it was, or nothing is loaded. */
  const bossFailure = computed<FloorBossFailure | null>(() =>
    bossCheck.value && !bossCheck.value.ok ? bossCheck.value.reason : null,
  );
  return { floorBoss, bossFailure };
}
