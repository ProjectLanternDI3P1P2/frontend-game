/**
 * The fixtures were produced by the Dungeon service's own query handlers, so
 * these tests also pin the contract between the backend and this client.
 */
import { describe, expect, it } from "vitest";
import {
  Cell,
  DungeonContractError,
  canEnter,
  cellAt,
  decodeFloor,
  elementsAt,
  gateOf,
  isWalkableAt,
  roomAt,
  step,
} from "../dungeonMap";
import type { DungeonMapResponse } from "../types";
import fixture from "./fixtures/map-0KX4M2T9QZ7PA-f0.json";
import multiFloorFixture from "./fixtures/map-7RQ2D8M4XK1ZB-f0.json";

const map = fixture as DungeonMapResponse;

describe("decodeFloor", () => {
  const floor = decodeFloor(map);

  it("keeps the size, rooms and elements sent by the backend", () => {
    expect(floor.width * floor.height).toBe(floor.cells.length);
    // Ten rooms and the stairs room behind the boss.
    expect(floor.rooms).toHaveLength(11);
    expect(floor.rooms.filter((room) => room.type === "stairs")).toHaveLength(1);
    expect(floor.elements.filter((e) => e.type === "boss")).toHaveLength(1);
  });

  it("finds the gate of the boss room, closed until the boss falls", () => {
    const gate = gateOf(floor)!;
    expect(cellAt(floor, gate.x, gate.y)).toBe(Cell.Gate);
    expect(roomAt(floor, { x: gate.x, y: gate.y + 1 })?.type).toBe("boss");
    expect(canEnter(floor, gate, false)).toBe(false);
    expect(canEnter(floor, gate, true)).toBe(true);
  });

  it("puts the entrance on a walkable tile of the start room", () => {
    expect(isWalkableAt(floor, floor.entrance)).toBe(true);
    expect(roomAt(floor, floor.entrance)?.type).toBe("start");
  });

  it("finds every element on its own tile, inside its room", () => {
    for (const element of floor.elements) {
      expect(elementsAt(floor, element)).toContain(element);
      expect(roomAt(floor, element)?.id).toBe(element.roomId);
      expect(cellAt(floor, element.x, element.y)).toBe(Cell.Floor);
    }
  });

  it("leaves the pits and inner walls of a room out of it, as the backend does", () => {
    const carved = floor.rooms.flatMap((room) => {
      const tiles: { x: number; y: number }[] = [];
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          const code = cellAt(floor, x, y);
          if (code === Cell.Wall || code === Cell.Void) tiles.push({ x, y });
        }
      }
      return tiles;
    });

    expect(carved.length).toBeGreaterThan(0);
    for (const tile of carved) expect(roomAt(floor, tile)).toBeUndefined();
  });

  it("reads the stairs of a multi-floor dungeon", () => {
    const upper = decodeFloor(multiFloorFixture as DungeonMapResponse);
    expect(upper.floorCount).toBe(4);
    expect(upper.cells.filter((code) => code === Cell.StairsDown).length).toBeGreaterThan(0);
  });

  it("rejects a row of the wrong width instead of drawing a broken floor", () => {
    const broken = { ...map, rows: [map.rows[0]!.slice(1), ...map.rows.slice(1)] };
    expect(() => decodeFloor(broken)).toThrow(DungeonContractError);
  });

  it("rejects an unknown cell symbol", () => {
    const broken = { ...map, rows: [`?${map.rows[0]!.slice(1)}`, ...map.rows.slice(1)] };
    expect(() => decodeFloor(broken)).toThrow(DungeonContractError);
  });
});

describe("walkability", () => {
  const floor = decodeFloor(map);

  it("matches the backend rule: floor, door, grate, gate and stairs only", () => {
    const walkable = new Set<number>();
    const blocking = new Set<number>();
    floor.cells.forEach((code, index) => {
      const position = { x: index % floor.width, y: Math.floor(index / floor.width) };
      (isWalkableAt(floor, position) ? walkable : blocking).add(code);
    });

    expect([...walkable].sort()).toEqual(
      [Cell.Floor, Cell.Door, Cell.StairsDown, Cell.Grate, Cell.Gate].sort(),
    );
    expect(blocking.has(Cell.Wall)).toBe(true);
    expect(blocking.has(Cell.Obstacle)).toBe(true);
    expect(blocking.has(Cell.Pillar)).toBe(true);
    expect(blocking.has(Cell.Fence)).toBe(true);
    expect(blocking.has(Cell.Void)).toBe(true);
  });

  it("treats outside the floor as void", () => {
    expect(cellAt(floor, -1, 0)).toBe(Cell.Void);
    expect(isWalkableAt(floor, { x: floor.width, y: 0 })).toBe(false);
  });
});

describe("step", () => {
  it("moves one tile in the given direction", () => {
    expect(step({ x: 5, y: 5 }, "north")).toEqual({ x: 5, y: 4 });
    expect(step({ x: 5, y: 5 }, "east")).toEqual({ x: 6, y: 5 });
    expect(step({ x: 5, y: 5 }, "south")).toEqual({ x: 5, y: 6 });
    expect(step({ x: 5, y: 5 }, "west")).toEqual({ x: 4, y: 5 });
  });
});
