/**
 * Chooses the sprites of every tile of a floor ("autotiling"). The backend only sends
 * abstract cell types; how a wall looks is a presentation decision.
 *
 * Walls are drawn in three-quarter view, as in the art team's room kit:
 * - a wall with an open tile below it is seen from the front: its FACE (bricks) stands on
 *   the wall tile and, when the void above leaves room for it, on the tile above too, so
 *   that the walls of a room look as high as in the kit; its top edge, the RIM, lies above;
 * - every other wall is seen from above and only shows its rim;
 * - rims are bands of stone that hug the inside of the dungeon. Each rim tile is chosen
 *   from what surrounds it on its eight sides (another rim, the inside, the void), which
 *   gives closed corners, junctions between rooms and corridors, and rounded ends;
 * - a wall that closes a room on its south side shows its front edge: the void starts below.
 * The gate down is part of its wall: the viewport draws its portcullis over it. Where a
 * corridor leaves a room northwards, the face rises on both sides of the opening, over the
 * corridor's own walls, so that the wall keeps its height. The party arrives down a ladder
 * in the middle of the start room.
 *
 * Each room is dressed for what it is: barrels and vases in the start room, coins and
 * chests in the treasury, skulls, candles and blood in the lair of a boss; torches frame
 * the doors. Deterministic: variants are picked with a hash of (seed, floor, x, y), never
 * with Math.random, so a replayed seed looks identical. Computed once per floor into plain
 * strings that the template binds as they are.
 */
import type { CellCode, DecodedFloor } from "../dungeonMap";
import { Cell, cellAt, isWalkable } from "../dungeonMap";
import type { RoomTypeName } from "../types";
import type { FaceSet, Prop, SheetName, SpriteRect } from "./tileset";
import {
  BANNERS,
  DECALS,
  FACES,
  FENCES,
  FLOOR_BLOCKS,
  FLOORS,
  GRATE,
  OBSTACLES,
  LADDER,
  LIQUID_BANKS,
  PILLARS,
  SHORT_PILLARS,
  TOMBS,
  TILE_SIZE,
  TORCH,
  WALL_DETAILS,
  WALL_FOOT,
  liquidSprite,
  rimSprite,
} from "./tileset";

export type SpriteTransform = "flip-x";

export interface TileLayer {
  sheet: SheetName;
  sprite: SpriteRect;
  /** Offset from the tile's top-left corner, in source pixels. */
  dx: number;
  dy: number;
  transform?: SpriteTransform;
  /**
   * Stands up from its tile (a column, a barrel, the ladder): it hides whatever is behind
   * it, the hero and the mobs included, and is hidden by what stands in front of it.
   */
  upright?: boolean;
}

/** What the template renders: one absolutely positioned element per layer. */
export interface RenderedLayer {
  className: string;
  /** CSS custom properties only: sizes are resolved in CSS from --tile. */
  style: string;
}

/** Most layers a tile can have: the viewport keys its elements with it. */
export const MAX_LAYERS = 4;

/** Per mille, rolled once per eligible tile. */
const CHANCE = {
  jointedRim: 300,
  wornFace: 70,
  crackedFloor: 45,
  floorBlock: 60,
  wallFoot: 90,
  torch: 90,
  banner: 70,
  chain: 30,
  bloodDrip: 20,
  cobweb: 450,
} as const;

type Litter = keyof typeof DECALS;

/** Per mille, by kind of room: what lies on its floor. Corridors use `corridor`. */
const LITTER: Readonly<Record<RoomTypeName | "corridor", Partial<Record<Litter, number>>>> = {
  start: { rubble: 8, note: 4, books: 5 },
  combat: { bones: 14, blood: 12, rubble: 14 },
  treasure: { coins: 45, note: 6, books: 8, potions: 10 },
  empty: { rubble: 30, bones: 8, note: 4, books: 10, potions: 3 },
  boss: { bones: 28, blood: 30, rubble: 10, help: 3 },
  corridor: { rubble: 12, bones: 5 },
};

/** 32-bit FNV-1a of the seed and floor: the base of every visual variant. */
export function visualSeed(seed: string, floor: number): number {
  let hash = 0x811c9dc5;
  for (const character of `${seed}#${floor}`) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 0x01000193);
  }
  return hash >>> 0;
}

