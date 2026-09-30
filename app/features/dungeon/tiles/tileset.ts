/**
 * Geometry of the dungeon sprite sheets, in source pixels. Data only: the
 * choice of sprite per tile lives in `autotile.ts`.
 *
 * `assets/dungeon-tileset.png` is the 16 x 16 tileset as delivered (24 x 12
 * tiles). The roles below were read off the pack's own example maps: they are
 * exact tile maps of this sheet, so every piece is used the way its author
 * drew it. The animated torch, fire wall and spikes come from the pack's GIF
 * previews, downscaled 4x into horizontal strips.
 */

export const TILE_SIZE = 16;

export type SheetName = "tileset" | "torch" | "fireWall";

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Size of each sheet, needed to scale it with `background-size`. */
export const SHEETS: Record<SheetName, { width: number; height: number; frames: number }> = {
  tileset: { width: 384, height: 192, frames: 1 },
  torch: { width: 64, height: 32, frames: 4 },
  fireWall: { width: 80, height: 32, frames: 5 },
};

const tile = (column: number, row: number, columns = 1, rows = 1): SpriteRect => ({
  x: column * TILE_SIZE,
  y: row * TILE_SIZE,
  w: columns * TILE_SIZE,
  h: rows * TILE_SIZE,
});

/**
 * Wall tops ("rims") form a network drawn from above; each piece is chosen from
 * the rim tiles around it. The horizontal pieces show the top of the brick face
 * in their lower half.
 */
export const RIMS = {
  horizontal: tile(3, 0),
  vertical: tile(2, 1),
  cornerDownRight: tile(2, 0), // ┌
  cornerDownLeft: tile(4, 0), // ┐
  cornerUpRight: tile(2, 2), // └
  cornerUpLeft: tile(4, 1), // ┘
  teeDown: tile(3, 2), // ┬
  /** Top of a wall face whose left (right) end is free, not joined to a wall. */
  leftEnd: tile(0, 1),
  rightEnd: tile(1, 1),
} as const;

/** Lower half of a wall seen from the front (the rim above holds the upper half). */
export const FACES = {
  plain: [tile(3, 1), tile(3, 1), tile(3, 1), tile(7, 4), tile(7, 2)],
  leftEnd: tile(0, 2),
  rightEnd: tile(1, 2),
  /** South walls seen from outside the room: darker face, then the dark foot. */
  outer: tile(10, 4),
  foot: tile(6, 5),
} as const;

/**
 * Two-tile decorations of a wall face: the upper piece replaces the rim above
 * the face, the lower one the face itself.
 */
export const WALL_DECORATIONS: readonly { upper: SpriteRect; lower: SpriteRect }[] = [
  { upper: tile(0, 3), lower: tile(0, 4) }, // red banner
  { upper: tile(5, 3), lower: tile(5, 4) }, // blue banner
  { upper: tile(6, 3), lower: tile(6, 4) }, // red banner, other cut
  { upper: tile(1, 3), lower: tile(1, 4) }, // grate
  { upper: tile(2, 3), lower: tile(2, 4) }, // cracked wall
  { upper: tile(8, 3), lower: tile(8, 4) }, // fire alcove
];

/**
 * The wooden double gate of a boss room, three tiles wide and two tall: it closes the way to
 * the stairs until the boss is defeated. Used for that gate only, so that it never looks
 * like a door leading nowhere.
 */
export const GATE: SpriteRect = tile(0, 5, 3, 2);

/**
 * The floor is laid as 4 x 4 blocks of flagstones, as in the pack's examples:
 * three large slabs and plain tiles.
 */
export const FLAGSTONES: readonly (readonly SpriteRect[])[] = [
  [tile(9, 8), tile(10, 8), tile(11, 8), tile(1, 0)],
  [tile(9, 9), tile(10, 9), tile(11, 9), tile(1, 0)],
  [tile(1, 0), tile(1, 0), tile(11, 10), tile(12, 10)],
  [tile(1, 0), tile(1, 0), tile(11, 11), tile(12, 11)],
];

/** Worn stones that occasionally replace a plain floor tile. */
export const WORN_FLOORS: readonly SpriteRect[] = [tile(7, 10), tile(13, 10), tile(14, 10)];

export const SEWER_GRATE = tile(9, 2);

export const STAIRS = tile(9, 1);

/** Props standing on a tile: their bottom edge sits on the tile's bottom edge. */
export const PROPS = {
  obstacles: [
    { x: 112, y: 87, w: 16, h: 19 }, // barrel
    { x: 128, y: 87, w: 16, h: 19 }, // barrel, other staves
    { x: 146, y: 91, w: 12, h: 15 }, // clay pot
  ],
  pillars: [
    { x: 352, y: 3, w: 15, h: 45 }, // column
    { x: 320, y: 0, w: 15, h: 37 }, // short column
    { x: 336, y: 0, w: 15, h: 37 }, // carved column
  ],
  fence: { x: 368, y: 25, w: 15, h: 23 },
  item: { x: 163, y: 91, w: 9, h: 15 }, // jar
} as const;

/** Floor litter, never blocking: purely decorative. */
export const DECALS: readonly SpriteRect[] = [
  { x: 241, y: 69, w: 15, h: 11 }, // skull and bones
  { x: 121, y: 152, w: 6, h: 4 }, // pebble
  { x: 177, y: 74, w: 5, h: 3 }, // small stone
];

export const TORCH: SpriteRect = { x: 0, y: 0, w: 16, h: 32 };
export const FIRE_WALL: SpriteRect = { x: 0, y: 0, w: 16, h: 32 };
