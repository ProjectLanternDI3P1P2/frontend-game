/**
 * The hero, drawn as a Mana Seed paper doll: a body, then an outfit, hair, maybe a hat, a
 * weapon and what its other hand holds, each on a sheet of its own, which the Player
 * feature's catalogue (`features/player/appearance.ts`) gives by their codes. Its weapon
 * decides its fighting style, hence the page of the art it is drawn from; every sheet of a
 * page has the same layout, so the layers play the same frames and move as one.
 *
 * Until the hero is received from the Player service, its look is drawn at random for each
 * run (`heroAppearanceOf`): a new dungeon, a new hero; the same run, the same hero on every
 * floor and after a reload. Data only: the viewport stacks the layers.
 */
import {
  HERO_CATALOGUE,
  HERO_SLOTS,
  heroSheetUrl,
  type HeroPage,
  type HeroPiece,
  type HeroSlot,
  type HeroStyles,
} from "~/features/player/appearance";
import type { Direction } from "../types";
import type { AnimatedSprite } from "./sprites";

/**
 * Every sheet: 512 x 512, in cells of 64 x 64, one row per facing. The hero stands on the
 * line y = 43 of its cell, around x = 32.
 */
export const HERO_SHEET = { width: 512, height: 512, cell: 64 } as const;

/**
 * The hero's fighting styles, each the page of the art that holds its idle and move: a
 * weapon in one hand and a shield, a bow and a quiver, or a polearm in both hands. Their
 * rows and cells are laid out alike (see `heroSprite`).
 */
export const HERO_STANCES = ["pONE2", "pBOW2", "pPOL2"] as const satisfies readonly HeroPage[];

export type HeroStance = (typeof HERO_STANCES)[number];

/** Every slot but the off hand, which a polearm leaves empty. */
type HeroWardrobe = Record<Exclude<HeroSlot, "shield">, HeroStyles> & { shield?: HeroStyles };

/**
 * What a hero of each fighting style can wear: every piece its page has. Typed without a
 * cast, so that a page lacking a slot does not compile here.
 */
export const HERO_WARDROBES: Record<HeroStance, HeroWardrobe> = {
  pONE2: HERO_CATALOGUE.pONE2,
  pBOW2: HERO_CATALOGUE.pBOW2,
  pPOL2: HERO_CATALOGUE.pPOL2,
};

export interface HeroAppearance {
  /** Its fighting style: the page it is drawn from. */
  stance: HeroStance;
  body: HeroPiece;
  outfit: HeroPiece;
  hair: HeroPiece;
  /** Bare-headed when null. */
  hat: HeroPiece | null;
  weapon: HeroPiece;
  /** A shield, or a quiver with a bow; null with a polearm, and with one wand in two. */
  shield: HeroPiece | null;
}

/** One hero in two wears a hat. */
const HAT_CHANCE = 0.5;

/** One wand in two is held without a shield: the other hand is free for the spells. */
const WAND_SHIELD_CHANCE = 0.5;

/** A hero drawn at random: a fighting style, then a piece and a colour for each slot. */
export function randomHeroAppearance(
  random: () => number = Math.random,
): HeroAppearance {
  const stance = HERO_STANCES[Math.floor(random() * HERO_STANCES.length)]!;
  const wardrobe = HERO_WARDROBES[stance];
  const pick = (styles: HeroStyles): HeroPiece => {
    const names = Object.keys(styles);
    const style = names[Math.floor(random() * names.length)]!;
    return { style, variant: 1 + Math.floor(random() * styles[style]!) };
  };
  const body = pick(wardrobe.body);
  const outfit = pick(wardrobe.outfit);
  const hair = pick(wardrobe.hair);
  const hat = random() < HAT_CHANCE ? pick(wardrobe.hat) : null;
  const weapon = pick(wardrobe.weapon);
  const freeHand = weapon.style === "wand" && random() >= WAND_SHIELD_CHANCE;
  const shield = wardrobe.shield && !freeHand ? pick(wardrobe.shield) : null;
  return { stance, body, outfit, hair, hat, weapon, shield };
}

/**
 * The hero of a run, drawn from its id: different from one run to the next, the same on
 * every floor of a run and after a reload.
 */
export function heroAppearanceOf(runId: string): HeroAppearance {
  return randomHeroAppearance(seededRandom(runId));
}

