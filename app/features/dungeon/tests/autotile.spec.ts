import { describe, expect, it } from "vitest";
import type { CellCode } from "../dungeonMap";
import { Cell, cellAt, decodeFloor } from "../dungeonMap";
import { isOpen, planFloor, renderFloor, visualSeed } from "../tiles/autotile";
import type { SpriteRect } from "../tiles/tileset";
import { FACES, PROPS, RIMS, STAIRS, WALL_DECORATIONS } from "../tiles/tileset";
import type { DungeonMapResponse } from "../types";
import fixture from "./fixtures/map-0KX4M2T9QZ7PA-f0.json";
import multiFloorFixture from "./fixtures/map-7RQ2D8M4XK1ZB-f0.json";

const floor = decodeFloor(fixture as DungeonMapResponse);
const plan = planFloor(floor);
const layersAt = (x: number, y: number) => plan[y * floor.width + x]!;
const sprites = (x: number, y: number) => layersAt(x, y).map((layer) => layer.sprite);

const rimPieces = Object.values(RIMS);
const decorationUppers = WALL_DECORATIONS.map((decoration) => decoration.upper);
const decorationLowers = WALL_DECORATIONS.map((decoration) => decoration.lower);

function positions(predicate: (x: number, y: number) => boolean) {
  const found: { x: number; y: number }[] = [];
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) if (predicate(x, y)) found.push({ x, y });
  }
  return found;
}

const is = (code: CellCode) => (x: number, y: number) => cellAt(floor, x, y) === code;
const isFace = (x: number, y: number) => is(Cell.Wall)(x, y) && isOpen(cellAt(floor, x, y + 1));

function isOneOf(sprite: SpriteRect | undefined, candidates: readonly SpriteRect[]) {
  return candidates.some((candidate) => JSON.stringify(candidate) === JSON.stringify(sprite));
}

