/**
 * The final boss of the floor on screen, derived from what the explorer holds:
 * the decoded floor (where the backend placed it) and the run (whether it is
 * still standing). Nothing is stored here: after a reload or a resync, the
 * boss follows the run read again (ADR-FE-008).
 */
import type { Ref } from "vue";
import { computed } from "vue";
import type { FloorBoss, FloorBossFailure, FloorBossResult } from "../bossRules";
import { findFloorBoss } from "../bossRules";
import type { DecodedFloor } from "../dungeonMap";
import type { DungeonRunResponse } from "../types";

export interface FloorBossSources {
  floor: Readonly<Ref<DecodedFloor | null>>;
  run: Readonly<Ref<DungeonRunResponse | null>>;
}

export function useFloorBoss({ floor, run }: FloorBossSources) {
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
  /** The boss is still standing, as the server last said. */
  const bossStanding = computed(
    () => floorBoss.value !== null && run.value?.floorBossDefeated === false,
  );

  return { floorBoss, bossFailure, bossStanding };
}
