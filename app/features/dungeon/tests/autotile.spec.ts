import { describe, expect, it } from "vitest";
import type { CellCode } from "../dungeonMap";
import { Cell, cellAt, decodeFloor } from "../dungeonMap";
import { MAX_LAYERS, isBigProp, isOpen, planFloor, renderFloor, visualSeed } from "../tiles/autotile";
import { ATLAS_SIZE, RIM_KEYS } from "../tiles/atlas.generated";
import type { SpriteRect } from "../tiles/tileset";
import {
  BANNERS,
  DECALS,
  FACES,
  FENCES,
  LADDER,
  LIQUID_BANKS,
  OBSTACLES,
  OPEN_CHESTS,
  PILLARS,
  SHORT_PILLARS,
  THEMES,
  TOMBS,
  WALL_DETAILS,
  liquidSprite,
  rimSprite,
  themeOf,
} from "../tiles/tileset";
import type { DungeonMapResponse } from "../types";
import fixture from "./fixtures/map-DGPEAP9GWJKZF-f0.json";
import multiFloorFixture from "./fixtures/map-DDR55WKRPRVBN-f0.json";

const floor = decodeFloor(fixture as DungeonMapResponse);
const plan = planFloor(floor);
const layersAt = (x: number, y: number) => plan[y * floor.width + x]!;
const sprites = (x: number, y: number) => layersAt(x, y).map((layer) => layer.sprite);

function positions(predicate: (x: number, y: number) => boolean) {
  const found: { x: number; y: number }[] = [];
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) if (predicate(x, y)) found.push({ x, y });
  }
  return found;
}

const is = (code: CellCode) => (x: number, y: number) => cellAt(floor, x, y) === code;
const isWallLike = (x: number, y: number) =>
  [Cell.Wall, Cell.Gate].includes(cellAt(floor, x, y) as never);
const isFace = (x: number, y: number) =>
  isWallLike(x, y) && isOpen(cellAt(floor, x, y + 1)) && !isOpen(cellAt(floor, x, y - 1));
const faceSets = [FACES.short, FACES.upper, FACES.lower];
const allFaces = faceSets.flatMap((set) => [...set.plain, ...set.worn, set.leftEnd, set.rightEnd]);

const same = (a: SpriteRect | undefined, b: SpriteRect) => JSON.stringify(a) === JSON.stringify(b);
const isOneOf = (sprite: SpriteRect | undefined, candidates: readonly SpriteRect[]) =>
  candidates.some((candidate) => same(sprite, candidate));
/** Wall tops fill the first rows of the atlas, before the faces. */
const isRim = (sprite: SpriteRect | undefined) => !!sprite && sprite.y < FACES.short.plain[0]!.y;

