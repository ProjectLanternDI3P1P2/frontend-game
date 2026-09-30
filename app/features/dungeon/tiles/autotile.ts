/**
 * Chooses the sprites of every tile of a floor ("autotiling"). The backend only
 * sends abstract cell types; how a wall looks is a presentation decision.
 *
 * The pack draws walls in three-quarter view:
 * - a wall with an open tile below it is seen from the front: its FACE (bricks)
 *   sits on the wall tile and its top edge, the RIM, on the tile above;
 * - every other wall is seen from above and shows only its rim;
 * - rims form a network: each rim piece (straight, corner, tee, free end) is
 *   chosen from the rim tiles around it, which gives closed corners and clean
 *   junctions between rooms and corridors;
 * - below a wall that closes a room on its south side, the outer face and the
 *   dark foot of the wall hang over the void.
 *
 * Deterministic: variants are picked with a hash of (seed, floor, x, y), never
 * with Math.random, so a replayed seed looks identical. Computed once per floor
 * into plain strings that the template binds as they are.
 */
import type { CellCode, DecodedFloor } from "../dungeonMap";
import { Cell, cellAt } from "../dungeonMap";
import type { SheetName, SpriteRect } from "./tileset";
import {
  DECALS,
  FACES,
  FIRE_WALL,
  FLAGSTONES,
  GATE,
  PROPS,
  RIMS,
  SEWER_GRATE,
  STAIRS,
  TILE_SIZE,
  TORCH,
  WALL_DECORATIONS,
  WORN_FLOORS,
} from "./tileset";

export type SpriteTransform = "flip-y";

export interface TileLayer {
  sheet: SheetName;
  sprite: SpriteRect;
  /** Offset from the tile's top-left corner, in source pixels. */
  dx: number;
  dy: number;
  transform?: SpriteTransform;
}

/** What the template renders: one absolutely positioned element per layer. */
export interface RenderedLayer {
  className: string;
  /** CSS custom properties only: sizes are resolved in CSS from --tile. */
  style: string;
}

/** Per mille, rolled once per eligible tile. */
const CHANCE = {
  wornFloor: 60,
  sewerGrate: 6,
  skull: 12,
  pebble: 30,
  stone: 20,
  fireWall: 35,
  wallDecoration: 120,
  torch: 110,
} as const;