/** A well-mixed 32-bit hash of a tile position (murmur3 finaliser). */
export function tileHash(base: number, x: number, y: number): number {
  let hash = base ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

/** Part of a wall: the gate down stands in one. */
export function isWallLike(code: CellCode): boolean {
  return code === Cell.Wall || code === Cell.Gate;
}

/** Inside the dungeon: anything a room or a corridor is made of. */
export function isOpen(code: CellCode): boolean {
  return code !== Cell.Void && !isWallLike(code);
}

function pick<T>(items: readonly T[], hash: number): T {
  return items[hash % items.length]!;
}

function roll(hash: number, salt: number): number {
  return (Math.imul(hash ^ salt, 0x9e3779b1) >>> 12) % 1000;
}

const atlas = (sprite: SpriteRect, dx = 0, dy = 0): TileLayer => ({ sheet: "atlas", sprite, dx, dy });

/** Bottom-aligned on its tile, horizontally centred: things stand on the floor. */
/** Something standing on its tile: drawn in front of what is behind it (see `upright`). */
function standing(sheet: SheetName, sprite: SpriteRect, lift = 0): TileLayer {
  return {
    sheet,
    sprite,
    dx: Math.floor((TILE_SIZE - sprite.w) / 2),
    dy: TILE_SIZE - sprite.h - lift,
    upright: true,
  };
}

/**
 * The furniture on an obstacle, chosen for the room. Big pieces, wider than a tile or as
 * tall as an open chest, would overlap their neighbours: they only stand between two bare
 * floor tiles, with nothing standing right behind them.
 */
function obstacleProp(
  plan: WallPlan,
  x: number,
  y: number,
  hash: number,
  roomType: RoomTypeName | undefined,
): Prop {
  const all = OBSTACLES[roomType ?? "combat"];
  const { width, elementsByCell } = plan.floor;
  const hasElement = (dx: number, dy: number) => elementsByCell.has((y + dy) * width + x + dx);
  // Beside it, only bare floor: a wall, a column or a fence would be covered.
  const isBlockedBeside = (dx: number) => !isWalkable(plan.code(x + dx, y)) || hasElement(dx, 0);
  const isBlockedBehind = [Cell.Obstacle, Cell.Pillar, Cell.Fence].includes(plan.code(x, y - 1) as never) || hasElement(0, -1);
  const isCrowded = isBlockedBeside(-1) || isBlockedBeside(1) || isBlockedBehind;
  const small = all.filter((prop) => !isBigProp(prop.sprite));
  return pick(isCrowded && small.length > 0 ? small : all, hash >>> 8);
}

/**
 * A fence, from its neighbours: rails between fences side by side, the end-on piece where it
 * runs north to south, and a post where it ends or turns, with the half rail that joins it
 * to the fence beside it.
 */
function fenceLayers(plan: WallPlan, x: number, y: number): TileLayer[] {
  const isFence = (dx: number) => plan.code(x + dx, y) === Cell.Fence;
  const left = isFence(-1);
  const right = isFence(1);
  if (left && right) return [standing("props", FENCES.across)];
  if (!left && !right) {
    const runsAlong = [-1, 1].some((dy) => plan.code(x, y + dy) === Cell.Fence);
    return [standing("props", runsAlong ? FENCES.along : FENCES.leftEnd)];
  }
  const post = standing("props", right ? FENCES.leftEnd : FENCES.rightEnd);
  const rail = right
    ? { ...standing("props", FENCES.railRight), dx: TILE_SIZE / 2 }
    : { ...standing("props", FENCES.railLeft), dx: 0 };
  return [rail, post];
}

/**
 * Water or lava, the frame's quarter for the tile, then the banks where the floor stands
 * beside it. The banks come from the atlas, in the theme's own colours.
 */
function liquidLayers(plan: WallPlan, code: CellCode, x: number, y: number): TileLayer[] {
  const sheet = code === Cell.Water ? "water" : "lava";
  const layers: TileLayer[] = [{ sheet, sprite: liquidSprite(sheet, x, y), dx: 0, dy: 0 }];
  const isBank = (dx: number, dy: number) => plan.code(x + dx, y + dy) !== code;
  const mask = (isBank(0, -1) ? 1 : 0) | (isBank(1, 0) ? 2 : 0) | (isBank(0, 1) ? 4 : 0) | (isBank(-1, 0) ? 8 : 0);
  if (mask !== 0) layers.push(atlas(LIQUID_BANKS[mask]!));
  return layers;
}

/**
 * Tombs lie two or three side by side: the first tile of the row carries the whole tomb,
 * the others only their floor. In the lair of a boss, they are bloodied.
 */
function tombLayers(
  plan: WallPlan,
  x: number,
  y: number,
  hash: number,
  roomType: RoomTypeName | undefined,
): TileLayer[] {
  if (plan.code(x - 1, y) === Cell.Tomb) return [];
  let length = 1;
  while (plan.code(x + length, y) === Cell.Tomb) length++;
  const bloodied = roomType === "boss" || roll(hash, 11) < 250;
  const sprite =
    length >= 3
      ? bloodied ? TOMBS.longBloodied : TOMBS.long
      : bloodied ? TOMBS.shortBloodied : TOMBS.short;
  return [{ ...standing("props", sprite), dx: Math.floor((length * TILE_SIZE - sprite.w) / 2) }];
}

/** Wider than a tile, or as tall as an open chest. */
export function isBigProp(sprite: SpriteRect): boolean {
  return sprite.w > TILE_SIZE || sprite.h > 28;
}

type Decoration =
  | { kind: "torch" }
  | { kind: "banner"; sprite: SpriteRect }
  | { kind: "detail"; sprite: SpriteRect };

/** What surrounds a rim on one side: another rim, the inside, or the void. */
type Side = "R" | "I" | "V";

/** Everything the autotiler knows about a floor, computed once. */
class WallPlan {
  /** Walls seen from the front: the tile just above an open one. */
  readonly face: Uint8Array;
  /** The void above a face, where its upper half stands. */
  readonly upperFace: Uint8Array;
  readonly rim: Uint8Array;
  /** Decorations by the index of the lower face of their wall. */
  readonly decorations = new Map<number, Decoration>();

  constructor(
    readonly floor: DecodedFloor,
    readonly base: number,
  ) {
    this.face = this.mask((x, y) => isWallLike(this.code(x, y)) && isOpen(this.code(x, y + 1)));
    this.upperFace = this.mask((x, y) => {
      if (!this.isFace(x, y + 1) || this.isThinWall(x, y + 1)) return false;
      const code = this.code(x, y);
      if (code === Cell.Void) return this.code(x, y - 1) === Cell.Void;
      // A wall standing on a face: the wall of a corridor beside an opening, or the wall of
      // a room above a side door. The face rises over it, so that a wall keeps the same
      // height from one end to the other.
      return code === Cell.Wall && !isOpen(this.code(x, y - 1));
    });
    this.rim = this.rimMask();
    this.planDecorations();
  }

  code(x: number, y: number): CellCode {
    return cellAt(this.floor, x, y);
  }

  isFace(x: number, y: number): boolean {
    return this.inside(x, y) && this.face[y * this.floor.width + x] === 1;
  }

  isUpperFace(x: number, y: number): boolean {
    return this.inside(x, y) && this.upperFace[y * this.floor.width + x] === 1;
  }

  /** Bricks seen from the front, either half. */
  isAnyFace(x: number, y: number): boolean {
    return this.isFace(x, y) || this.isUpperFace(x, y);
  }

  isRim(x: number, y: number): boolean {
    return this.inside(x, y) && this.rim[y * this.floor.width + x] === 1;
  }

  /** A face between two open tiles: too thin to show bricks, drawn as a rim. */
  isThinWall(x: number, y: number): boolean {
    return this.isFace(x, y) && isOpen(this.code(x, y - 1));
  }

  roomType(x: number, y: number): RoomTypeName | undefined {
    if (!this.inside(x, y)) return undefined;
    const roomId = this.floor.roomIdByCell[y * this.floor.width + x]!;
    return roomId < 0 ? undefined : this.floor.rooms[roomId]?.type;
  }

  /** One byte per tile, 1 where the predicate holds. */
  private mask(predicate: (x: number, y: number) => boolean): Uint8Array {
    const { width, height } = this.floor;
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (predicate(x, y)) mask[y * width + x] = 1;
      }
    }
    return mask;
  }

  /**
   * Walls seen from above, the void just above the top of a face, and the void beside it,
   * where the side walls rise to meet that top. Computed from the bottom up: a side wall
   * rises as long as a face stands next to it.
   */
  private rimMask(): Uint8Array {
    const { width, height } = this.floor;
    const rim = new Uint8Array(width * height);
    const isRimBelow = (x: number, y: number) => y + 1 < height && rim[(y + 1) * width + x] === 1;
    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        const code = this.code(x, y);
        let isRim = false;
        if (isWallLike(code)) isRim = !this.isFace(x, y) && !this.isUpperFace(x, y);
        else if (code === Cell.Void && !this.isUpperFace(x, y)) {
          const topOfFace = this.isUpperFace(x, y + 1) || this.isFace(x, y + 1);
          const besideFace =
            isRimBelow(x, y) && (this.isAnyFace(x - 1, y + 1) || this.isAnyFace(x + 1, y + 1));
          isRim = topOfFace || besideFace;
        }
        if (isRim) rim[y * width + x] = 1;
      }
    }
    return rim;
  }

  private side(x: number, y: number): Side {
    if (this.isRim(x, y) || this.isThinWall(x, y)) return "R";
    return isOpen(this.code(x, y)) || this.isAnyFace(x, y) ? "I" : "V";
  }

  /** The arrangement around a rim, as the atlas keys it (see `RIM_KEYS`). */
  rimKey(x: number, y: number): string {
    const n = this.side(x, y - 1);
    const e = this.side(x + 1, y);
    const s = this.side(x, y + 1);
    const w = this.side(x - 1, y);
    const corner = (a: Side, b: Side, cx: number, cy: number) =>
      a === "R" && b === "R" ? this.side(cx, cy) : "-";
    return (
      n + e + s + w +
      corner(n, e, x + 1, y - 1) +
      corner(s, e, x + 1, y + 1) +
      corner(s, w, x - 1, y + 1) +
      corner(n, w, x - 1, y - 1)
    );
  }

  /**
   * How the lower half of a face ends on each side. It ends freely against the void, or
   * against an opening when nothing rises above it; otherwise the rim above turns into the
   * wall beside it.
   */
  faceEnds(x: number, y: number): { left: boolean; right: boolean } {
    const freeEnd = (dx: number) => {
      const side = this.code(x + dx, y);
      if (side === Cell.Void) return true;
      return isOpen(side) && !this.isRim(x + dx, y - 1);
    };
    return { left: freeEnd(-1), right: freeEnd(1) };
  }

  /** How the upper half of a face ends: freely wherever neither a face nor a rim goes on. */
  upperFaceEnds(x: number, y: number): { left: boolean; right: boolean } {
    const freeEnd = (dx: number) => !this.isAnyFace(x + dx, y) && !this.isRim(x + dx, y);
    return { left: freeEnd(-1), right: freeEnd(1) };
  }

  /** Beside or under the arch of the gate down: kept plain. */
  private isNextToDoor(x: number, y: number): boolean {
    return [-1, 0, 1].some((dx) => this.code(x + dx, y) === Cell.Gate);
  }

  /** A face that can carry a decoration: a plain stretch of wall, between two faces. */
  private canDecorate(x: number, y: number): boolean {
    if (!this.isFace(x, y) || this.isThinWall(x, y) || this.isNextToDoor(x, y)) return false;
    return (
      this.isFace(x - 1, y) &&
      this.isFace(x + 1, y) &&
      (this.isRim(x, y - 1) || this.isUpperFace(x, y - 1))
    );
  }

  private planDecorations(): void {
    const { width, height } = this.floor;

    // Torches frame the gate down.
    for (let index = 0; index < this.floor.cells.length; index++) {
      if (this.floor.cells[index] !== Cell.Gate) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      for (const side of [-1, 1]) {
        // Beside the arch, or one tile further when a column stands in front of the wall.
        const torchX = [x + 2 * side, x + 3 * side].find(
          (candidate) => this.canDecorate(candidate, y) && this.code(candidate, y + 1) !== Cell.Pillar,
        );
        if (torchX !== undefined) this.decorations.set(y * width + torchX, { kind: "torch" });
      }
    }

    for (let y = 0; y < height; y++) {
      // Banners are wider than a tile: keep two tiles between decorations.
      let lastDecorated = -3;
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (this.decorations.has(index)) {
          lastDecorated = x;
          continue;
        }
        if (x - lastDecorated < 3 || !this.canDecorate(x, y)) continue;
        if ([1, 2].some((dx) => this.decorations.has(index + dx))) continue;
        const decoration = rollDecoration(tileHash(this.base, x, y));
        if (!decoration) continue;
        // Banners hang in the rooms only: a corridor is too narrow for them.
        if (decoration.kind === "banner" && !this.roomType(x, y + 1)) continue;
        // A wall one tile high, like a low inner wall, has nothing to hang them from.
        if (!this.isUpperFace(x, y - 1)) continue;
        this.decorations.set(index, decoration);
        lastDecorated = x;
      }
    }
  }

  private inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.floor.width && y < this.floor.height;
  }
}

