/**
 * Geometry of the dungeon sprite sheets, in source pixels. Data only: the choice of sprite
 * per tile lives in `autotile.ts`.
 *
 * - `atlas`: walls, floors, grates and columns in 16 x 16 tiles, assembled from the room
 *   kits of the art team by `npm run assets:dungeon` (see `atlas.generated.ts`). There is
 *   one image per theme, with the same layout: the theme only changes the image.
 * - `props`: furniture, banners, bones, blood, candles and mushrooms, as delivered.
 * - `objects`: animated pieces, as delivered: torches, the boss gate, chests and spikes.
 *   Animations are laid out as frames 32 (64 for the gate) pixels apart.
 * Mobs use `placeholder_mob.png` (see `tiles/sprites.ts`).
 */
import type { RoomTypeName } from "../types";
import {
  ATLAS_BLOCKS,
  ATLAS_COLUMNS,
  ATLAS_GUTTER,
  ATLAS_PITCH,
  ATLAS_SIZE,
  ATLAS_SPRITES,
  ATLAS_TILES,
  JOINTED_RIMS,
  RIM_KEYS,
} from "./atlas.generated";

export const TILE_SIZE = 16;

export type SheetName = "atlas" | "props" | "objects" | "torch" | "water" | "lava";

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Size of each sheet, needed to scale it with `background-size`. */
export const SHEETS: Record<SheetName, { width: number; height: number }> = {
  atlas: ATLAS_SIZE,
  props: { width: 384, height: 256 },
  objects: { width: 320, height: 480 },
  torch: { width: 320, height: 480 },
  water: { width: 96, height: 64 },
  lava: { width: 96, height: 64 },
};

/** One look per floor, in turn: the same dungeon, new stones as the hero goes down. */
export const THEMES = ["violet", "stone"] as const;
export type Theme = (typeof THEMES)[number];

export function themeOf(floor: number): Theme {
  return THEMES[floor % THEMES.length]!;
}

const rect = (x: number, y: number, w = TILE_SIZE, h = TILE_SIZE): SpriteRect => ({ x, y, w, h });
const tiles = (positions: readonly (readonly [number, number])[]) =>
  positions.map(([x, y]) => rect(x, y));

// --- Atlas ------------------------------------------------------------------------------

const rimIndex = new Map(RIM_KEYS.map((key, index) => [key, index]));

/**
 * The wall top for an arrangement of neighbours (see `RIM_KEYS`), with a joint between two
 * stones when asked and the piece is straight.
 */
export function rimSprite(key: string, jointed = false): SpriteRect {
  const joint = jointed ? JOINTED_RIMS[key] : undefined;
  if (joint) return rect(joint[0], joint[1]);
  const index = rimIndex.get(key);
  if (index === undefined) throw new Error(`No wall top for "${key}".`);
  return rect(
    (index % ATLAS_COLUMNS) * ATLAS_PITCH + ATLAS_GUTTER,
    Math.floor(index / ATLAS_COLUMNS) * ATLAS_PITCH + ATLAS_GUTTER,
  );
}

const faces = (name: "face" | "upperFace" | "lowerFace") => ({
  /** Consecutive columns of the kit's wall: laid in order, the bricks line up. */
  plain: tiles(ATLAS_TILES[name]),
  /** Holes, cracks and moss. */
  worn: tiles(ATLAS_TILES[`${name}Worn`]),
  leftEnd: tiles(ATLAS_TILES[`${name}LeftEnd`])[0]!,
  rightEnd: tiles(ATLAS_TILES[`${name}RightEnd`])[0]!,
});

/**
 * A wall seen from the front, below its top: one tile high where something stands just
 * above it, two (upper, then lower) where the void leaves room for it.
 */
export const FACES = {
  short: faces("face"),
  upper: faces("upperFace"),
  lower: faces("lowerFace"),
} as const;

export type FaceSet = (typeof FACES)[keyof typeof FACES];


export const FLOORS = {
  plain: tiles(ATLAS_TILES.plainFloor),
  cracked: tiles(ATLAS_TILES.crackedFloor),
} as const;