/** 32-bit FNV-1a of the seed and floor: the base of every visual variant. */
export function visualSeed(seed: string, floor: number): number {
  let hash = 0x811c9dc5;
  for (const character of `${seed}#${floor}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193);
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

/** Inside the dungeon: anything a room or a corridor is made of. */
export function isOpen(code: CellCode): boolean {
  return code !== Cell.Void && code !== Cell.Wall;
}

function pick<T>(items: readonly T[], hash: number): T {
  return items[hash % items.length]!;
}

function roll(hash: number, salt: number): number {
  return (Math.imul(hash ^ salt, 0x9e3779b1) >>> 12) % 1000;
}

const tilesetLayer = (sprite: SpriteRect, dx = 0, dy = 0): TileLayer => ({
  sheet: "tileset",
  sprite,
  dx,
  dy,
});

/** Bottom-aligned on its tile, horizontally centred: props stand on the floor. */
const standing = (sprite: SpriteRect): TileLayer =>
  tilesetLayer(sprite, Math.floor((TILE_SIZE - sprite.w) / 2), TILE_SIZE - sprite.h);

type Decoration = { kind: "banner"; index: number } | { kind: "fire" } | { kind: "torch" };

/** Everything the autotiler knows about a floor, computed once. */
class WallPlan {
  readonly face: Uint8Array;
  readonly rim: Uint8Array;
  readonly decorations = new Map<number, Decoration>();

  constructor(
    private readonly floor: DecodedFloor,
    private readonly base: number,
  ) {
    const { width, height } = floor;
    this.face = new Uint8Array(width * height);
    this.rim = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.code(x, y) === Cell.Wall && isOpen(this.code(x, y + 1))) {
          this.face[y * width + x] = 1;
        }
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const code = this.code(x, y);
        if (isOpen(code)) continue;
        const isRim =
          code === Cell.Wall
            ? !this.isFace(x, y)
            : this.isFace(x, y + 1) ||
              (this.code(x, y + 1) === Cell.Wall &&
                (this.isFace(x - 1, y + 1) || this.isFace(x + 1, y + 1)));
        if (isRim) this.rim[y * width + x] = 1;
      }
    }

    this.planDecorations();
  }

  code(x: number, y: number): CellCode {
    return cellAt(this.floor, x, y);
  }

  isFace(x: number, y: number): boolean {
    return this.inside(x, y) && this.face[y * this.floor.width + x] === 1;
  }

  isRim(x: number, y: number): boolean {
    return this.inside(x, y) && this.rim[y * this.floor.width + x] === 1;
  }

  /**
   * How a wall face ends on each side. It ends freely against the void, or
   * against an opening when nothing rises above it; otherwise its rim turns
   * up into the wall standing above the opening.
   */
  faceEnds(x: number, y: number): { left: boolean; right: boolean; joinedAbove: boolean } {
    const joinedAbove = this.isRim(x, y - 2);
    const freeEnd = (dx: number) => {
      const side = this.code(x + dx, y);
      return side === Cell.Void || (isOpen(side) && !joinedAbove);
    };
    const bothOpen = isOpen(this.code(x - 1, y)) && isOpen(this.code(x + 1, y));
    return bothOpen
      ? { left: false, right: false, joinedAbove }
      : { left: freeEnd(-1), right: freeEnd(1), joinedAbove };
  }

  rimSprite(x: number, y: number): SpriteRect {
    const n = this.isRim(x, y - 1);
    const s = this.isRim(x, y + 1);
    const e = this.isRim(x + 1, y);
    const w = this.isRim(x - 1, y);

    if (this.isFace(x, y + 1)) {
      const ends = this.faceEnds(x, y + 1);
      if (ends.left && !ends.right) return RIMS.leftEnd;
      if (ends.right && !ends.left) return RIMS.rightEnd;
      if (ends.left && ends.right) return RIMS.horizontal;

      const openLeft = isOpen(this.code(x - 1, y + 1));
      const openRight = isOpen(this.code(x + 1, y + 1));
      if (openLeft && openRight) return n ? RIMS.vertical : RIMS.horizontal;
      if (n && (openLeft || (e && !w))) return RIMS.cornerUpRight;
      if (n && (openRight || (w && !e))) return RIMS.cornerUpLeft;
      return RIMS.horizontal;
    }

    if (e && w) return s ? RIMS.teeDown : RIMS.horizontal;
    if (e && s) return RIMS.cornerDownRight;
    if (w && s) return RIMS.cornerDownLeft;
    if (e && n) return RIMS.cornerUpRight;
    if (w && n) return RIMS.cornerUpLeft;
    if (n || s) return RIMS.vertical;
    return RIMS.horizontal;
  }

  /** A face that can carry a decoration: a plain stretch of wall, not an end. */
  private canDecorate(x: number, y: number): boolean {
    if (!this.isFace(x, y) || isOpen(this.code(x, y - 1))) return false;
    if (!this.isFace(x - 1, y) || !this.isFace(x + 1, y)) return false;
    const ends = this.faceEnds(x, y);
    return !ends.left && !ends.right && this.rimSprite(x, y - 1) === RIMS.horizontal;
  }

  private planDecorations(): void {
    const { width, height } = this.floor;
    for (let y = 0; y < height; y++) {
      let previousDecorated = false;
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (this.decorations.has(index) || previousDecorated || !this.canDecorate(x, y)) {
          previousDecorated = this.decorations.has(index);
          continue;
        }

        const hash = tileHash(this.base, x, y);
        let chance = roll(hash, 1);
        previousDecorated = true;

        if (chance < CHANCE.fireWall) {
          this.decorations.set(index, { kind: "fire" });
          continue;
        }
        chance -= CHANCE.fireWall;
        if (chance >= 0 && chance < CHANCE.wallDecoration) {
          this.decorations.set(index, { kind: "banner", index: hash % WALL_DECORATIONS.length });
          continue;
        }
        chance -= CHANCE.wallDecoration;
        if (chance >= 0 && chance < CHANCE.torch) {
          this.decorations.set(index, { kind: "torch" });
          continue;
        }
        previousDecorated = false;
      }
    }
  }

  private inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.floor.width && y < this.floor.height;
  }
}

/** Every layer of every tile, before rendering to strings. */
export function planFloor(floor: DecodedFloor): TileLayer[][] {
  const base = visualSeed(floor.seed, floor.floor);
  const plan = new WallPlan(floor, base);
  const { width, height } = floor;
  // Most of a floor is void: its tiles share one empty list.
  const layers: TileLayer[][] = new Array<TileLayer[]>(width * height);
  const flagstoneX = base % 4;
  const flagstoneY = (base >>> 2) % 4;

  const at = (x: number, y: number) => (layers[y * width + x] ??= []);
  const isEmptyVoid = (x: number, y: number) =>
    y < height && plan.code(x, y) === Cell.Void && !plan.isRim(x, y);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const code = plan.code(x, y);
      const index = y * width + x;
      if (code === Cell.Void && !plan.isRim(x, y)) continue;

      const hash = tileHash(base, x, y);
      const cell = at(x, y);

      if (isOpen(code)) {
        cell.push(...floorLayers(code, x, y, hash, flagstoneX, flagstoneY));
        continue;
      }

      const decoration = plan.decorations.get(index);
      const below = plan.decorations.get(index + width);

      if (plan.isRim(x, y)) {
        const sprite =
          below?.kind === "banner"
            ? WALL_DECORATIONS[below.index]!.upper
            : plan.rimSprite(x, y);
        cell.push(tilesetLayer(sprite));

        // A wall closing a room on its south side: its outer face and foot show below.
        const s = plan.isRim(x, y + 1) || plan.isFace(x, y + 1);
        const horizontal = plan.isRim(x - 1, y) || plan.isRim(x + 1, y);
        if (!s && horizontal && isEmptyVoid(x, y + 1)) {
          if (isEmptyVoid(x, y + 2)) {
            at(x, y + 1).push(tilesetLayer(FACES.outer));
            at(x, y + 2).push(tilesetLayer(FACES.foot));
          } else {
            at(x, y + 1).push(tilesetLayer(FACES.foot));
          }
        }
      }

      if (plan.isFace(x, y)) {
        cell.push(...faceLayers(plan, x, y, hash, decoration));
      }
    }
  }

  const empty: TileLayer[] = [];
  for (let index = 0; index < layers.length; index++) layers[index] ??= empty;
  return layers;
}

function floorLayers(
  code: CellCode,
  x: number,
  y: number,
  hash: number,
  flagstoneX: number,
  flagstoneY: number,
): TileLayer[] {
  if (code === Cell.StairsDown || code === Cell.StairsUp) {
    const stairs = tilesetLayer(STAIRS);
    return [code === Cell.StairsUp ? { ...stairs, transform: "flip-y" } : stairs];
  }

  if (code === Cell.Grate) return [tilesetLayer(SEWER_GRATE)];

  let ground = FLAGSTONES[(y + flagstoneY) % 4]![(x + flagstoneX) % 4]!;
  const isPlain = ground.x === 16 && ground.y === 0;
  if (code === Cell.Floor && roll(hash, 2) < CHANCE.sewerGrate) ground = SEWER_GRATE;
  else if (isPlain && roll(hash, 3) < CHANCE.wornFloor) ground = pick(WORN_FLOORS, hash >>> 5);

  const layers = [tilesetLayer(ground)];

  switch (code) {
    case Cell.Obstacle:
      layers.push(standing(pick(PROPS.obstacles, hash >>> 8)));
      break;
    case Cell.Pillar:
      layers.push(standing(roll(hash, 4) < 700 ? PROPS.pillars[0] : pick(PROPS.pillars, hash >>> 9)));
      break;
    case Cell.Fence:
      layers.push(standing(PROPS.fence));
      break;
    case Cell.Floor:
      layers.push(...litter(hash));
      break;
    default:
      break;
  }

  return layers;
}

/** Bones, pebbles and small stones: never on a door, never blocking. */
function litter(hash: number): TileLayer[] {
  const jitter = (salt: number) => ((hash >>> salt) % 7) - 3;
  const centred = (sprite: SpriteRect) =>
    tilesetLayer(
      sprite,
      Math.floor((TILE_SIZE - sprite.w) / 2) + jitter(3),
      Math.floor((TILE_SIZE - sprite.h) / 2) + jitter(6),
    );

  const chance = roll(hash, 5);
  let threshold = CHANCE.skull;
  if (chance < threshold) return [centred(DECALS[0]!)];
  threshold += CHANCE.pebble;
  if (chance < threshold) return [centred(DECALS[1]!)];
  threshold += CHANCE.stone;
  if (chance < threshold) return [centred(DECALS[2]!)];
  return [];
}

function faceLayers(
  plan: WallPlan,
  x: number,
  y: number,
  hash: number,
  decoration: Decoration | undefined,
): TileLayer[] {
  // A wall between two open tiles is too thin for a face: only its rim shows.
  if (isOpen(plan.code(x, y - 1))) {
    const ends = plan.faceEnds(x, y);
    return [
      tilesetLayer(
        ends.left && !ends.right ? RIMS.leftEnd : ends.right && !ends.left ? RIMS.rightEnd : RIMS.horizontal,
      ),
    ];
  }

  const ends = plan.faceEnds(x, y);
  if (ends.left && !ends.right) return [tilesetLayer(FACES.leftEnd)];
  if (ends.right && !ends.left) return [tilesetLayer(FACES.rightEnd)];

  const plain = tilesetLayer(pick(FACES.plain, hash >>> 4));
  switch (decoration?.kind) {
    case "banner":
      return [tilesetLayer(WALL_DECORATIONS[decoration.index]!.lower)];
    case "fire":
      return [plain, { sheet: "fireWall", sprite: FIRE_WALL, dx: 0, dy: -TILE_SIZE }];
    case "torch":
      return [plain, { sheet: "torch", sprite: TORCH, dx: 0, dy: -TILE_SIZE }];
    default:
      return [plain];
  }
}

function render(layer: TileLayer, x: number, y: number): RenderedLayer {
  const { sheet, sprite, dx, dy, transform } = layer;
  return {
    className: transform
      ? `dungeon-tile dungeon-tile--${sheet} dungeon-tile--${transform}`
      : `dungeon-tile dungeon-tile--${sheet}`,
    style:
      `--x:${x};--y:${y};--dx:${dx};--dy:${dy};` +
      `--sx:${sprite.x};--sy:${sprite.y};--sw:${sprite.w};--sh:${sprite.h}`,
  };
}

const NOTHING: readonly RenderedLayer[] = [];

/**
 * The closed gate of a boss room, drawn over its doorway and the wall around it. Not part
 * of the precomputed floor: it depends on the run, and disappears once the boss falls.
 */
export function closedGate({ x, y }: { x: number; y: number }): RenderedLayer {
  return render(tilesetLayer(GATE, -TILE_SIZE, -TILE_SIZE), x, y);
}

/**
 * Every layer of every tile of the floor, precomputed. About 30,000 tiles for
 * a 40-room floor, done in about 10 ms when the floor loads.
 */
export function renderFloor(floor: DecodedFloor): (readonly RenderedLayer[])[] {
  const { width } = floor;
  return planFloor(floor).map((layers, index) =>
    layers.length === 0
      ? NOTHING
      : layers.map((layer) => render(layer, index % width, Math.floor(index / width))),
  );
}