/** Torch, banner, chain, blood or nothing, in that order of the roll. */
function rollDecoration(hash: number): Decoration | null {
  const chance = roll(hash, 1);
  let threshold = CHANCE.torch;
  if (chance < threshold) return { kind: "torch" };
  threshold += CHANCE.banner;
  if (chance < threshold) return { kind: "banner", sprite: pick(BANNERS, hash >>> 7) };
  threshold += CHANCE.chain;
  if (chance < threshold) return { kind: "detail", sprite: WALL_DETAILS.chain };
  threshold += CHANCE.bloodDrip;
  if (chance < threshold) return { kind: "detail", sprite: WALL_DETAILS.bloodDrip };
  return null;
}

/** Every layer of every tile, before rendering to strings. */
export function planFloor(floor: DecodedFloor): TileLayer[][] {
  const base = visualSeed(floor.seed, floor.floor);
  const plan = new WallPlan(floor, base);
  const { width, height } = floor;
  // Most of a floor is void: its tiles share one empty list.
  const layers: TileLayer[][] = new Array<TileLayer[]>(width * height);
  const blocks = planFloorBlocks(floor, base);

  const at = (x: number, y: number) => (layers[y * width + x] ??= []);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const code = plan.code(x, y);
      const hash = tileHash(base, x, y);
      if (isOpen(code)) {
        at(x, y).push(...floorLayers(plan, code, x, y, hash, blocks.get(y * width + x)));
      } else if (plan.isUpperFace(x, y)) {
        at(x, y).push(...upperFaceLayers(plan, x, y));
      } else if (isWallLike(code) || plan.isRim(x, y)) {
        at(x, y).push(...wallLayers(plan, x, y, hash));
      }
    }
  }

  const { entrance } = floor;
  at(entrance.x, entrance.y).push(standing("atlas", LADDER));

  const empty: TileLayer[] = [];
  for (let index = 0; index < layers.length; index++) layers[index] ??= empty;
  return layers;
}

