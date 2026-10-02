/**
 * The sprites that stand on the board: the hero, enemies, bosses, items, traps and the
 * boss gate. Data only: the viewport binds `spriteStyle` and CSS plays the frames.
 *
 * An animation is a row of frames `pitch` pixels apart in its sheet; CSS steps through
 * them by moving the background, so no JavaScript runs per frame.
 */
import type { Direction } from "../types";
import type { Theme } from "./tileset";

export type SpriteSheet = "objects" | "hero" | "mob";

/**
 * The hero sheet: one animation per row, in cells of 100 x 40, the hero facing east and
 * standing on the line y = 34 of its cell, around x = 40.
 * Rows: 0 idle (6 frames), 1 run (8), 2 walk (8), 3 and 4 sword attacks (8 and 2),
 * 5 hurt (4), 6 dash attack (8).
 */
export const HERO_SHEET = { width: 800, height: 280 } as const;

export interface AnimatedSprite {
  sheet: SpriteSheet;
  /** First frame, in source pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  frames: number;
  pitch: number;
  /** Duration of one loop, in seconds. */
  duration: number;
  /** Offset from the tile's top-left corner, in source pixels (before scaling). */
  dx: number;
  dy: number;
  scale?: number;
}

const still = { frames: 1, pitch: 0, duration: 1 };

/**
 * Every enemy, the boss included, is the art team's placeholder for now: one still image,
 * 32 pixels square, which the viewport makes float above the floor. An enemy is drawn at
 * three quarters of it, about the size of the hero, a few pixels above its tile.
 */
export const ENEMY: AnimatedSprite = {
  sheet: "mob", x: 0, y: 0, w: 32, h: 32, ...still, dx: -4, dy: -11, scale: 0.75,
};

/** The boss: twice the size of the image. */
export const BOSS: AnimatedSprite = { ...ENEMY, dx: -24, dy: -52, scale: 2 };

/** Red, grey and green chests, closed. */
const CHESTS: readonly AnimatedSprite[] = [64, 96, 128].map((y) => ({
  sheet: "objects",
  x: 0,
  y,
  w: 32,
  h: 32,
  ...still,
  dx: -8,
  dy: -16,
}));

/** A chest, of a colour chosen by the item's id. */
export function itemSprite(id: number): AnimatedSprite {
  return CHESTS[id % CHESTS.length]!;
}

/** Spikes that come out of the floor and go back in. */
export const TRAP: AnimatedSprite = {
  sheet: "objects", x: 160, y: 262, w: 32, h: 20, frames: 3, pitch: 32, duration: 1.2, dx: -8, dy: -2,
};

/** Standing still, or running from one tile to the next. */
export type HeroPose = "idle" | "run";

const HERO_CELL = { width: 100, height: 40 } as const;

const HERO_POSES: Record<HeroPose, { row: number; frames: number; duration: number }> = {
  idle: { row: 0, frames: 6, duration: 0.9 },
  run: { row: 1, frames: 8, duration: 0.64 },
};

/**
 * The hero in a pose. The window is 56 pixels wide around the hero, wide enough for the
 * sword of the attack rows, and centred on it so that it can be flipped in place. The
 * hero stands at the bottom of its tile, as tall as about two tiles: its head overlaps
 * the row above, drawn behind it.
 */
export function heroSprite(pose: HeroPose): AnimatedSprite {
  const { row, frames, duration } = HERO_POSES[pose];
  return {
    sheet: "hero",
    x: 12,
    y: row * HERO_CELL.height,
    w: 56,
    h: HERO_CELL.height,
    frames,
    pitch: HERO_CELL.width,
    duration,
    dx: -20,
    dy: -20,
  };
}

/**
 * The sheet only draws the hero facing east: it is mirrored to face west. Going north or
 * south, it keeps facing the way it last went sideways.
 */
export function heroFacesWest(facing: Direction, facedWest: boolean): boolean {
  if (facing === "west") return true;
  if (facing === "east") return false;
  return facedWest;
}

/**
 * The portcullis of a boss room, drawn over the gate down: closed on its first frame, it
 * rises through the others once the boss is defeated.
 */
export function gateSprite(theme: Theme): AnimatedSprite {
  return {
    sheet: "objects", x: 0, y: theme === "stone" ? 320 : 0, w: 64, h: 64, frames: 5, pitch: 64, duration: 0.9, dx: -24, dy: -48,
  };
}

/** CSS custom properties of a sprite standing on tile (x, y). */
export function spriteStyle(sprite: AnimatedSprite, { x, y }: { x: number; y: number }): string {
  return (
    `--x:${x};--y:${y};--dx:${sprite.dx};--dy:${sprite.dy};` +
    `--sx:${sprite.x};--sy:${sprite.y};--sw:${sprite.w};--sh:${sprite.h};` +
    `--frames:${sprite.frames};--pitch:${sprite.pitch};--duration:${sprite.duration}s;` +
    `--scale:${sprite.scale ?? 1}`
  );
}
