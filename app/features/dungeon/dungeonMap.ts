/**
 * Decodes a floor sent by the Dungeon service into flat typed arrays, and
 * answers the questions the explorer asks about it thousands of times.
 *
 * ADR-FE-012 — Pure functions, no framework, no I/O.
 * ADR-FE-008 — These rules only PREDICT what the backend will accept, so that
 * a move can be shown before its response arrives. The backend decides.
 */
import type {
  CellTypeName,
  Direction,
  DungeonElement,
  DungeonMapResponse,
  DungeonRoom,
  Position,
} from "./types";

/** One byte per tile. The numbering is internal to the client. */
export const Cell = {
  Void: 0,
  Floor: 1,
  Wall: 2,
  Door: 3,
  Obstacle: 4,
  StairsDown: 5,
  StairsUp: 6,
  /** Blocks movement, drawn as a column. */
  Pillar: 7,
  /** Blocks movement, drawn as an iron fence. */
  Fence: 8,
  /** Walkable once the boss of the floor is defeated (see `canEnter`). */
  Gate: 9,
  /** A sewer grate in the floor: walkable. */
  Grate: 10,
} as const;

export type CellCode = (typeof Cell)[keyof typeof Cell];

const CODE_BY_NAME: Record<CellTypeName, CellCode> = {
  void: Cell.Void,
  floor: Cell.Floor,
  wall: Cell.Wall,
  door: Cell.Door,
  obstacle: Cell.Obstacle,
  stairsDown: Cell.StairsDown,
  stairsUp: Cell.StairsUp,
  pillar: Cell.Pillar,
  fence: Cell.Fence,
  gate: Cell.Gate,
  grate: Cell.Grate,
};

const NO_ROOM = -1;

export interface DecodedFloor {
  seed: string;
  floor: number;
  floorCount: number;
  isFinalFloor: boolean;
  width: number;
  height: number;
  /** Row-major, `cells[y * width + x]`. */
  cells: Uint8Array;
  /** Room whose interior holds the tile, or -1 (corridors, outer doors, walls, pits). */
  roomIdByCell: Int16Array;
  elementsByCell: ReadonlyMap<number, readonly DungeonElement[]>;
  rooms: readonly DungeonRoom[];
  elements: readonly DungeonElement[];
  entrance: Position;
}

export class DungeonContractError extends Error {
  override name = "DungeonContractError";
}

export function decodeFloor(map: DungeonMapResponse): DecodedFloor {
  const { width, height } = map;
  if (map.rows.length !== height) {
    throw new DungeonContractError(
      `Expected ${height} rows, received ${map.rows.length}.`,
    );
  }

  const cells = decodeCells(map, decodeLegend(map.legend));
  const roomIdByCell = assignRooms(map, cells);

  const elementsByCell = new Map<number, DungeonElement[]>();
  for (const element of map.elements) {
    const index = element.y * width + element.x;
    elementsByCell.set(index, [...(elementsByCell.get(index) ?? []), element]);
  }

  return {
    seed: map.seed,
    floor: map.floor,
    floorCount: map.floorCount,
    isFinalFloor: map.isFinalFloor,
    width,
    height,
    cells,
    roomIdByCell,
    elementsByCell,
    rooms: map.rooms,
    elements: map.elements,
    entrance: map.entrance,
  };
}

function decodeLegend(legend: DungeonMapResponse["legend"]): Map<string, CellCode> {
  const codeBySymbol = new Map<string, CellCode>();
  for (const [symbol, name] of Object.entries(legend)) {
    const code = CODE_BY_NAME[name];
    if (code === undefined) {
      throw new DungeonContractError(`Unknown cell type "${name}".`);
    }
    codeBySymbol.set(symbol, code);
  }
  return codeBySymbol;
}

function decodeCells(
  { width, height, rows }: DungeonMapResponse,
  codeBySymbol: ReadonlyMap<string, CellCode>,
): Uint8Array {
  const cells = new Uint8Array(width * height);
  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new DungeonContractError(
        `Row ${y} has ${row.length} tiles instead of ${width}.`,
      );
    }
    for (let x = 0; x < width; x++) {
      const code = codeBySymbol.get(row[x]!);
      if (code === undefined) {
        throw new DungeonContractError(`Unknown cell symbol "${row[x]}".`);
      }
      cells[y * width + x] = code;
    }
  });
  return cells;
}

/**
 * Same rule as the backend: pits and partition walls inside a room's bounds
 * do not belong to it.
 */
function assignRooms({ width, height, rooms }: DungeonMapResponse, cells: Uint8Array): Int16Array {
  const roomIdByCell = new Int16Array(width * height).fill(NO_ROOM);
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        const index = y * width + x;
        if (cells[index] !== Cell.Void && cells[index] !== Cell.Wall) {
          roomIdByCell[index] = room.id;
        }
      }
    }
  }
  return roomIdByCell;
}

export function contains(floor: DecodedFloor, { x, y }: Position): boolean {
  return x >= 0 && y >= 0 && x < floor.width && y < floor.height;
}

/** Outside the floor reads as void, so neighbour lookups never need a guard. */
export function cellAt(floor: DecodedFloor, x: number, y: number): CellCode {
  return x >= 0 && y >= 0 && x < floor.width && y < floor.height
    ? (floor.cells[y * floor.width + x] as CellCode)
    : Cell.Void;
}

/**
 * Same rule as the backend's CellTypeExtensions.IsWalkable: the layout's rule, where a gate
 * counts as a door. Whether a gate is open depends on the run: see `canEnter`.
 */
export function isWalkable(code: CellCode): boolean {
  return (
    code === Cell.Floor ||
    code === Cell.Door ||
    code === Cell.StairsDown ||
    code === Cell.StairsUp ||
    code === Cell.Grate ||
    code === Cell.Gate
  );
}

/** Same rule as the backend's DungeonRun.MoveHero: a gate opens once the boss is defeated. */
export function canEnter(
  floor: DecodedFloor,
  position: Position,
  floorBossDefeated: boolean,
): boolean {
  const code = cellAt(floor, position.x, position.y);
  return isWalkable(code) && (code !== Cell.Gate || floorBossDefeated);
}

/** Where the gate of the floor stands, if the floor has stairs down. */
export function gateOf(floor: DecodedFloor): Position | undefined {
  const index = floor.cells.indexOf(Cell.Gate);
  return index < 0 ? undefined : { x: index % floor.width, y: Math.floor(index / floor.width) };
}

export function isWalkableAt(floor: DecodedFloor, position: Position): boolean {
  return isWalkable(cellAt(floor, position.x, position.y));
}

export function roomAt(
  floor: DecodedFloor,
  position: Position,
): DungeonRoom | undefined {
  if (!contains(floor, position)) return undefined;
  const roomId = floor.roomIdByCell[position.y * floor.width + position.x]!;
  return roomId === NO_ROOM ? undefined : floor.rooms[roomId];
}

export function elementsAt(
  floor: DecodedFloor,
  position: Position,
): readonly DungeonElement[] {
  return floor.elementsByCell.get(position.y * floor.width + position.x) ?? [];
}

const OFFSETS: Record<Direction, Position> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

export function step(position: Position, direction: Direction): Position {
  const offset = OFFSETS[direction];
  return { x: position.x + offset.x, y: position.y + offset.y };
}