/** A wall tile: its rim, or the lower half of its face. */
function wallLayers(plan: WallPlan, x: number, y: number, hash: number): TileLayer[] {
  if (plan.isRim(x, y) || plan.isThinWall(x, y)) {
    return [atlas(rimSprite(plan.rimKey(x, y), roll(hash, 6) < CHANCE.jointedRim))];
  }
  return plan.isFace(x, y) ? lowerFaceLayers(plan, x, y) : [];
}

/** The bricks of a face, from its set: worn now and then, in kit order otherwise. */
function faceSprite(
  plan: WallPlan,
  set: FaceSet,
  x: number,
  lowerY: number,
  ends: { left: boolean; right: boolean },
): SpriteRect {
  if (ends.left && !ends.right) return set.leftEnd;
  if (ends.right && !ends.left) return set.rightEnd;
  // One roll per column, so that both halves of a wall are worn together.
  const hash = tileHash(plan.base ^ 0x2545f491, x, lowerY);
  if (roll(hash, 7) < CHANCE.wornFace) return pick(set.worn, hash >>> 5);
  // Consecutive kit columns, so that the courses of bricks line up along the wall.
  return set.plain[x % set.plain.length]!;
}

function lowerFaceLayers(plan: WallPlan, x: number, y: number): TileLayer[] {
  const isTall = plan.isUpperFace(x, y - 1);
  const layers = [atlas(faceSprite(plan, isTall ? FACES.lower : FACES.short, x, y, plan.faceEnds(x, y)))];
  if (!isTall) layers.push(...wallDressing(plan, x, y, y, -TILE_SIZE));
  return layers;
}

