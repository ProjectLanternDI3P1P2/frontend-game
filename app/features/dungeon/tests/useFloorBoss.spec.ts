import { describe, expect, it } from "vitest";
import { shallowRef } from "vue";
import { useFloorBoss } from "../composables/useFloorBoss";
import type { DecodedFloor } from "../dungeonMap";
import { decodeFloor } from "../dungeonMap";
import type { DungeonMapResponse, DungeonRunResponse } from "../types";
import mapFixture from "./fixtures/map-DGPEAP9GWJKZF-f0.json";
import runFixture from "./fixtures/run-DGPEAP9GWJKZF.json";

const floor = decodeFloor(mapFixture as DungeonMapResponse);
const run = runFixture as DungeonRunResponse;

describe("useFloorBoss", () => {
  it("knows nothing before a floor is loaded", () => {
    const boss = useFloorBoss({ floor: shallowRef(null), run: shallowRef(null) });
    expect(boss.floorBoss.value).toBeNull();
    expect(boss.bossFailure.value).toBeNull();
    expect(boss.bossStanding.value).toBe(false);
  });

  it("follows the run for whether the boss still stands", () => {
    const runRef = shallowRef<DungeonRunResponse | null>(run);
    const boss = useFloorBoss({ floor: shallowRef(floor), run: runRef });
    expect(boss.floorBoss.value).toMatchObject({ x: 12, y: 22, roomId: 8 });
    expect(boss.bossStanding.value).toBe(true);

    runRef.value = { ...run, floorBossDefeated: true };
    expect(boss.bossStanding.value).toBe(false);
    expect(boss.floorBoss.value).not.toBeNull();
  });

  it("reports why the boss could not be located, and follows a new floor", () => {
    const broken: DecodedFloor = {
      ...floor,
      elements: floor.elements.filter((element) => element.type !== "boss"),
    };
    const floorRef = shallowRef<DecodedFloor | null>(broken);
    const boss = useFloorBoss({ floor: floorRef, run: shallowRef(run) });
    expect(boss.bossFailure.value).toBe("missing");
    expect(boss.floorBoss.value).toBeNull();

    floorRef.value = floor;
    expect(boss.bossFailure.value).toBeNull();
  });
});
