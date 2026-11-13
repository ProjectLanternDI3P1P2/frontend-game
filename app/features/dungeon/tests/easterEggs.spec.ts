import { describe, expect, it, vi } from "vitest";
import { describeRoom } from "../composables/useDungeonExplorer";
import {
  Cell,
  cellAt,
  decodeFloor,
  elementsAt,
  isWalkableAt,
  roomAt,
} from "../dungeonMap";
import { planFloor, renderFloor } from "../tiles/autotile";
import { DECORATIONS, MISSING_DECORATION, decorationSprite } from "../tiles/sprites";
import type { SpriteRect } from "../tiles/tileset";
import { BANNERS, WALL_DETAILS, WALL_FOOT } from "../tiles/tileset";
import type {
  DecorationKindName,
  DungeonMapResponse,
  DungeonRoom,
  EasterEggName,
  RoomTypeName,
} from "../types";

// The explorer only needs the API at run time, not to be imported.
vi.mock("../api/dungeonApi", () => ({}));

/** The Minecraft room as the Dungeon service sends it (seed 01GWTHZB70BF7), cut down to 7 x 5. */
const minecraftRoomMap: DungeonMapResponse = {
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
      easterEgg: "minecraft",
    },
  ],
  elements: [
    { id: "c", type: "decoration", x: 4, y: 3, roomId: 0, kind: "grassBlock" },
  ],
};

/** The Portal room: its two portals hang above the top row, whose tiles stay walkable. */
const portalRoomMap: DungeonMapResponse = {
  ...minecraftRoomMap,
  seed: "0CR57NSZKFK60",
  rows: minecraftRoomMap.rows.map((row) => row.replace("*", ".")),
  rooms: minecraftRoomMap.rooms.map((room) => ({ ...room, easterEgg: "portal" })),
  elements: [
    { id: "a", type: "decoration", x: 2, y: 1, roomId: 0, kind: "bluePortal" },
    { id: "b", type: "decoration", x: 6, y: 1, roomId: 0, kind: "orangePortal" },
  ],
};

