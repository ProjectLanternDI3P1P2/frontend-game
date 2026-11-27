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
  | "tomb"
  /** The ground under a decoration of an easter-egg room: blocks movement, draws no furniture. */
  | "decoration";

export type ElementTypeName = "enemy" | "boss" | "item" | "trap" | "decoration";

/** How an enemy silhouette moves; the pack it stands for is Combat's. */
export type EnemyKindName = "zombie" | "mage" | "goblin" | "bat";

/** What a decoration of an easter-egg room shows. */
export type DecorationKindName =
  "ship" | "campfire" | "strawberry" | "grassBlock" | "bluePortal" | "orangePortal";

/** `secret`: a legendary easter-egg room, decorations only. */
export type RoomTypeName =
  "start" | "combat" | "treasure" | "empty" | "boss" | "secret";

/** Which tribute a secret room pays: one game per room. */
export type EasterEggName =
  "outerWildsShip" | "outerWildsCampfire" | "celeste" | "minecraft" | "portal";

export type DungeonRunStatus = "active" | "won" | "lost" | "abandoned";

export type Direction = "north" | "east" | "south" | "west";

export interface Position {
  x: number;
  y: number;
}

export interface DungeonElement {
  /** Stable for a given seed and floor: other services reference it. */
  id: string | number;
  type: ElementTypeName;
  x: number;
  y: number;
  roomId: number;
  /** Movement kind of an enemy silhouette, or what a decoration shows; null otherwise. */
  kind: EnemyKindName | DecorationKindName | null;
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
  /** Which easter egg a secret room holds; absent or null for any other room. */
  easterEgg?: EasterEggName | null;
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

/** A living mob of the current floor, where it stands this turn. */
export interface MobState {
  /** The id of the enemy element it spawned from. */
  id: string | number;
  kind: EnemyKindName;
  x: number;
  y: number;
  aggro: boolean;
  /** Where a mage will land on its next action. */
  nextTeleport: Position | null;
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
  mobs: MobState[];
  /** Mobs that died on this turn, on the tile they fell on. */
  killedMobs: MobState[];
  /** Rooms of the current floor the party has discovered: their mobs know it is here. */
  discoveredRoomIds: number[];
  /**
   * Tiles of the current floor the hero has stood on, as a base64 bitset
   * (`decodeVisitedTiles`): the fog of war is rebuilt from it after a reload.
   */
  visitedTiles: string;
  /** Item element IDs already opened on the current floor. */
  openedChestElementIds: (string | number)[];
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
