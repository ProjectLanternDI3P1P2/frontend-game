/**
 * The final boss invariant of a floor (US #266): exactly one `boss` element,
 * standing in the one room of type `boss`.
 *
 * ADR-FE-012 — Pure function, no framework, no I/O.
 * ADR-FE-008 — The backend places the boss from the seed: the client only
 * checks what it received and reports the element as is. It never computes a
 * position of its own, and never expects a room number (D21).
 *
 * Unlike `decodeFloor`, which throws `DungeonContractError` on a structural
 * break, a broken invariant is a typed result: the exploration stays usable.
 */
import type { DungeonElement, DungeonRoom } from "./types";

/** Where the final boss of the floor stands, as sent by the backend. */
export interface FloorBoss {
  x: number;
  y: number;
  roomId: number;
  elementId: DungeonElement["id"];
}

/**
 * - `missing`: no `boss` element.
 * - `duplicate`: more than one `boss` element.
 * - `misplaced`: no `boss` room, several of them, or the element outside it.
 */
export type FloorBossFailure = "missing" | "duplicate" | "misplaced";

export type FloorBossResult =
  | { ok: true; boss: FloorBoss }
  | { ok: false; reason: FloorBossFailure };

export interface FloorBossSource {
  rooms: readonly DungeonRoom[];
  elements: readonly DungeonElement[];
}

export function findFloorBoss(floor: FloorBossSource): FloorBossResult {
  const bosses = floor.elements.filter((element) => element.type === "boss");
  if (bosses.length === 0) return { ok: false, reason: "missing" };
  if (bosses.length > 1) return { ok: false, reason: "duplicate" };

  const bossRooms = floor.rooms.filter((room) => room.type === "boss");
  if (bossRooms.length !== 1) return { ok: false, reason: "misplaced" };

  const boss = bosses[0]!;
  const room = bossRooms[0]!;
  if (boss.roomId !== room.id || !isInside(room, boss)) {
    return { ok: false, reason: "misplaced" };
  }
  return {
    ok: true,
    boss: { x: boss.x, y: boss.y, roomId: room.id, elementId: boss.id },
  };
}

/** The walkable interior of a room, walls excluded. */
function isInside(room: DungeonRoom, { x, y }: { x: number; y: number }): boolean {
  return (
    x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height
  );
}
