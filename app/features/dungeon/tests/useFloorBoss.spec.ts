import { describe, expect, it } from "vitest";
import { shallowRef } from "vue";
import { useFloorBoss } from "../composables/useFloorBoss";
import type { DecodedFloor } from "../dungeonMap";
import { decodeFloor } from "../dungeonMap";
import type { DungeonMapResponse } from "../types";
import mapFixture from "./fixtures/map-DGPEAP9GWJKZF-f0.json";

const floor = decodeFloor(mapFixture as DungeonMapResponse);

describe("useFloorBoss", () => {
  it("knows nothing before a floor is loaded", () => {
    const boss = useFloorBoss({ floor: shallowRef(null) });
    expect(boss.floorBoss.value).toBeNull();
    expect(boss.bossFailure.value).toBeNull();
  });

  it("locates the boss the backend placed", () => {
    const boss = useFloorBoss({ floor: shallowRef(floor) });
    expect(boss.floorBoss.value).toMatchObject({ x: 12, y: 22, roomId: 8 });
  });

  it("reports why the boss could not be located, and follows a new floor", () => {
    const broken: DecodedFloor = {
      ...floor,
      elements: floor.elements.filter((element) => element.type !== "boss"),
    };
    const floorRef = shallowRef<DecodedFloor | null>(broken);
    const boss = useFloorBoss({ floor: floorRef });
    expect(boss.bossFailure.value).toBe("missing");
    expect(boss.floorBoss.value).toBeNull();

    floorRef.value = floor;
    expect(boss.bossFailure.value).toBeNull();
  });
});