function upperFaceLayers(plan: WallPlan, x: number, y: number): TileLayer[] {
  const layers = [atlas(faceSprite(plan, FACES.upper, x, y + 1, plan.upperFaceEnds(x, y)))];
  layers.push(...wallDressing(plan, x, y, y + 1, 0));
  return layers;
}

/**
 * What hangs on a wall, drawn on its top tile (`top` is 0 on the upper half of a tall
 * face, -16 on a short face, where the top of the wall is the rim above).
 */
function wallDressing(plan: WallPlan, x: number, y: number, lowerY: number, top: number): TileLayer[] {
  const layers: TileLayer[] = [];
  const decoration = plan.decorations.get(lowerY * plan.floor.width + x);
  if (decoration) layers.push(decorationLayer(decoration, top));

  // Cobwebs spun in the upper corners of a room.
  const hash = tileHash(plan.base ^ 0x68e31da4, x, lowerY);
  const isCorner = (dx: number) => !plan.isAnyFace(x + dx, y) && !isOpen(plan.code(x + dx, y));
  const cornerLeft = isCorner(-1);
  const cornerRight = isCorner(1);
  // Not behind a banner or a torch: one thing hangs in a corner.
  if (!decoration && (cornerLeft || cornerRight) && roll(hash, 8) < CHANCE.cobweb) {
    const web = pick(WALL_DETAILS.cobwebs, hash >>> 9);
    layers.push({
      sheet: "props",
      sprite: web,
      dx: cornerLeft ? 0 : TILE_SIZE - web.w,
      dy: top === 0 ? 0 : -6,
      ...(cornerLeft ? {} : { transform: "flip-x" as const }),
    });
  }
  return layers;
}

