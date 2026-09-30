/**
 * Presentation rules of the explorer: input mapping, camera and fog of war.
 * ADR-FE-012 — Pure and deterministic, tested in isolation.
 */
import type { DecodedFloor } from "./dungeonMap";
import { Cell, cellAt, contains, roomAt } from "./dungeonMap";
import type { Direction, Position } from "./types";

/**
 * Physical key positions (`KeyboardEvent.code`), not characters: W/A/S/D on a
 * QWERTY keyboard and Z/Q/S/D on an AZERTY one are the same keys.
 */
const DIRECTION_BY_CODE: Record<string, Direction> = {
  ArrowUp: "north",
  KeyW: "north",
  ArrowRight: "east",
  KeyD: "east",
  ArrowDown: "south",
  KeyS: "south",
  ArrowLeft: "west",
  KeyA: "west",
};

export function directionForKey(code: string): Direction | null {
  return DIRECTION_BY_CODE[code] ?? null;
}

export interface Viewport {
  columns: number;
  rows: number;
}

/** Whole or half multiples of the 16 px source tile: the pixel art stays crisp. */
const TILE_SIZES = [64, 48, 32, 24, 16] as const;
/** The hero always sees at least this many tiles across and down. */
const MIN_VISIBLE_TILES = 13;

/**
 * The largest tile that still shows `MIN_VISIBLE_TILES` in both directions,
 * and the view that covers the whole screen with it. Odd sizes keep the hero
 * on the centre tile; the view overflows the screen by less than a tile.
 */
export function fitViewport(width: number, height: number): Viewport & { tile: number } {
  const shortest = Math.min(width, height);
  const tile = TILE_SIZES.find((size) => shortest / size >= MIN_VISIBLE_TILES) ?? 16;
  const odd = (length: number) => {
    const count = Math.max(1, Math.ceil(length / tile));
    return count % 2 === 1 ? count : count + 1;
  };
  return { tile, columns: odd(width), rows: odd(height) };
}

/**
 * Top-left tile of the camera: centred on the hero, clamped so that the view
 * never shows beyond the floor when the floor is larger than the view.
 */
export function cameraOrigin(
  floor: Pick<DecodedFloor, "width" | "height">,
  hero: Position,
  viewport: Viewport,
): Position {
  const clamp = (value: number, size: number, view: number) =>
    size <= view
      ? Math.floor((size - view) / 2)
      : Math.min(Math.max(value, 0), size - view);

  return {
    x: clamp(hero.x - Math.floor(viewport.columns / 2), floor.width, viewport.columns),
    y: clamp(hero.y - Math.floor(viewport.rows / 2), floor.height, viewport.rows),
  };
}

/**
 * Fog of war. Entering a room reveals it whole, walls included, plus the row
 * above its top wall (where the top of the wall face is drawn) and the void
 * just below its bottom wall (where the outer face and foot of that wall hang).
 * In a corridor, only the tiles next to the hero are revealed. Returns true
 * when something changed.
 */
export function reveal(
  floor: DecodedFloor,
  revealed: Uint8Array,
  hero: Position,
): boolean {
  let changed = false;
  const mark = (x: number, y: number, voidOnly = false) => {
    if (!contains(floor, { x, y })) return;
    if (voidOnly && cellAt(floor, x, y) !== Cell.Void) return;
    const index = y * floor.width + x;
    if (revealed[index] === 0) {
      revealed[index] = 1;
      changed = true;
    }
  };
  const markArea = (left: number, right: number, top: number, bottom: number) => {
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) mark(x, y);
    }
    for (let y = bottom + 1; y <= bottom + 2; y++) {
      for (let x = left; x <= right; x++) mark(x, y, true);
    }
  };

  const room = roomAt(floor, hero);
  if (room) {
    markArea(room.x - 1, room.x + room.width, room.y - 2, room.y + room.height);
  } else {
    markArea(hero.x - 1, hero.x + 1, hero.y - 2, hero.y + 1);
  }

  return changed;
}