describe("easter-egg rooms", () => {
  const floor = decodeFloor(minecraftRoomMap);

  it("blocks the ground under a decoration, as the backend does", () => {
    expect(cellAt(floor, 4, 3)).toBe(Cell.Decoration);
    expect(isWalkableAt(floor, { x: 4, y: 3 })).toBe(false);
  });

  it("keeps a portal's tile walkable: the portal hangs on the wall above it", () => {
    const portals = decodeFloor(portalRoomMap);

    expect(isWalkableAt(portals, { x: 2, y: 1 })).toBe(true);
    expect(isWalkableAt(portals, { x: 6, y: 1 })).toBe(true);
  });

  it("keeps the room secret, with its easter egg and its decorations", () => {
    expect(roomAt(floor, { x: 4, y: 3 })?.type).toBe("secret");
    expect(roomAt(floor, { x: 4, y: 3 })?.easterEgg).toBe("minecraft");
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
    for (const sprite of [
      ...kinds.map((kind) => DECORATIONS[kind]),
      MISSING_DECORATION,
    ]) {
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

describe("decorationSprite", () => {
  it("gives every known decoration its own sprite", () => {
    expect(decorationSprite("ship")).toBe(DECORATIONS.ship);
    expect(decorationSprite("bluePortal")).toBe(DECORATIONS.bluePortal);
  });

  it("falls back on the missing texture for a kind that is null or unknown", () => {
    expect(decorationSprite(null)).toBe(MISSING_DECORATION);
    expect(decorationSprite("toaster")).toBe(MISSING_DECORATION);
    // A kind of enemy, as a mistaken contract could send it.
    expect(decorationSprite("zombie")).toBe(MISSING_DECORATION);
    // Not a decoration, though an object has the key.
    expect(decorationSprite("constructor")).toBe(MISSING_DECORATION);
    expect(decorationSprite("toString")).toBe(MISSING_DECORATION);
  });
});

describe("entering a secret room", () => {
  const announced = (easterEgg: EasterEggName | null | undefined) => {
    const room: DungeonRoom = { ...minecraftRoomMap.rooms[0]!, easterEgg };
    return describeRoom(decodeFloor({ ...minecraftRoomMap, rooms: [room] }), 0);
  };

  it.each([
    ["outerWildsShip", "a strange room: a little ship has landed here"],
    [
      "outerWildsCampfire",
      "a strange room: a campfire burns, a marshmallow roasting over it",
    ],
    ["celeste", "a strange room: a winged strawberry floats in the air"],
    [
      "minecraft",
      "a strange room: a lone grass block stands in the middle of the dungeon",
    ],
    ["portal", "a strange room: a blue and an orange portal hang on the back wall"],
  ] as const)("announces the %s room in the live region", (easterEgg, words) => {
    expect(announced(easterEgg)).toBe(`Room 1 of 1: ${words}.`);
  });

  it("still announces a secret room whose easter egg this client does not know", () => {
    expect(announced(null)).toBe("Room 1 of 1: a strange room.");
    expect(announced(undefined)).toBe("Room 1 of 1: a strange room.");
  });

  it("tells a plain room apart: nothing strange is announced", () => {
    const room: DungeonRoom = {
      ...minecraftRoomMap.rooms[0]!,
      type: "empty",
      easterEgg: null,
    };
    const empty = decodeFloor({ ...minecraftRoomMap, rooms: [room] });

    expect(describeRoom(empty, 0)).toBe("Room 1 of 1.");
  });
});

describe("rendering an easter-egg room", () => {
  it("lays no furniture under a decoration, and the ground there blocks the way", () => {
    const secret = decodeFloor(minecraftRoomMap);
    const tile = 3 * secret.width + 4;

    const layers = renderFloor(secret)[tile]!;

    // Only the plain ground: no barrel, no litter, nothing standing on it.
    expect(layers).toHaveLength(1);
    expect(layers[0]!.className).toContain("dungeon-tile--atlas");
    expect(
      layers.some((layer) => layer.className.includes("dungeon-tile--props")),
    ).toBe(false);
    expect(isWalkableAt(secret, { x: 4, y: 3 })).toBe(false);
  });
});

/**
 * A wide hall like a backend room: a ring of walls in the void, two portals on the north one.
 * Wide on purpose: the dressing of a wall is a dice roll per tile.
 */
function hallMap(type: RoomTypeName): DungeonMapResponse {
  const width = 64;
  const height = 22;
  const rows = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const inside = x >= 2 && x <= 61 && y >= 6 && y <= 14;
      const ring = x >= 1 && x <= 62 && y >= 5 && y <= 15;
      return inside ? "." : ring ? "#" : " ";
    }).join(""),
  );
  return {
    seed: "0CR57NSZKFK60",
    generatorVersion: 7,
    floor: 0,
    floorCount: 4,
    isFinalFloor: false,
    width,
    height,
    legend: { " ": "void", ".": "floor", "#": "wall" },
    rows,
    entrance: { x: 30, y: 12 },
    rooms: [
      {
        id: 0,
        type,
        gridX: 0,
        gridY: 0,
        x: 2,
        y: 6,
        width: 60,
        height: 9,
        center: { x: 31, y: 10 },
        depth: 0,
        connectedRoomIds: [],
        easterEgg: type === "secret" ? "portal" : null,
      },
    ],
    elements: [
      { id: "a", type: "decoration", x: 10, y: 6, roomId: 0, kind: "bluePortal" },
      { id: "b", type: "decoration", x: 40, y: 6, roomId: 0, kind: "orangePortal" },
    ],
  };
}

describe("the walls and the floor of an easter-egg room", () => {
  const sameSprite = (a: SpriteRect, b: SpriteRect) =>
    JSON.stringify(a) === JSON.stringify(b);
  const isOneOf = (sprite: SpriteRect, candidates: readonly SpriteRect[]) =>
    candidates.some((candidate) => sameSprite(sprite, candidate));

  /** What hangs on a wall (torches, banners, chains, blood) and what stands at its foot. */
  function dressing(type: RoomTypeName) {
    const hall = decodeFloor(hallMap(type));
    const plan = planFloor(hall);
    const layers = plan.map((tile, index) => ({
      x: index % hall.width,
      y: Math.floor(index / hall.width),
      tile,
    }));
    const hung = layers.filter(({ tile }) =>
      tile.some(
        (layer) =>
          layer.sheet === "torch" ||
          isOneOf(layer.sprite, BANNERS) ||
          isOneOf(layer.sprite, [WALL_DETAILS.chain, WALL_DETAILS.bloodDrip]),
      ),
    );
    const feet = layers.filter(({ tile }) =>
      tile.some((layer) => isOneOf(layer.sprite, WALL_FOOT)),
    );
    return { hung, feet, layers };
  }

  it("hangs nothing on the walls and puts nothing at their foot", () => {
    const { hung, feet } = dressing("secret");

    expect(hung).toEqual([]);
    expect(feet).toEqual([]);
  });

  it("is a choice of the secret room: the same hall as a combat room is dressed", () => {
    // The control that gives the test its meaning: dice that never roll would pass it too.
    const { hung, feet } = dressing("combat");

    expect(hung.length).toBeGreaterThan(0);
    expect(feet.length).toBeGreaterThan(0);
  });

  it("leaves the wall bare above every portal", () => {
    const { layers } = dressing("secret");

    for (const x of [10, 40]) {
      for (const y of [3, 4, 5, 6]) {
        const tile = layers.find((layer) => layer.x === x && layer.y === y)!.tile;
        expect(tile.some((layer) => layer.sheet === "torch")).toBe(false);
        expect(tile.some((layer) => isOneOf(layer.sprite, BANNERS))).toBe(false);
        expect(tile.some((layer) => isOneOf(layer.sprite, WALL_FOOT))).toBe(false);
      }
    }
  });
});