function decorationLayer(decoration: Decoration, top: number): TileLayer {
  switch (decoration.kind) {
    case "torch":
      // The flame rises over the top of the wall; the bracket sits on the bricks.
      return { sheet: "torch", sprite: TORCH, dx: -8, dy: top - 2 };
    case "banner": {
      const { sprite } = decoration;
      return { sheet: "props", sprite, dx: Math.floor((TILE_SIZE - sprite.w) / 2), dy: top + 1 };
    }
    case "detail": {
      const { sprite } = decoration;
      return { sheet: "props", sprite, dx: Math.floor((TILE_SIZE - sprite.w) / 2), dy: top + 1 };
    }
  }
}

/**
 * Large floor pieces, two tiles square, each laid over four plain floor tiles: every
 * covered tile maps to its quarter of the piece.
 */
function planFloorBlocks(floor: DecodedFloor, base: number): Map<number, SpriteRect> {
  const blocks = new Map<number, SpriteRect>();
  const pieces = Object.values(FLOOR_BLOCKS);
  const { width, height } = floor;
  for (let y = 0; y + 1 < height; y += 2) {
    for (let x = 0; x + 1 < width; x += 2) {
      const hash = tileHash(base ^ 0x5bd1e995, x, y);
      if (roll(hash, 9) >= CHANCE.floorBlock) continue;
      const covered = [0, 1, 2, 3].map((corner) => ({ x: x + (corner % 2), y: y + (corner >> 1) }));
      if (!covered.every((tile) => cellAt(floor, tile.x, tile.y) === Cell.Floor)) continue;

      const piece = pick(pieces, hash >>> 6);
      for (const tile of covered) {
        blocks.set(tile.y * width + tile.x, {
          x: piece.x + (tile.x - x) * TILE_SIZE,
          y: piece.y + (tile.y - y) * TILE_SIZE,
          w: TILE_SIZE,
          h: TILE_SIZE,
        });
      }
    }
  }
  return blocks;
}

function floorLayers(
  plan: WallPlan,
  code: CellCode,
  x: number,
  y: number,
  hash: number,
  block: SpriteRect | undefined,
): TileLayer[] {
  if (code === Cell.Grate) return [atlas(GRATE)];
  if (code === Cell.Water || code === Cell.Lava) return liquidLayers(plan, code, x, y);

  let ground: SpriteRect;
  if (block) ground = block;
  else if (code !== Cell.Door && roll(hash, 3) < CHANCE.crackedFloor) ground = pick(FLOORS.cracked, hash >>> 5);
  else ground = pick(FLOORS.plain, hash >>> 5);

  const layers = [atlas(ground)];
  const roomType = plan.roomType(x, y);

  switch (code) {
    case Cell.Obstacle: {
      const { sheet, sprite } = obstacleProp(plan, x, y, hash, roomType);
      layers.push(standing(sheet, sprite));
      break;
    }
    case Cell.Pillar: {
      // In a colonnade, columns stand a couple of tiles apart: short ones, all of them
      // seen. Elsewhere, mostly whole columns; now and then a cracked, short or broken one.
      const inColonnade = [-3, -2, -1, 1, 2, 3].some((dy) => plan.code(x, y + dy) === Cell.Pillar);
      let pillar: SpriteRect;
      if (inColonnade) pillar = roll(hash, 4) < 800 ? SHORT_PILLARS[0]! : pick(SHORT_PILLARS, hash >>> 9);
      else pillar = roll(hash, 4) < 650 ? PILLARS[0]! : pick(PILLARS, hash >>> 9);
      layers.push(standing("atlas", pillar));
      break;
    }
    case Cell.Fence:
      layers.push(...fenceLayers(plan, x, y));
      break;
    case Cell.Tomb:
      layers.push(...tombLayers(plan, x, y, hash, roomType));
      break;
    case Cell.Floor:
      layers.push(...litter(plan, x, y, hash, roomType));
      break;
    default:
      break;
  }

  return layers;
}

