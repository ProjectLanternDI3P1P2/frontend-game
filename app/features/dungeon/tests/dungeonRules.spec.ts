import { describe, expect, it } from "vitest";
import { Cell, cellAt, decodeFloor, roomAt } from "../dungeonMap";
import { cameraOrigin, directionForKey, fitViewport, reveal } from "../dungeonRules";
import type { DungeonMapResponse } from "../types";
import fixture from "./fixtures/map-DGPEAP9GWJKZF-f0.json";

const floor = decodeFloor(fixture as DungeonMapResponse);

describe("directionForKey", () => {
  it.each([
    ["ArrowUp", "north"],
    ["KeyW", "north"],
    ["ArrowRight", "east"],
    ["KeyD", "east"],
    ["ArrowDown", "south"],
    ["KeyS", "south"],
    ["ArrowLeft", "west"],
    ["KeyA", "west"],
  ])("maps %s to %s", (code, direction) => {
    expect(directionForKey(code)).toBe(direction);
  });

  it("ignores other keys", () => {
    expect(directionForKey("KeyQ")).toBeNull();
    expect(directionForKey("Space")).toBeNull();
  });
});

describe("cameraOrigin", () => {
  const viewport = { columns: 19, rows: 13 };

  it("centres the hero when the floor allows it", () => {
    expect(cameraOrigin({ width: 150, height: 110 }, { x: 60, y: 50 }, viewport)).toEqual({
      x: 51,
      y: 44,
    });
  });

  it("never shows beyond the edges of the floor", () => {
    expect(cameraOrigin({ width: 150, height: 110 }, { x: 1, y: 1 }, viewport)).toEqual({
      x: 0,
      y: 0,
    });
    expect(cameraOrigin({ width: 150, height: 110 }, { x: 149, y: 109 }, viewport)).toEqual({
      x: 131,
      y: 97,
    });
  });

  it("centres a floor smaller than the view", () => {
    expect(cameraOrigin({ width: 9, height: 7 }, { x: 4, y: 3 }, viewport)).toEqual({
      x: -5,
      y: -3,
    });
  });
});

describe("fitViewport", () => {
  it("picks the largest tile that keeps 13 tiles in view", () => {
    expect(fitViewport(1920, 1000).tile).toBe(64);
    expect(fitViewport(1280, 700).tile).toBe(48);
    expect(fitViewport(390, 780).tile).toBe(16);
  });

  it("only uses whole multiples of the 16-pixel art, so that sprites stay sharp", () => {
    for (const width of [320, 390, 768, 1024, 1366, 1920, 2560]) {
      expect(fitViewport(width, width * 0.6).tile % 16).toBe(0);
    }
  });

  it("covers the whole screen with an odd number of tiles", () => {
    expect(fitViewport(1920, 1000)).toEqual({ tile: 64, columns: 31, rows: 17 });
    expect(fitViewport(390, 780)).toEqual({ tile: 16, columns: 25, rows: 49 });
  });

  it("falls back to the smallest tile on a tiny screen", () => {
    expect(fitViewport(100, 100)).toEqual({ tile: 16, columns: 7, rows: 7 });
  });
});

describe("reveal", () => {
  it("reveals the whole room the hero enters, walls included", () => {
    const revealed = new Uint8Array(floor.width * floor.height);
    const room = roomAt(floor, floor.entrance)!;

    expect(reveal(floor, revealed, floor.entrance)).toBe(true);

    for (let y = room.y - 1; y <= room.y + room.height; y++) {
      for (let x = room.x - 1; x <= room.x + room.width; x++) {
        expect(revealed[y * floor.width + x]).toBe(1);
      }
    }
    const farRoom = floor.rooms.reduce((far, candidate) => (candidate.depth > far.depth ? candidate : far));
    expect(revealed[farRoom.center.y * floor.width + farRoom.center.x]).toBe(0);
  });

  it("reveals the void below the bottom wall, where its outer face hangs, but not the tiles there", () => {
    const revealed = new Uint8Array(floor.width * floor.height);
    const room = roomAt(floor, floor.entrance)!;
    reveal(floor, revealed, floor.entrance);

    for (let y = room.y + room.height + 1; y <= room.y + room.height + 2; y++) {
      for (let x = room.x - 1; x <= room.x + room.width; x++) {
        const isVoid = cellAt(floor, x, y) === Cell.Void;
        expect(revealed[y * floor.width + x]).toBe(isVoid ? 1 : 0);
      }
    }
  });

  it("reveals the top of the tall north wall, but no floor beyond it", () => {
    const revealed = new Uint8Array(floor.width * floor.height);
    const room = roomAt(floor, floor.entrance)!;
    reveal(floor, revealed, floor.entrance);

    const y = room.y - 3;
    for (let x = room.x - 1; x <= room.x + room.width; x++) {
      const isFloor = cellAt(floor, x, y) === Cell.Floor;
      expect(revealed[y * floor.width + x]).toBe(isFloor ? 0 : 1);
    }
  });

  it("reports no change when nothing new is revealed", () => {
    const revealed = new Uint8Array(floor.width * floor.height);
    reveal(floor, revealed, floor.entrance);
    expect(reveal(floor, revealed, floor.entrance)).toBe(false);
  });
});