/** Mulberry32, seeded with the 32-bit FNV-1a of a text. */
function seededRandom(text: string): () => number {
  let state = 0x811c9dc5;
  for (const character of text) {
    state = Math.imul(state ^ character.codePointAt(0)!, 0x01000193);
  }
  return () => {
    // Wrapped to 32 bits, unsigned: the same draws as the reference's `| 0`.
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** The rows of the sheets. */
const FACING_ROWS: Record<Direction, number> = { south: 0, north: 1, east: 2, west: 3 };

/**
 * The layers from back to front, by fighting style and facing, as the art's layer order
 * guides draw the idle and move rows:
 * - one hand (a sword, an axe, a mace or a wand): the weapon in the right hand, the shield
 *   on the left arm. Facing south both
 *   are in front, the shield over the weapon; facing north both are behind, the weapon over
 *   the shield; sideways the weapon is in front and the shield behind;
 * - bow: the bow is in front facing south only; the quiver, on the back, in front facing
 *   north only;
 * - polearm: behind facing north, in front otherwise.
 */
const LAYER_ORDER: Record<HeroStance, Record<Direction, readonly HeroSlot[]>> = {
  pONE2: {
    south: ["body", "outfit", "hair", "hat", "weapon", "shield"],
    north: ["shield", "weapon", "body", "outfit", "hair", "hat"],
    east: ["shield", "body", "outfit", "hair", "hat", "weapon"],
    west: ["shield", "body", "outfit", "hair", "hat", "weapon"],
  },
  pBOW2: {
    south: ["shield", "body", "outfit", "hair", "hat", "weapon"],
    north: ["weapon", "body", "outfit", "hair", "hat", "shield"],
    east: ["shield", "weapon", "body", "outfit", "hair", "hat"],
    west: ["shield", "weapon", "body", "outfit", "hair", "hat"],
  },
  pPOL2: {
    south: ["shield", "body", "outfit", "hair", "hat", "weapon"],
    north: ["shield", "weapon", "body", "outfit", "hair", "hat"],
    east: ["shield", "body", "outfit", "hair", "hat", "weapon"],
    west: ["shield", "body", "outfit", "hair", "hat", "weapon"],
  },
};

export interface HeroLayer {
  slot: HeroSlot;
  /** The URL of its sheet. */
  sheet: string;
  /** 0 at the back. */
  depth: number;
}

/**
 * The sheets to stack for a hero facing a way. Always listed in the same order, whatever
 * the facing, with their depth: turning only changes the depths, so the view never
 * reorders its layers, which would restart their animation out of step.
 *
 * Headwear hides the hair: the hair sheets stick out of the headscarf and the pointy hat,
 * so the hair is left out while one is worn (the art's guide: "some hats will require the
 * hair to be removed").
 */
export function heroLayers(appearance: HeroAppearance, facing: Direction): HeroLayer[] {
  return HERO_SLOTS.flatMap((slot) => {
    const piece = appearance[slot];
    if (!piece) return [];
    if (slot === "hair" && appearance.hat) return [];
    return [
      {
        slot,
        sheet: heroSheetUrl(appearance.stance, slot, piece),
        depth: LAYER_ORDER[appearance.stance][facing].indexOf(slot),
      },
    ];
  });
}

/** On guard, or shuffling from one tile to the next with its weapon drawn. */
export type HeroPose = "idle" | "move";

/**
 * Combat idle and combat move: the first and the last four cells of each row, on the page of
 * every fighting style.
 */
const HERO_POSES: Record<
  HeroPose,
  { column: number; frames: number; duration: number }
> = {
  idle: { column: 0, frames: 4, duration: 0.8 },
  move: { column: 4, frames: 4, duration: 0.6 },
};

/**
 * The hero in a pose, facing a way. The window is a whole cell, wide enough for the
 * weapon, with the hero's feet near the bottom middle of its tile. It is nearly two tiles
 * tall: its head overlaps the row above, drawn behind it.
 */
export function heroSprite(pose: HeroPose, facing: Direction): AnimatedSprite {
  const { column, frames, duration } = HERO_POSES[pose];
  const { cell } = HERO_SHEET;
  return {
    sheet: "hero",
    x: column * cell,
    y: FACING_ROWS[facing] * cell,
    w: cell,
    h: cell,
    frames,
    pitch: cell,
    duration,
    dx: -24,
    dy: -29,
  };
}