/**
 * Candles and mushrooms along the foot of the walls; bones, blood, coins or rubble
 * elsewhere, depending on the room. Never on a door, never blocking.
 */
function litter(
  plan: WallPlan,
  x: number,
  y: number,
  hash: number,
  roomType: RoomTypeName | undefined,
): TileLayer[] {
  // Nothing on or under the ladder, which rises three tiles high.
  const { entrance } = plan.floor;
  if (x === entrance.x && y >= entrance.y - 2 && y <= entrance.y) return [];

  if (plan.isFace(x, y - 1) && !plan.isThinWall(x, y - 1) && roll(hash, 10) < CHANCE.wallFoot) {
    return [standing("props", pick(WALL_FOOT, hash >>> 11), 1)];
  }

  const jitter = (salt: number) => ((hash >>> salt) % 5) - 2;
  const centred = (sprite: SpriteRect): TileLayer => ({
    sheet: "props",
    sprite,
    dx: Math.floor((TILE_SIZE - sprite.w) / 2) + jitter(3),
    dy: Math.floor((TILE_SIZE - sprite.h) / 2) + jitter(6),
  });

  const chance = roll(hash, 5);
  let threshold = 0;
  for (const [kind, perMille] of Object.entries(LITTER[roomType ?? "corridor"]) as [Litter, number][]) {
    threshold += perMille;
    if (chance >= threshold) continue;
    const decal = DECALS[kind];
    const layer = centred(Array.isArray(decal) ? pick(decal, hash >>> 12) : (decal as SpriteRect));
    return spillsOnlyOnFloor(plan, x, y, layer) ? [layer] : [];
  }
  return [];
}

/**
 * Overlays are drawn above every tile: a decal wider than its tile must not spill onto a
 * wall, a pillar or anything else that stands up. It only overflows onto plain floor.
 */
function spillsOnlyOnFloor(plan: WallPlan, x: number, y: number, layer: TileLayer): boolean {
  const left = layer.dx < 0 ? -1 : 0;
  const right = layer.dx + layer.sprite.w > TILE_SIZE ? 1 : 0;
  const top = layer.dy < 0 ? -1 : 0;
  const bottom = layer.dy + layer.sprite.h > TILE_SIZE ? 1 : 0;
  for (let dy = top; dy <= bottom; dy++) {
    for (let dx = left; dx <= right; dx++) {
      if ((dx !== 0 || dy !== 0) && plan.code(x + dx, y + dy) !== Cell.Floor) return false;
    }
  }
  return true;
}

function render(layer: TileLayer, x: number, y: number): RenderedLayer {
  const { sheet, sprite, dx, dy, transform, upright } = layer;
  const modifiers = [transform, upright ? "upright" : undefined].filter(Boolean);
  return {
    className: ["dungeon-tile", `dungeon-tile--${sheet}`, ...modifiers.map((name) => `dungeon-tile--${name}`)].join(" "),
    style:
      `--x:${x};--y:${y};--dx:${dx};--dy:${dy};` +
      `--sx:${sprite.x};--sy:${sprite.y};--sw:${sprite.w};--sh:${sprite.h}`,
  };
}

const NOTHING: readonly RenderedLayer[] = [];

/**
 * Every layer of every tile of the floor, precomputed. About 30,000 tiles for a 40-room
 * floor, done in a few milliseconds when the floor loads.
 */
export function renderFloor(floor: DecodedFloor): (readonly RenderedLayer[])[] {
  const { width } = floor;
  return planFloor(floor).map((layers, index) =>
    layers.length === 0
      ? NOTHING
      : layers.map((layer) => render(layer, index % width, Math.floor(index / width))),
  );
}