describe("autotiling", () => {
  it("is deterministic: the same seed always looks the same", () => {
    expect(renderFloor(floor)).toEqual(renderFloor(decodeFloor(fixture as DungeonMapResponse)));
  });

  it("changes the variants with the seed and the floor", () => {
    expect(visualSeed("0KX4M2T9QZ7PA", 0)).not.toBe(visualSeed("0KX4M2T9QZ7PB", 0));
    expect(visualSeed("0KX4M2T9QZ7PA", 0)).not.toBe(visualSeed("0KX4M2T9QZ7PA", 1));
  });

  it("draws nothing in the void far from any wall", () => {
    const deepVoid = positions((x, y) =>
      [-2, -1, 0, 1, 2].every((dy) => [-1, 0, 1].every((dx) => is(Cell.Void)(x + dx, y + dy))),
    );
    expect(deepVoid.length).toBeGreaterThan(0);
    for (const { x, y } of deepVoid) expect(layersAt(x, y)).toEqual([]);
  });

  it("shows the bricks of every wall seen from the front, and tops them", () => {
    const faces = positions(isFace);
    expect(faces.length).toBeGreaterThan(100);
    for (const { x, y } of faces) {
      expect(isOneOf(sprites(x, y)[0], allFaces)).toBe(true);
      // One tile high under something, two where the void above leaves room: then the rim.
      const isTall = isOneOf(sprites(x, y - 1)[0], allFaces);
      expect(isRim(sprites(x, isTall ? y - 2 : y - 1)[0])).toBe(true);
    }
  });

  it("raises the walls of a room two tiles high where the void allows it", () => {
    const tall = positions(
      (x, y) => isFace(x, y) && is(Cell.Void)(x, y - 1) && is(Cell.Void)(x, y - 2),
    );
    expect(tall.length).toBeGreaterThan(100);
    for (const { x, y } of tall) {
      expect(isOneOf(sprites(x, y - 1)[0], [...FACES.upper.plain, ...FACES.upper.worn, FACES.upper.leftEnd, FACES.upper.rightEnd])).toBe(true);
      expect(isOneOf(sprites(x, y)[0], [...FACES.lower.plain, ...FACES.lower.worn, FACES.lower.leftEnd, FACES.lower.rightEnd])).toBe(true);
    }
  });

  it("keeps a wall the same height from one end to the other", () => {
    const isTall = (x: number, y: number) => isOneOf(sprites(x, y - 1)[0], allFaces);
    // Unless a room stands right on top of one of them: its floor leaves no room for bricks.
    const roomAbove = (x: number, y: number) => isOpen(cellAt(floor, x, y - 2));
    const pairs = positions(
      (x, y) => isFace(x, y) && isFace(x + 1, y) && roomAbove(x, y) === roomAbove(x + 1, y),
    );
    expect(pairs.length).toBeGreaterThan(100);
    for (const { x, y } of pairs) expect(isTall(x + 1, y)).toBe(isTall(x, y));
  });

  it("hangs torches, banners and chains on walls two tiles high only", () => {
    // Walls one tile high: under a room standing right on top of them, or inside a room.
    let short = 0;
    for (const map of [fixture, multiFloorFixture]) {
      const other = decodeFloor(map as DungeonMapResponse);
      const otherPlan = planFloor(other);
      const at = (x: number, y: number) => otherPlan[y * other.width + x] ?? [];
      for (let y = 1; y < other.height - 1; y++) {
        for (let x = 0; x < other.width; x++) {
          const code = cellAt(other, x, y);
          const isWallFace = (code === Cell.Wall || code === Cell.Gate) && isOpen(cellAt(other, x, y + 1));
          if (!isWallFace || isOneOf(at(x, y - 1)[0]?.sprite, allFaces) || isOpen(cellAt(other, x, y - 1))) continue;
          short++;
          const hangs = at(x, y).some(
            (layer) =>
              layer.sheet === "torch" ||
              isOneOf(layer.sprite, BANNERS) ||
              isOneOf(layer.sprite, [WALL_DETAILS.chain, WALL_DETAILS.bloodDrip]),
          );
          expect(hangs).toBe(false);
        }
      }
    }
    expect(short).toBeGreaterThan(0);
  });

  it("hangs banners in the rooms, never in a corridor", () => {
    for (const { x, y } of positions(isFace)) {
      const inCorridor = floor.roomIdByCell[(y + 1) * floor.width + x] === -1;
      const hasBanner = [y, y - 1].some((row) => layersAt(x, row).some((layer) => isOneOf(layer.sprite, BANNERS)));
      if (inCorridor) expect(hasBanner).toBe(false);
    }
  });

  it("keeps the wall two tiles high on both sides of a corridor leaving a room northwards", () => {
    const openings = positions(
      (x, y) => is(Cell.Door)(x, y) && is(Cell.Floor)(x, y - 1) && isFace(x - 1, y) && isFace(x + 1, y),
    );
    expect(openings.length).toBeGreaterThan(0);
    const upper = [...FACES.upper.plain, ...FACES.upper.worn, FACES.upper.leftEnd, FACES.upper.rightEnd];
    for (const { x, y } of openings) {
      // The corridor's walls rise as bricks beside the opening, which they end...
      expect(sprites(x - 1, y - 1)[0]).toEqual(FACES.upper.rightEnd);
      expect(sprites(x + 1, y - 1)[0]).toEqual(FACES.upper.leftEnd);
      expect(isOneOf(sprites(x - 1, y - 1)[0], upper)).toBe(true);
      // ...and are topped like the rest of the wall.
      expect(isRim(sprites(x - 1, y - 2)[0])).toBe(true);
      expect(isRim(sprites(x + 1, y - 2)[0])).toBe(true);
    }
  });

  it("stands a ladder in the middle of the start room, with nothing on or under it", () => {
    const { x, y } = floor.entrance;
    expect(layersAt(x, y).at(-1)!.sprite).toEqual(LADDER);
    for (const row of [y - 2, y - 1]) {
      expect(layersAt(x, row).filter((layer) => layer.sheet === "props")).toHaveLength(0);
    }
  });

  it("lays the bricks of a wall in order, so that their courses line up", () => {
    for (const set of faceSets) {
      const plainRuns = positions(
        (x, y) => isOneOf(sprites(x, y)[0], set.plain) && isOneOf(sprites(x + 1, y)[0], set.plain),
      );
      for (const { x, y } of plainRuns) {
        const index = set.plain.findIndex((face) => same(face, sprites(x, y)[0]!));
        expect(sprites(x + 1, y)[0]).toEqual(set.plain[(index + 1) % set.plain.length]);
      }
    }
  });

  it("frames the gate with torches and keeps the arches of the doors clear", () => {
    const hasTorch = (column: number, y: number) =>
      [y, y - 1].some((row) => layersAt(column, row).some((layer) => layer.sheet === "torch"));
    const gate = positions(is(Cell.Gate))[0]!;
    expect([-3, -2, 2, 3].filter((dx) => hasTorch(gate.x + dx, gate.y))).toHaveLength(2);

    const doors = positions(is(Cell.Gate));
    expect(doors).toHaveLength(1);
    for (const { x, y } of doors) {
      for (const column of [x - 1, x, x + 1]) {
        for (const layer of [y, y - 1].flatMap((row) => layersAt(column, row))) {
          expect(layer.sheet).not.toBe("torch");
          expect(isOneOf(layer.sprite, BANNERS)).toBe(false);
        }
      }
    }
  });

  it("hugs the room with the top of its side walls", () => {
    // A west wall: wall tops above and below, the room on its east side, the void on its west.
    const westWalls = positions(
      (x, y) =>
        [-1, 0, 1].every(
          (dy) => is(Cell.Wall)(x, y + dy) && is(Cell.Floor)(x + 1, y + dy) && is(Cell.Void)(x - 1, y + dy),
        ) &&
        is(Cell.Wall)(x, y + 2) &&
        // No other wall rising just beside it.
        [2, 3].every((dy) => is(Cell.Void)(x - 1, y + dy)),
    );
    expect(westWalls.length).toBeGreaterThan(20);
    for (const { x, y } of westWalls) {
      expect(isOneOf(sprites(x, y)[0], [rimSprite("RIRV----"), rimSprite("RIRV----", true)])).toBe(true);
    }
  });

  it("closes the bottom corners of every room", () => {
    const corners = floor.rooms.filter((room) => {
      const left = room.x - 1;
      const bottom = room.y + room.height;
      return (
        is(Cell.Wall)(left, bottom) &&
        is(Cell.Wall)(left, bottom - 1) &&
        is(Cell.Wall)(left + 1, bottom) &&
        is(Cell.Void)(left - 1, bottom) &&
        is(Cell.Void)(left, bottom + 1) &&
        is(Cell.Floor)(left + 1, bottom - 1)
      );
    });
    expect(corners.length).toBeGreaterThanOrEqual(floor.rooms.length / 2);
    for (const room of corners) {
      // Wall tops north and east, the void south and west, the room in the corner between.
      expect(sprites(room.x - 1, room.y + room.height)[0]).toEqual(rimSprite("RRVVI---"));
    }
  });

  it("draws nothing below the wall closing a room on its south side: the void starts there", () => {
    const southWalls = positions(
      (x, y) =>
        is(Cell.Wall)(x, y) &&
        is(Cell.Floor)(x, y - 1) &&
        [-1, 0, 1].every((dx) => is(Cell.Wall)(x + dx, y) && is(Cell.Void)(x + dx, y + 1)),
    );
    expect(southWalls.length).toBeGreaterThan(50);
    for (const { x, y } of southWalls) {
      expect(isRim(sprites(x, y)[0])).toBe(true);
      if (!isRim(sprites(x, y + 1)[0])) expect(layersAt(x, y + 1)).toHaveLength(0);
    }
  });

  it("paves every open tile, and stands a prop on every obstacle, pillar and fence", () => {
    for (const { x, y } of positions((x, y) => isOpen(cellAt(floor, x, y)))) {
      expect(layersAt(x, y).length).toBeGreaterThan(0);
    }
    const blocking: [CellCode, readonly SpriteRect[]][] = [
      [Cell.Obstacle, Object.values(OBSTACLES).flat().map((prop) => prop.sprite)],
      [Cell.Pillar, [...PILLARS, ...SHORT_PILLARS]],
      [Cell.Fence, Object.values(FENCES)],
    ];
    for (const [code, props] of blocking) {
      const tiles = positions(is(code));
      expect(tiles.length).toBeGreaterThan(0);
      for (const { x, y } of tiles) {
        // The ground, then what stands on it (a fence that ends adds the rail to its post).
        const [ground, ...standing] = layersAt(x, y);
        expect(ground!.sheet).toBe("atlas");
        expect(standing.length).toBeGreaterThan(0);
        for (const layer of standing) {
          expect(isOneOf(layer.sprite, props)).toBe(true);
          // Standing on the tile: bottom edges aligned.
          expect(layer.dy + layer.sprite.h).toBe(16);
        }
      }
    }
  });

  it("stands columns, furniture and the ladder upright, in depth order with the hero", () => {
    for (const { x, y } of positions((x, y) => is(Cell.Obstacle)(x, y) || is(Cell.Pillar)(x, y))) {
      expect(layersAt(x, y)[1]!.upright).toBe(true);
    }
    const { x, y } = floor.entrance;
    expect(layersAt(x, y).at(-1)!.upright).toBe(true);
    expect(renderFloor(floor)[y * floor.width + x]!.at(-1)!.className).toContain("dungeon-tile--upright");
    // The ground and what lies on it stay below.
    expect(layersAt(x, y)[0]!.upright).toBeUndefined();
  });

  it("draws each piece of a fence for its place in the fence", () => {
    // A floor with a fenced treasure: rails along its north side, posts down its sides.
    const fenced = decodeFloor(fixture as DungeonMapResponse);
    const fencedPlan = planFloor(fenced);
    const fence = (x: number, y: number) => cellAt(fenced, x, y) === Cell.Fence;
    const seen = new Set<string>();
    for (let y = 0; y < fenced.height; y++) {
      for (let x = 0; x < fenced.width; x++) {
        if (!fence(x, y)) continue;
        const sprites = fencedPlan[y * fenced.width + x]!.slice(1).map((layer) => layer.sprite);
        const left = fence(x - 1, y);
        const right = fence(x + 1, y);
        let expected: SpriteRect[];
        if (left && right) expected = [FENCES.across];
        else if (right) expected = [FENCES.railRight, FENCES.leftEnd];
        else if (left) expected = [FENCES.railLeft, FENCES.rightEnd];
        else expected = [fence(x, y - 1) || fence(x, y + 1) ? FENCES.along : FENCES.leftEnd];
        expect(sprites).toEqual(expected);
        seen.add(JSON.stringify(expected.at(-1)));
      }
    }
    // Every piece shows up around the treasure.
    expect(seen.size).toBe(4);
  });

  it("fills the pools with rippling water or lava, banked where the floor stands", () => {
    for (const [code, sheet] of [[Cell.Water, "water"], [Cell.Lava, "lava"]] as const) {
      const pool = positions(is(code));
      expect(pool.length).toBeGreaterThan(0);
      for (const { x, y } of pool) {
        const [liquid, ...rest] = layersAt(x, y);
        expect(liquid).toEqual({ sheet, sprite: liquidSprite(sheet, x, y), dx: 0, dy: 0 });
        const bank = (dx: number, dy: number) => cellAt(floor, x + dx, y + dy) !== code;
        const mask = (bank(0, -1) ? 1 : 0) | (bank(1, 0) ? 2 : 0) | (bank(0, 1) ? 4 : 0) | (bank(-1, 0) ? 8 : 0);
        expect(rest).toEqual(mask === 0 ? [] : [expect.objectContaining({ sprite: LIQUID_BANKS[mask] })]);
      }
    }
  });

  it("lays each tomb across its two or three tiles, from the first one", () => {
    const tombs = positions((x, y) => is(Cell.Tomb)(x, y) && !is(Cell.Tomb)(x - 1, y));
    expect(tombs.length).toBeGreaterThan(0);
    for (const { x, y } of tombs) {
      const length = is(Cell.Tomb)(x + 2, y) ? 3 : 2;
      const [, tomb, ...rest] = layersAt(x, y);
      expect(rest).toHaveLength(0);
      expect(tomb!.upright).toBe(true);
      const sprites = length === 3 ? [TOMBS.long, TOMBS.longBloodied] : [TOMBS.short, TOMBS.shortBloodied];
      expect(isOneOf(tomb!.sprite, sprites)).toBe(true);
      // Centred on its tiles.
      expect(tomb!.dx * 2 + tomb!.sprite.w).toBeCloseTo(length * 16, -1);
      for (let dx = 1; dx < length; dx++) expect(layersAt(x + dx, y)).toHaveLength(1);
    }
  });

  it("keeps the columns of a colonnade short, so that each one is seen", () => {
    const furnished = decodeFloor(fixture as DungeonMapResponse);
    const furnishedPlan = planFloor(furnished);
    const pillar = (x: number, y: number) => cellAt(furnished, x, y) === Cell.Pillar;
    let colonnade = 0;
    for (let y = 0; y < furnished.height; y++) {
      for (let x = 0; x < furnished.width; x++) {
        if (!pillar(x, y) || ![-3, -2, -1, 1, 2, 3].some((dy) => pillar(x, y + dy))) continue;
        colonnade++;
        expect(isOneOf(furnishedPlan[y * furnished.width + x]![1]!.sprite, SHORT_PILLARS)).toBe(true);
      }
    }
    expect(colonnade).toBeGreaterThan(0);
  });

  it("opens the chests that hold nothing, and keeps big furniture apart", () => {
    expect(new Set(OPEN_CHESTS.map((chest) => chest.sheet))).toEqual(new Set(["objects"]));
    expect(OBSTACLES.treasure).toEqual(expect.arrayContaining([...OPEN_CHESTS]));
    const big = positions((x, y) => is(Cell.Obstacle)(x, y) && isBigProp(layersAt(x, y)[1]!.sprite));
    for (const { x, y } of big) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]] as const) {
        expect(is(Cell.Obstacle)(x + dx, y + dy)).toBe(false);
      }
      // Never over a wall, a column or a fence beside it.
      for (const dx of [-1, 1]) expect(is(Cell.Floor)(x + dx, y) || is(Cell.Grate)(x + dx, y)).toBe(true);
    }
  });

  it("dresses each room for what it is: coins in the treasury, blood in the lair of the boss", () => {
    const roomOf = (x: number, y: number) =>
      floor.rooms[floor.roomIdByCell[y * floor.width + x]!]?.type;
    for (const { x, y } of positions(is(Cell.Obstacle))) {
      const type = roomOf(x, y);
      if (type) expect(isOneOf(layersAt(x, y)[1]!.sprite, OBSTACLES[type].map((prop) => prop.sprite))).toBe(true);
    }
  });

  it("draws the ground of a tile first, and the rest over it", () => {
    for (const layers of plan) {
      // The ground is a flagstone, or a pool of water or lava.
      if (layers.length > 1) expect(["atlas", "water", "lava"]).toContain(layers[0]!.sheet);
    }
  });

  it("brings the dungeon to life: torches, banners, cobwebs and litter", () => {
    const all = plan.flat();
    expect(all.filter((layer) => layer.sheet === "torch").length).toBeGreaterThan(5);
    expect(all.filter((layer) => isOneOf(layer.sprite, BANNERS)).length).toBeGreaterThan(1);
    expect(all.filter((layer) => layer.sheet === "props" && layer.transform === "flip-x").length).toBeGreaterThan(0);
    const litter = positions(
      (x, y) => is(Cell.Floor)(x, y) && layersAt(x, y).some((layer) => layer.sheet === "props"),
    );
    expect(litter.length).toBeGreaterThan(40);
  });

  it("never spills blood, bones or rubble over a wall", () => {
    const decals = Object.values(DECALS).flat() as SpriteRect[];
    for (const { x, y } of positions(is(Cell.Floor))) {
      for (const layer of layersAt(x, y).filter((layer) => isOneOf(layer.sprite, decals))) {
        const spillX = [layer.dx < 0 ? -1 : 0, layer.dx + layer.sprite.w > 16 ? 1 : 0];
        const spillY = [layer.dy < 0 ? -1 : 0, layer.dy + layer.sprite.h > 16 ? 1 : 0];
        for (const dy of spillY) for (const dx of spillX) expect(cellAt(floor, x + dx, y + dy)).toBe(Cell.Floor);
      }
    }
  });

  it("hangs torches and banners on wall faces only", () => {
    for (const { x, y } of positions((x, y) => isOpen(cellAt(floor, x, y)))) {
      for (const layer of layersAt(x, y)) {
        expect(layer.sheet).not.toBe("torch");
        expect(isOneOf(layer.sprite, BANNERS)).toBe(false);
      }
    }
  });

  it("stays within the layer budget of the viewport keys", () => {
    expect(Math.max(...plan.map((layers) => layers.length))).toBeLessThanOrEqual(MAX_LAYERS);
  });

  it("renders only custom properties, so resizing never recomputes a tile", () => {
    const rendered = renderFloor(floor).flat();
    expect(rendered.length).toBeGreaterThan(floor.rooms.length * 20);
    for (const layer of rendered.slice(0, 500)) {
      expect(layer.style).toMatch(/^(--[a-z]+:-?\d+;?)+$/);
    }
  });
});

describe("atlas", () => {
  it("has a wall top for every arrangement of neighbours, inside the image", () => {
    expect(new Set(RIM_KEYS).size).toBe(RIM_KEYS.length);
    for (const key of RIM_KEYS) {
      const sprite = rimSprite(key);
      expect(sprite.x + sprite.w).toBeLessThanOrEqual(ATLAS_SIZE.width);
      expect(sprite.y + sprite.h).toBeLessThanOrEqual(ATLAS_SIZE.height);
    }
    expect(() => rimSprite("????????")).toThrow();
  });

  it("changes theme from one floor to the next", () => {
    expect(themeOf(0)).toBe(THEMES[0]);
    expect(themeOf(1)).toBe(THEMES[1]);
    expect(themeOf(THEMES.length)).toBe(THEMES[0]);
  });
});
