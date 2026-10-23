/**
 * The sprites that stand on the board: enemies, bosses, items, traps and the boss gate (the
 * hero, a paper doll, is in `hero.ts`). Data only: the viewport binds `spriteStyle` and CSS
 * plays the frames.
 *
 * An animation is a row of frames `pitch` pixels apart in its sheet; CSS steps through
 * them by moving the background, so no JavaScript runs per frame.
 */
import type { MobState } from "../types";
import type { Theme } from "./tileset";

export type SpriteSheet = "objects" | "hero" | "mob";

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
  sheet: "mob",
  x: 0,
  y: 0,
  w: 32,
  h: 32,
  ...still,
  dx: -4,
  dy: -11,
  scale: 0.75,
};

/** The classes of a mob of the run: its kind tints it, its aggro lights it up. */
export function mobClassName(mob: MobState): string {
  return (
    `dungeon-sprite dungeon-sprite--${ENEMY.sheet} dungeon-element dungeon-element--enemy ` +
    `dungeon-element--${mob.kind} dungeon-mob${mob.aggro ? " dungeon-mob--aggro" : ""}`
  );
}

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

/** The matching open, emptied chest sprites: lid up, from the same three colour rows. */
const OPENED_CHESTS: readonly AnimatedSprite[] = [64, 96, 128].map((y) => ({
  sheet: "objects",
  x: 100,
  y,
  w: 24,
  h: 32,
  ...still,
  dx: -4,
  dy: -16,
}));

/** A chest, of a colour chosen by the item's id. */
function stableIndex(id: string | number, length: number): number {
  if (typeof id === "number") return Math.abs(id) % length;
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % length;
}

export function itemSprite(id: string | number): AnimatedSprite {
  return CHESTS[stableIndex(id, CHESTS.length)]!;
}

/** The opened version of an item chest, with the same deterministic colour. */
export function openedItemSprite(id: string | number): AnimatedSprite {
  return OPENED_CHESTS[stableIndex(id, OPENED_CHESTS.length)]!;
}

/** Spikes that come out of the floor and go back in. */
export const TRAP: AnimatedSprite = {
  sheet: "objects",
  x: 160,
  y: 262,
  w: 32,
  h: 20,
  frames: 3,
  pitch: 32,
  duration: 1.2,
  dx: -8,
  dy: -2,
};

/**
 * The portcullis of a boss room, drawn over the gate down: closed on its first frame, it
 * rises through the others once the boss is defeated.
 */
export function gateSprite(theme: Theme): AnimatedSprite {
  return {
    sheet: "objects",
    x: 0,
    y: theme === "stone" ? 320 : 0,
    w: 64,
    h: 64,
    frames: 5,
    pitch: 64,
    duration: 0.9,
    dx: -24,
    dy: -48,
  };
}

/** CSS custom properties of a sprite standing on tile (x, y). */
export function spriteStyle(
  sprite: AnimatedSprite,
  { x, y }: { x: number; y: number },
): string {
  return (
    `--x:${x};--y:${y};--dx:${sprite.dx};--dy:${sprite.dy};` +
    `--sx:${sprite.x};--sy:${sprite.y};--sw:${sprite.w};--sh:${sprite.h};` +
    `--frames:${sprite.frames};--pitch:${sprite.pitch};--duration:${sprite.duration}s;` +
    `--scale:${sprite.scale ?? 1}`
  );
}
