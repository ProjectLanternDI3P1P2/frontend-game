/**
 * The animated sprites of the combat screen. Data only: `CombatFighter.vue` binds
 * `spriteStyle` and CSS plays the frames with `steps()`; no JavaScript runs per frame
 * (ADR-FE-006).
 *
 * Monsters are drawn from the art team's sheets already in the repository: the slimes and
 * bats of `objects.png`, and `placeholder_mob.png`. Each monster type of the Combat
 * service (its `spriteKey`, from the seeded `ImageUrl`) picks one of them, a size and a
 * tint. TODO(art): give each monster type its own animated sheet — adding one is one entry
 * in `MONSTER_LOOKS` and one line in `SHEETS`.
 */
import type { Stance } from "./composables/useBattleStage";

export type CombatSheet = "hero" | "objects" | "mob";

export const SHEETS: Record<CombatSheet, { width: number; height: number }> = {
  hero: { width: 800, height: 280 },
  objects: { width: 320, height: 480 },
  mob: { width: 32, height: 32 },
};

export interface CombatSprite {
  sheet: CombatSheet;
  /** First frame, in source pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  frames: number;
  /** Distance between two frames, in source pixels. */
  pitch: number;
  /** One loop, in seconds. */
  duration: number;
  /** Multiplies the board scale: a boss is drawn bigger. */
  scale: number;
  /** CSS `filter` giving the monster type its colour. */
  filter?: string;
  /** Empty rows above and below the drawing in its frame: the feet stand on the board. */
  padTop: number;
  padBottom: number;
  /** Flying or still: it bobs above its shadow. */
  floats?: boolean;
}

/**
 * The hero sheet (see the dungeon's `HERO_SHEET`): rows of 100 x 40 cells, facing east.
 * Rows: 0 idle (6), 1 run (8), 3 sword attack (8), 5 hurt (4). A stance without a row of
 * its own (casting, guarding, cheering) keeps the idle row; CSS adds its glow or its jump.
 */
const HERO_POSES: Record<Stance, { row: number; frames: number; duration: number }> = {
  idle: { row: 0, frames: 6, duration: 0.9 },
  run: { row: 1, frames: 8, duration: 0.48 },
  strike: { row: 3, frames: 8, duration: 0.42 },
  cast: { row: 0, frames: 6, duration: 0.5 },
  hurt: { row: 5, frames: 4, duration: 0.36 },
  dodge: { row: 1, frames: 8, duration: 0.32 },
  guard: { row: 0, frames: 6, duration: 1.2 },
  down: { row: 5, frames: 1, duration: 1 },
  cheer: { row: 0, frames: 6, duration: 0.6 },
};

export function heroSprite(pose: Stance): CombatSprite {
  const { row, frames, duration } = HERO_POSES[pose];
  return { sheet: "hero", x: 12, y: row * 40, w: 56, h: 40, frames, pitch: 100, duration, scale: 1, padTop: 14, padBottom: 6 };
}

const slime = (row: number): Omit<CombatSprite, "scale"> => ({
  sheet: "objects", x: 0, y: row, w: 32, h: 32, frames: 4, pitch: 32, duration: 0.8, padTop: 11, padBottom: 10,
});
const GREEN_SLIME = slime(160);
const RED_SLIME = slime(192);
const GREY_SLIME = slime(224);
const BAT: Omit<CombatSprite, "scale"> = {
  sheet: "objects", x: 0, y: 288, w: 32, h: 32, frames: 3, pitch: 32, duration: 0.45, padTop: 5, padBottom: 3, floats: true,
};
const PLACEHOLDER: Omit<CombatSprite, "scale"> = {
  sheet: "mob", x: 0, y: 0, w: 32, h: 32, frames: 1, pitch: 0, duration: 1, padTop: 2, padBottom: 2, floats: true,
};

/** Tints a sheet's colours; brightens the dark placeholder first. */
const tint = (hue: number, saturation = 2) =>
  `sepia(1) saturate(${saturation}) hue-rotate(${hue}deg)`;

/** Monster type → look. Ordinary at 1.5x, sub-bosses 2.5x, bosses about 3x. */
export const MONSTER_LOOKS: Readonly<Record<string, CombatSprite>> = {
  "cave-goblin": { ...GREEN_SLIME, scale: 1.5 },
  "moss-wolf": { ...BAT, scale: 1.5, filter: "brightness(1.6) saturate(1.3)" },
  "skeleton-scout": { ...GREY_SLIME, scale: 1.5 },
  "ash-ogre": { ...RED_SLIME, scale: 2.5 },
  "crypt-warden": { ...GREY_SLIME, scale: 2.5, filter: tint(200) },
  "thorn-matriarch": { ...BAT, scale: 2.5, filter: "brightness(1.4) hue-rotate(90deg)" },
  "magma-behemoth": { ...RED_SLIME, scale: 3.5, filter: "saturate(2) brightness(1.2)" },
  "crypt-sovereign": { ...PLACEHOLDER, scale: 2.4, filter: `brightness(1.8) ${tint(230, 1.5)}` },
  "abyssal-tyrant": { ...PLACEHOLDER, scale: 2.4, filter: `brightness(1.8) ${tint(250, 1.5)}` },
};

const UNKNOWN_MONSTER: CombatSprite = { ...PLACEHOLDER, scale: 1.5, filter: "brightness(2)" };

export function monsterSprite(spriteKey: string): CombatSprite {
  return MONSTER_LOOKS[spriteKey] ?? UNKNOWN_MONSTER;
}

/** CSS custom properties of a sprite; `--u` (one source pixel) is set by the scene. */
export function spriteStyle(sprite: CombatSprite): Record<string, string> {
  const sheet = SHEETS[sprite.sheet];
  return {
    "--sx": String(sprite.x),
    "--sy": String(sprite.y),
    "--sw": String(sprite.w),
    "--sh": String(sprite.h),
    "--sheet-w": String(sheet.width),
    "--sheet-h": String(sheet.height),
    "--frames": String(sprite.frames),
    "--pitch": String(sprite.pitch),
    "--duration": `${sprite.duration}s`,
    "--scale": String(sprite.scale),
    "--pad-top": String(sprite.padTop),
    "--pad-bottom": String(sprite.padBottom),
    "--filter": sprite.filter ?? "none",
  };
}
