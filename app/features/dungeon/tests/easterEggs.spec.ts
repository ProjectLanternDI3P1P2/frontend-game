import { describe, expect, it } from "vitest";
import {
  Cell,
  cellAt,
  decodeFloor,
  elementsAt,
  isWalkableAt,
  roomAt,
} from "../dungeonMap";
import { DECORATIONS } from "../tiles/sprites";
import type { DecorationKindName, DungeonMapResponse } from "../types";

/** A secret room as the Dungeon service sends it, cut down to 7 x 5. */
const secretRoomMap: DungeonMapResponse = {
  seed: "01GWTHZB70BF7",
  generatorVersion: 7,
  floor: 0,
  floorCount: 4,
  isFinalFloor: false,
  width: 9,
  height: 7,
  legend: { " ": "void", ".": "floor", "#": "wall", "*": "decoration" },
  rows: [
    "#########",
    "#.......#",
    "#.......#",
    "#...*...#",
    "#.......#",
    "#.......#",
    "#########",
  ],
  entrance: { x: 4, y: 5 },
  rooms: [
    {
      id: 0,
      type: "secret",
      gridX: 0,
      gridY: 0,
      x: 1,
      y: 1,
      width: 7,
      height: 5,
      center: { x: 4, y: 3 },
      depth: 0,
      connectedRoomIds: [],
      easterEgg: "portal",
    },
  ],
  elements: [
    { id: "a", type: "decoration", x: 2, y: 1, roomId: 0, kind: "bluePortal" },
    { id: "b", type: "decoration", x: 6, y: 1, roomId: 0, kind: "orangePortal" },
    { id: "c", type: "decoration", x: 4, y: 3, roomId: 0, kind: "grassBlock" },
  ],
};

describe("easter-egg rooms", () => {
  const floor = decodeFloor(secretRoomMap);

  it("blocks the ground under a decoration, as the backend does", () => {
    expect(cellAt(floor, 4, 3)).toBe(Cell.Decoration);
    expect(isWalkableAt(floor, { x: 4, y: 3 })).toBe(false);
  });

  it("keeps a portal's tile walkable: the portal hangs on the wall above it", () => {
    expect(isWalkableAt(floor, { x: 2, y: 1 })).toBe(true);
  });

  it("keeps the room secret, with its easter egg and its decorations", () => {
    expect(roomAt(floor, { x: 4, y: 3 })?.easterEgg).toBe("portal");
    expect(elementsAt(floor, { x: 4, y: 3 }).map((element) => element.kind)).toEqual([
      "grassBlock",
    ]);
  });

  it("draws every decoration from the easter-egg sheet, inside it", () => {
    const kinds: DecorationKindName[] = [
      "ship",
      "campfire",
      "strawberry",
      "grassBlock",
      "bluePortal",
      "orangePortal",
    ];
    for (const kind of kinds) {
      const sprite = DECORATIONS[kind];
      expect(sprite.sheet).toBe("eggs");
      expect(sprite.x + sprite.w * sprite.frames).toBeLessThanOrEqual(200);
      expect(sprite.y + sprite.h).toBeLessThanOrEqual(64);
    }
  });

  it("hangs the portals on the wall above their tile, and stands the ship on its footprint", () => {
    expect(DECORATIONS.bluePortal.dy + DECORATIONS.bluePortal.h).toBe(0);
    expect(DECORATIONS.orangePortal.dy + DECORATIONS.orangePortal.h).toBe(0);
    // Three tiles wide, its feet on the bottom of its two rows.
    expect(DECORATIONS.ship.w).toBe(48);
    expect(DECORATIONS.ship.dy + DECORATIONS.ship.h).toBe(32);
  });
});
