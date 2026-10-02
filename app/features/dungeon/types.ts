/**
 * ADR-FE-011 — Hand-written mirror of the Dungeon service contract
 * (`/api/v1/dungeons` and `/api/v1/dungeon-runs`). When the contract changes,
 * this file changes in the same pull request as `api/dungeonApi.ts`.
 */

export type CellTypeName =
  | "void"
  | "floor"
  | "wall"
  | "door"
  | "obstacle"
  | "pillar"
  | "fence"
  /**
   * The way down, in the north wall of the boss room: locked until the boss is defeated,
   * then walking into it takes the party to the next floor.
   */
  | "gate"
  | "grate"
  | "water"
  | "lava"
  | "tomb";

export type ElementTypeName = "enemy" | "boss" | "item" | "trap";

export type RoomTypeName =
  | "start"
  | "combat"
  | "treasure"
  | "empty"
  | "boss";

export type DungeonRunStatus = "active" | "won" | "lost" | "abandoned";

export type Direction = "north" | "east" | "south" | "west";

export interface Position {
  x: number;
  y: number;
}

export interface DungeonElement {
  /** Stable for a given seed and floor: other services reference it. */
  id: number;
  type: ElementTypeName;
  x: number;
  y: number;
  roomId: number;
}

export interface DungeonRoom {
  id: number;
  type: RoomTypeName;
  /** Coordinates on the coarse room grid, used by the minimap. */
  gridX: number;
  gridY: number;
  /** Walkable interior, walls excluded, in tiles. */
  x: number;
  y: number;
  width: number;
  height: number;
  center: Position;
  /** Rooms to cross from the start room. */
  depth: number;
  connectedRoomIds: number[];
}

/**
 * GET /api/v1/dungeons/{seed}/map?floor=n — immutable for a given seed.
 * `rows` holds one character per tile, decoded through `legend`.
 */
export interface DungeonMapResponse {
  seed: string;
  generatorVersion: number;
  floor: number;
  floorCount: number;
  isFinalFloor: boolean;
  width: number;
  height: number;
  legend: Record<string, CellTypeName>;
  rows: string[];
  /** Where the party arrives, down a ladder in the middle of the start room. */
  entrance: Position;
  rooms: DungeonRoom[];
  elements: DungeonElement[];
}

/** GET /api/v1/dungeon-runs/{runId}, also returned by every run action. */
export interface DungeonRunResponse {
  id: string;
  gameSessionId: string;
  seed: string;
  generatorVersion: number;
  status: DungeonRunStatus;
  floorCount: number;
  currentFloor: number;
  hero: Position;
  turn: number;
  /** The boss of the current floor is defeated: its gate down is open. */
  floorBossDefeated: boolean;
  currentRoomId: number | null;
  elementsHere: DungeonElement[];
  startedAt: string;
}

/** POST /api/v1/dungeon-runs */
export interface CreateDungeonRunRequest {
  gameSessionId: string;
  /** Idempotency key: a retried request with the same id is harmless. */
  runId?: string;
  /** Omitted for a new dungeon; set to replay a shared seed. */
  seed?: string;
}