/** Floors two tiles square, laid where four floor tiles meet. */
export const FLOOR_BLOCKS = Object.fromEntries(
  Object.entries(ATLAS_BLOCKS).map(([name, [x, y]]) => [name, rect(x, y, 2 * TILE_SIZE, 2 * TILE_SIZE)]),
) as Record<keyof typeof ATLAS_BLOCKS, SpriteRect>;

export const GRATE = tiles(ATLAS_TILES.grate)[0]!;

/**
 * Water and lava (`liquids.png`, built by `npm run assets:dungeon`): three frames 32 pixels
 * square, water on the first row, lava, the same water recoloured, on the second. A tile
 * shows the quarter of the frame its position picks, so that a pool tiles seamlessly; CSS
 * plays the frames.
 */
export const LIQUID = { frame: 32, frames: 3, rows: { water: 0, lava: 32 } } as const;

export function liquidSprite(liquid: "water" | "lava", x: number, y: number): SpriteRect {
  return rect((x % 2) * TILE_SIZE, LIQUID.rows[liquid] + (y % 2) * TILE_SIZE);
}

/** The banks of a pool, over the liquid, by the sides where the floor stands (N 1, E 2, S 4, W 8). */
export const LIQUID_BANKS: readonly SpriteRect[] = tiles(ATLAS_TILES.liquidBank);

/** Stone tombs, plain and bloodied: three tiles long, or two. */
export const TOMBS = {
  long: rect(8, 67, 50, 27),
  short: rect(64, 67, 32, 27),
  longBloodied: rect(8, 99, 50, 27),
  shortBloodied: rect(64, 99, 32, 27),
} as const;

const sprite = ([x, y, w, h]: readonly [number, number, number, number]) => rect(x, y, w, h);

/** The ladder the party climbs down, in the middle of the start room. */
export const LADDER: SpriteRect = sprite(ATLAS_SPRITES.ladder);

/**
 * Columns one tile high or so, for colonnades: a whole column, four tiles high, would hide
 * the one standing two tiles behind it.
 */
export const SHORT_PILLARS: readonly SpriteRect[] = [
  sprite(ATLAS_SPRITES.shortPillar),
  sprite(ATLAS_SPRITES.brokenPillar),
];

export const PILLARS: readonly SpriteRect[] = [
  sprite(ATLAS_SPRITES.pillar),
  sprite(ATLAS_SPRITES.crackedPillar),
  sprite(ATLAS_SPRITES.shortPillar),
  sprite(ATLAS_SPRITES.brokenPillar),
  sprite(ATLAS_SPRITES.stump),
];

// --- Props ------------------------------------------------------------------------------

const PROP = {
  barrel: rect(169, 37, 16, 22),
  barrelOfBones: rect(136, 35, 16, 26),
  tallVase: rect(264, 4, 16, 24),
  amphora: rect(264, 37, 16, 24),
  greenVase: rect(264, 69, 16, 24),
  tallGreenVase: rect(264, 101, 16, 24),
  clayPot: rect(233, 9, 14, 16),
  greenPot: rect(233, 74, 14, 16),
  brokenPot: rect(297, 9, 14, 16),
  brokenVase: rect(295, 40, 16, 16),
  rock: rect(40, 169, 15, 14),
  boulder: rect(72, 167, 16, 16),
  skulls: rect(101, 8, 24, 16),
  cabinet: rect(200, 6, 16, 23),
  stool: rect(9, 137, 14, 15),
  candelabrum: rect(329, 37, 14, 22),
  candles: rect(171, 196, 12, 25),
  coins: rect(197, 71, 21, 21),
} as const;

/** A piece of furniture and the sheet it comes from. */
export interface Prop {
  sheet: SheetName;
  sprite: SpriteRect;
}

const props = (...sprites: SpriteRect[]): Prop[] => sprites.map((sprite) => ({ sheet: "props", sprite }));

/**
 * Chests standing open, lid up: emptied long ago, they hold nothing. Only the chests that
 * hold an item (see `itemSprite`) are closed.
 */
export const OPEN_CHESTS: readonly Prop[] = [64, 96, 128].map((y) => ({ sheet: "objects", sprite: rect(100, y, 24, 32) }));