describe("autotiling", () => {
  it("is deterministic: the same seed always looks the same", () => {
    expect(renderFloor(floor)).toEqual(renderFloor(decodeFloor(fixture as DungeonMapResponse)));
  });

  it("changes the variants with the seed and the floor", () => {
    expect(visualSeed("0KX4M2T9QZ7PA", 0)).not.toBe(visualSeed("0KX4M2T9QZ7PB", 0));
    expect(visualSeed("0KX4M2T9QZ7PA", 0)).not.toBe(visualSeed("0KX4M2T9QZ7PA", 1));
  });

  it("draws nothing in the void far from any wall", () => {
    const deepVoid = positions(
      (x, y) =>
        [-2, -1, 0, 1, 2].every((dy) =>
          [-1, 0, 1].every((dx) => cellAt(floor, x + dx, y + dy) === Cell.Void),
        ),
    );
    expect(deepVoid.length).toBeGreaterThan(0);
    for (const { x, y } of deepVoid) expect(layersAt(x, y)).toEqual([]);
  });

  it("gives every wall seen from the front a rim above it: no wall is left without its top", () => {
    const faces = positions((x, y) => isFace(x, y) && !isOpen(cellAt(floor, x, y - 1)));
    expect(faces.length).toBeGreaterThan(100);
    for (const { x, y } of faces) {
      expect(isOneOf(sprites(x, y - 1)[0], [...rimPieces, ...decorationUppers])).toBe(true);
    }
  });

  it("closes the corners of every room", () => {
    for (const room of floor.rooms) {
      const left = room.x - 1;
      const right = room.x + room.width;
      const bottom = room.y + room.height;
      // Bottom corners: the side walls turn into the south wall (└ and ┘),
      // unless a notch or a corridor changes the corner.
      if (is(Cell.Wall)(left, bottom) && is(Cell.Wall)(left, bottom - 1) && is(Cell.Wall)(left + 1, bottom)
        && !is(Cell.Wall)(left - 1, bottom) && !isFace(left, bottom) && !isFace(left + 1, bottom)) {
        expect(sprites(left, bottom)[0]).toEqual(RIMS.cornerUpRight);
      }
      if (is(Cell.Wall)(right, bottom) && is(Cell.Wall)(right, bottom - 1) && is(Cell.Wall)(right - 1, bottom)
        && !is(Cell.Wall)(right + 1, bottom) && !isFace(right, bottom) && !isFace(right - 1, bottom)) {
        expect(sprites(right, bottom)[0]).toEqual(RIMS.cornerUpLeft);
      }
    }
    const corners = floor.rooms.filter((room) => {
      const [first] = sprites(room.x - 1, room.y + room.height);
      return JSON.stringify(first) === JSON.stringify(RIMS.cornerUpRight);
    });
    expect(corners.length).toBeGreaterThan(floor.rooms.length / 2);
  });

  it("draws the side walls from above as vertical rims", () => {
    const sideWalls = positions(
      (x, y) =>
        is(Cell.Wall)(x, y) &&
        is(Cell.Floor)(x + 1, y) &&
        is(Cell.Wall)(x, y - 1) &&
        is(Cell.Wall)(x, y + 1) &&
        !isFace(x, y - 1) &&
        !isFace(x, y) &&
        !isFace(x, y + 1) &&
        !isOpen(cellAt(floor, x - 1, y)),
    );
    expect(sideWalls.length).toBeGreaterThan(50);
    for (const { x, y } of sideWalls) expect(sprites(x, y)[0]).toEqual(RIMS.vertical);
  });

  it("hangs the outer face and foot of south walls over the void", () => {
    const southWalls = positions(
      (x, y) =>
        is(Cell.Wall)(x, y) &&
        isOpen(cellAt(floor, x, y - 1)) &&
        is(Cell.Wall)(x - 1, y) &&
        is(Cell.Wall)(x + 1, y) &&
        [1, 2, 3].every((dy) => [-1, 0, 1].every((dx) => is(Cell.Void)(x + dx, y + dy))),
    );
    expect(southWalls.length).toBeGreaterThan(50);
    for (const { x, y } of southWalls) {
      expect(sprites(x, y + 1)).toEqual([FACES.outer]);
      expect(sprites(x, y + 2)).toEqual([FACES.foot]);
    }
  });

  it("paves every open tile, and stands a prop on every obstacle, pillar and fence", () => {
    for (const { x, y } of positions((x, y) => isOpen(cellAt(floor, x, y)))) {
      expect(layersAt(x, y).length).toBeGreaterThan(0);
    }
    const blocking: [CellCode, readonly SpriteRect[]][] = [
      [Cell.Obstacle, PROPS.obstacles],
      [Cell.Pillar, PROPS.pillars],
      [Cell.Fence, [PROPS.fence]],
    ];
    for (const [code, props] of blocking) {
      const tiles = positions(is(code));
      expect(tiles.length).toBeGreaterThan(0);
      for (const { x, y } of tiles) {
        const layers = layersAt(x, y);
        expect(layers).toHaveLength(2);
        expect(isOneOf(layers[1]!.sprite, props)).toBe(true);
        // Standing on the tile: bottom edges aligned.
        expect(layers[1]!.dy + layers[1]!.sprite.h).toBe(16);
      }
    }
  });

  it("draws the stairs down", () => {
    const upper = decodeFloor(multiFloorFixture as DungeonMapResponse);
    const index = upper.cells.indexOf(Cell.StairsDown);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(planFloor(upper)[index]!.map((layer) => layer.sprite)).toEqual([STAIRS]);
  });

  it("dresses the dungeon: wall decorations, torches and floor litter", () => {
    const all = plan.flat();
    const count = (predicate: (sprite: SpriteRect, sheet: string) => boolean) =>
      all.filter((layer) => predicate(layer.sprite, layer.sheet)).length;

    expect(count((sprite) => isOneOf(sprite, decorationLowers))).toBeGreaterThan(10);
    expect(count((_, sheet) => sheet === "torch")).toBeGreaterThan(10);
    expect(count((sprite) => sprite.w < 16 && sprite.h < 16)).toBeGreaterThan(40);
  });

  it("puts wall decorations only on wall faces, never on the floor", () => {
    for (const { x, y } of positions((x, y) => isOpen(cellAt(floor, x, y)))) {
      expect(sprites(x, y).some((sprite) => isOneOf(sprite, decorationLowers))).toBe(false);
    }
  });

  it("stays within four layers per tile, the budget of the viewport keys", () => {
    expect(Math.max(...plan.map((layers) => layers.length))).toBeLessThanOrEqual(4);
  });

  it("renders only custom properties, so resizing never recomputes a tile", () => {
    const rendered = renderFloor(floor).flat();
    expect(rendered.length).toBeGreaterThan(floor.rooms.length * 20);
    for (const layer of rendered.slice(0, 500)) {
      expect(layer.style).toMatch(/^(--[a-z]+:-?\d+;?)+$/);
    }
  });
});
