import { describe, expect, it } from "vitest";
import { findFloorBoss } from "../bossRules";
import type { DungeonElement, DungeonMapResponse, DungeonRoom } from "../types";
import mapA from "./fixtures/map-DGPEAP9GWJKZF-f0.json";
import mapB from "./fixtures/map-DDR55WKRPRVBN-f0.json";

const fixtures = [mapA, mapB] as DungeonMapResponse[];

describe("findFloorBoss", () => {
  it.each(fixtures.map((map) => [map.seed, map] as const))(
    "locates the boss sent for %s, as is",
    (_seed, map) => {
      const boss = map.elements.find((element) => element.type === "boss")!;
      expect(findFloorBoss(map)).toEqual({
        ok: true,
        boss: { x: boss.x, y: boss.y, roomId: boss.roomId, elementId: boss.id },
      });
    },
  );

  it("does not rely on a room number (D21)", () => {
    const map = fixtures[0]!;
    const rooms: DungeonRoom[] = map.rooms.map((room) => ({
      ...room,
      id: room.id + 100,
    }));
    const elements: DungeonElement[] = map.elements.map((element) => ({
      ...element,
      roomId: element.roomId + 100,
    }));
    const result = findFloorBoss({ rooms, elements });
    expect(result.ok && result.boss.roomId).toBe(108);
  });

  it("reads an empty floor as a missing boss", () => {
    expect(findFloorBoss({ rooms: [], elements: [] })).toEqual({
      ok: false,
      reason: "missing",
    });
  });

  it("reports a duplicate before looking at the rooms", () => {
    const map = fixtures[0]!;
    const boss = map.elements.find((element) => element.type === "boss")!;
    const result = findFloorBoss({
      rooms: [],
      elements: [boss, { ...boss, id: "copy" }],
    });
    expect(result).toEqual({ ok: false, reason: "duplicate" });
  });

  it("reads a boss outside the walls of its own room as misplaced", () => {
    const map = fixtures[0]!;
    const room = map.rooms.find((candidate) => candidate.type === "boss")!;
    const elements = map.elements.map((element) =>
      element.type === "boss" ? { ...element, x: room.x - 1 } : element,
    );
    expect(findFloorBoss({ rooms: map.rooms, elements })).toEqual({
      ok: false,
      reason: "misplaced",
    });
  });
});