/**
 * What stands on a tile nobody can cross, by kind of room: storerooms, a treasury, the
 * lair of a boss.
 */
export const OBSTACLES: Readonly<Record<RoomTypeName, readonly Prop[]>> = {
  start: props(PROP.barrel, PROP.barrel, PROP.tallVase, PROP.amphora, PROP.clayPot, PROP.cabinet, PROP.stool),
  combat: props(PROP.barrel, PROP.barrelOfBones, PROP.rock, PROP.boulder, PROP.skulls, PROP.greenVase, PROP.clayPot),
  treasure: [...props(PROP.coins, PROP.tallGreenVase, PROP.amphora), ...OPEN_CHESTS],
  empty: props(PROP.brokenPot, PROP.brokenVase, PROP.rock, PROP.boulder, PROP.greenPot, PROP.barrel),
  boss: props(PROP.skulls, PROP.barrelOfBones, PROP.candelabrum, PROP.candles, PROP.skulls, PROP.boulder),
};

/**
 * The iron fence of the art team, by role:
 * - `across`: rails between two fences side by side, two posts a tile;
 * - `along`: a fence running north to south, seen end on: the whole piece, two tiles high,
 *   on every tile of the run, each one in front of the one behind it;
 * - `leftEnd` and `rightEnd`: a lone post where the fence ends or turns, on the left or on
 *   the right of its run, with the half rail that joins it to its neighbour.
 */
export const FENCES = {
  across: rect(104, 166, 16, 21),
  along: rect(43, 192, 11, 32),
  leftEnd: rect(74, 197, 9, 21),
  rightEnd: rect(108, 197, 9, 21),
  /** The right and left halves of `across`, from a post to the edge of the tile. */
  railRight: rect(112, 166, 8, 21),
  railLeft: rect(104, 166, 8, 21),
} as const;

/** Hung on a wall face, over its top. */
export const BANNERS: readonly SpriteRect[] = [
  rect(2, 1, 28, 30), // red standard
  rect(34, 4, 27, 24), // red banner
  rect(66, 4, 27, 24), // torn red banner
  rect(2, 33, 28, 30), // green standard
  rect(34, 37, 27, 24), // green banner
];

export const WALL_DETAILS = {
  chain: rect(108, 32, 7, 32),
  bloodDrip: rect(231, 171, 19, 13),
  /** Spun from the left corner of a wall; mirrored for the right one. */
  cobwebs: [rect(323, 2, 24, 26), rect(359, 7, 23, 20)],
} as const;

/** Litter on the floor, never blocking. */
export const DECALS = {
  bones: [rect(136, 8, 16, 15), rect(169, 12, 14, 9)], // skull, bone
  blood: [rect(164, 167, 25, 18), rect(197, 168, 21, 15), rect(233, 202, 16, 12), rect(195, 196, 24, 23)],
  rubble: [rect(9, 233, 16, 12), rect(35, 234, 27, 13), rect(69, 236, 24, 9)],
  coins: [rect(173, 108, 7, 9), rect(204, 106, 7, 11)],
  note: rect(233, 235, 15, 10),
  help: rect(173, 228, 36, 23),
  // Closed green and red books, open ones.
  books: [rect(106, 73, 12, 15), rect(106, 104, 12, 15), rect(133, 72, 22, 16), rect(165, 72, 22, 16)],
  potions: [rect(332, 73, 9, 14), rect(332, 105, 9, 14), rect(364, 137, 9, 14)],
} as const;

/** Along the foot of a wall: candles and mushrooms. */
export const WALL_FOOT: readonly SpriteRect[] = [
  rect(142, 166, 6, 20), // candle
  rect(141, 199, 6, 16), // short candle
  rect(171, 196, 12, 25), // candles
  rect(329, 37, 14, 22), // candelabrum
  rect(267, 169, 13, 16), // mushrooms
  rect(299, 169, 13, 16),
  rect(330, 168, 13, 16),
  rect(362, 168, 13, 16),
  rect(299, 200, 13, 16),
  rect(331, 200, 13, 16),
];

// --- Objects ------------------------------------------------------------------------------

/** A wall torch: 5 frames, 32 pixels apart. */
export const TORCH: SpriteRect = rect(128, 64, 32, 32);
