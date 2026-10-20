<script setup lang="ts">
/**
 * The dungeon, rendered with plain DOM elements (ADR-FE-006).
 *
 * What keeps it fast without a canvas or an engine:
 * - only the tiles inside the camera window exist in the DOM (a few hundred elements,
 *   whatever the size of the floor), and only revealed ones;
 * - every tile is positioned in world coordinates and keyed by its index, so a
 *   step only creates the row or column entering the view and removes the one
 *   leaving it: the other elements are never touched;
 * - the camera and the tokens move with CSS transforms, composited by the GPU;
 * - sprites, sizes and animations are resolved in CSS from precomputed custom
 *   properties: no JavaScript runs per frame.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { LoadedFloor } from "../composables/useDungeonFloor";
import { gateOf, revealedTeleports } from "../dungeonMap";
import { MOB_DEATH_MS, MOVE_COOLDOWN_MS, cameraOrigin, type Viewport } from "../dungeonRules";
import { MAX_LAYERS } from "../tiles/autotile";
import { HERO_SHEET, heroLayers, heroSprite, type HeroAppearance } from "../tiles/hero";
import {
  BOSS,
  ENEMY,
  TRAP,
  gateSprite,
  itemSprite,
  mobClassName,
  spriteStyle,
  type AnimatedSprite,
} from "../tiles/sprites";
import { SHEETS, themeOf } from "../tiles/tileset";
import type { Direction, DungeonElement, MobState, Position } from "../types";

const props = defineProps<{
  loaded: LoadedFloor;
  hero: Position;
  /** Where the hero last tried to go: it faces that way. */
  facing: Direction;
  /** What the hero looks like: its body, clothes, hair, weapon and shield. */
  appearance: HeroAppearance;
  revealed: Uint8Array;
  /** Bumped whenever `revealed` changes: typed arrays are not reactive. */
  revealVersion: number;
  bump: { direction: Direction; id: number } | null;
  /** Tiles in view, and the size of a tile in CSS pixels (see `fitViewport`). */
  viewport: Viewport & { tile: number };
  /** Opens the gate down and removes the boss. */
  floorBossDefeated: boolean;
  /** The living mobs, where the server last saw them. */
  mobs: MobState[];
  /** Mobs just killed, fading out where they fell. */
  dyingMobs: MobState[];
}>();

const theme = computed(() => themeOf(props.loaded.floor.floor));

const camera = computed(() =>
  cameraOrigin(props.loaded.floor, props.hero, props.viewport),
);

/**
 * `revealed` is mutated in place, so reading it is not tracked: the computed
 * values below read it through this wrapper, which changes with `revealVersion`.
 */
const revealedMask = computed(() => ({ version: props.revealVersion, cells: props.revealed }));

interface VisibleLayer {
  key: number;
  className: string;
  style: string;
}

const visibleLayers = computed<VisibleLayer[]>(() => {
  const { cells: revealed } = revealedMask.value;
  const { floor, tiles } = props.loaded;
  const { x: left, y: top } = camera.value;
  const layers: VisibleLayer[] = [];

  // Extra rows around the view: wall faces, columns and banners overflow their tile.
  const firstRow = Math.max(0, top - 1);
  const lastRow = Math.min(floor.height - 1, top + props.viewport.rows + 3);
  const firstColumn = Math.max(0, left - 2);
  const lastColumn = Math.min(floor.width - 1, left + props.viewport.columns + 1);

  // Two passes: the ground of every tile first, then what stands on it or hangs over it,
  // so that a banner or a cobweb wider than its tile is never covered by the next tile.
  for (const isGround of [true, false]) {
    for (let y = firstRow; y <= lastRow; y++) {
      for (let x = firstColumn; x <= lastColumn; x++) {
        const index = y * floor.width + x;
        if (revealed[index] === 0) continue;
        tiles[index]!.forEach((layer, layerIndex) => {
          if ((layerIndex === 0) === isGround) {
            layers.push({ key: index * MAX_LAYERS + layerIndex, ...layer });
          }
        });
      }
    }
  }

  return layers;
});

interface VisibleSprite {
  key: string;
  className: string;
  style: string;
}

function spriteOf(element: DungeonElement): AnimatedSprite {
  switch (element.type) {
    case "enemy":
      return ENEMY;
    case "boss":
      return BOSS;
    case "item":
      return itemSprite(element.id);
    case "trap":
      return TRAP;
  }
}

const visibleElements = computed<VisibleSprite[]>(() => {
  const { cells: revealed } = revealedMask.value;
  const { floor } = props.loaded;
  return floor.elements
    .filter(
      (element) =>
        revealed[element.y * floor.width + element.x] === 1 &&
        // Enemies only give the spawn tiles: the mobs of the run are drawn below.
        element.type !== "enemy" &&
        !(element.type === "boss" && props.floorBossDefeated),
    )
    .map((element) => {
      const sprite = spriteOf(element);
      return {
        key: `element-${element.id}`,
        className: `dungeon-sprite dungeon-sprite--${sprite.sheet} dungeon-element dungeon-element--${element.type}${element.kind ? ` dungeon-element--${element.kind}` : ""}`,
        // Mobs float out of step with one another.
        style: `${spriteStyle(sprite, element)};--delay:-${((element.id * 0.37) % 1.6).toFixed(2)}s`,
      };
    });
});

/** The mobs on revealed tiles, keyed by id so that a move slides the same sprite. */
const visibleMobs = computed<VisibleSprite[]>(() => {
  const { cells: revealed } = revealedMask.value;
  const { floor } = props.loaded;
  const dying = new Set(props.dyingMobs.map((mob) => mob.id));
  return [...props.mobs, ...props.dyingMobs]
    .filter((mob) => revealed[mob.y * floor.width + mob.x] === 1)
    .map((mob) => ({
      // Same key alive and dying: the sprite stays where it fell and fades out.
      key: `mob-${mob.id}`,
      className: `${mobClassName(mob)}${dying.has(mob.id) ? " dungeon-mob--dying" : ""}`,
      style: `${spriteStyle(ENEMY, mob)};--delay:-${((mob.id * 0.37) % 1.6).toFixed(2)}s`,
    }));
});

/** Where the mages will land, announced a turn ahead. */
const teleports = computed(() =>
  revealedTeleports(props.mobs, revealedMask.value.cells, props.loaded.floor.width).map(
    ({ id, x, y }) => ({ key: `teleport-${id}`, style: `--x:${x};--y:${y}` }),
  ),
);

/**
 * The portcullis of the gate down, drawn over its wall: closed until the boss falls, then
 * rising.
 */
const doors = computed(() => {
  const { cells: revealed } = revealedMask.value;
  const { floor } = props.loaded;
  const sprite = gateSprite(theme.value);
  const isRevealed = ({ x, y }: Position) => revealed[y * floor.width + x] === 1;

  const arches: { key: string; className: unknown[]; style: string }[] = [];
  const gate = gateOf(floor);
  if (gate && isRevealed(gate)) {
    arches.push({
      key: "gate",
      className: [
        "dungeon-sprite",
        "dungeon-sprite--objects",
        "dungeon-door",
        { "dungeon-door--opening": props.floorBossDefeated },
      ],
      style: spriteStyle(sprite, gate),
    });
  }
  return arches;
});

/** Shuffling while the hero moves, on guard otherwise. */
const isWalking = ref(false);
let walkTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => [props.hero.x, props.hero.y],
  () => {
    isWalking.value = true;
    clearTimeout(walkTimer);
    walkTimer = setTimeout(() => (isWalking.value = false), 280);
  },
);
onBeforeUnmount(() => clearTimeout(walkTimer));

const heroStyle = computed(() =>
  spriteStyle(heroSprite(isWalking.value ? "move" : "idle", props.facing), { x: 0, y: 0 }),
);

/** The paper doll: one sheet per layer, stacked by depth for the way the hero faces. */
const heroLayerStyles = computed(() =>
  heroLayers(props.appearance, props.facing).map(({ slot, sheet, depth }) => ({
    key: slot,
    style: `background-image:url("${sheet}");z-index:${depth}`,
  })),
);

const viewportStyle = computed(() => {
  const { columns, rows, tile } = props.viewport;
  return (
    `--columns:${columns};--rows:${rows};--tile:${tile}px;` +
    `--atlas-width:${SHEETS.atlas.width};--atlas-height:${SHEETS.atlas.height};` +
    `--hero-width:${HERO_SHEET.width};--hero-height:${HERO_SHEET.height};` +
    `--slide:${MOVE_COOLDOWN_MS}ms;--death:${MOB_DEATH_MS}ms`
  );
});

const worldStyle = computed(
  () => `--camera-x:${camera.value.x};--camera-y:${camera.value.y}`,
);

const tokenStyle = ({ x, y }: Position) => `--x:${x};--y:${y}`;
</script>

<template>
  <div :class="['dungeon-viewport', `dungeon-viewport--${theme}`]" :style="viewportStyle">
    <div class="dungeon-viewport__world" :style="worldStyle">
      <div v-for="layer in visibleLayers" :key="layer.key" :class="layer.className" :style="layer.style" />

      <div v-for="door in doors" :key="door.key" :class="door.className" :style="door.style" />

      <div
        v-for="element in visibleElements"
        :key="element.key"
        :class="element.className"
        :style="element.style"
      />

      <div v-for="mark in teleports" :key="mark.key" class="dungeon-teleport" :style="mark.style">
        <!-- 1–8 spiral in, 9–12 rise (see `.dungeon-teleport__mote`). -->
        <span v-for="i in 12" :key="i" class="dungeon-teleport__mote" :style="{ '--i': i }" />
      </div>

      <div v-for="mob in visibleMobs" :key="mob.key" :class="mob.className" :style="mob.style" />

      <div class="dungeon-token dungeon-token--hero" :style="tokenStyle(hero)">
        <span
          :key="bump?.id ?? 0"
          :class="['dungeon-token__body', bump ? `dungeon-token__body--bump-${bump.direction}` : null]"
        >
          <!-- Keyed by pose: a new pose starts every layer on its first frame, in step. -->
          <span :key="isWalking ? 'move' : 'idle'" class="dungeon-hero" :style="heroStyle">
            <span
              v-for="layer in heroLayerStyles"
              :key="layer.key"
              class="dungeon-sprite dungeon-sprite--hero"
              :style="layer.style"
            />
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dungeon-viewport {
  // One source pixel = --px; one tile = --tile (set from `viewport.tile`).
  // Everything below derives from them, so resizing the view never requires
  // recomputing a tile.
  --px: calc(var(--tile) / 16);
  --atlas: url("@/assets/dongeon/atlas-violet.png");

  // Centred on its container, which it overflows by less than a tile: the
  // centre tile, where the hero stands, is the centre of the screen.
  position: absolute;
  left: 50%;
  top: 50%;
  overflow: hidden;
  inline-size: calc(var(--columns) * var(--tile));
  block-size: calc(var(--rows) * var(--tile));
  translate: -50% -50%;

  // One look per floor (see `themeOf`): the atlases share one layout.
  &--stone {
    --atlas: url("@/assets/dongeon/atlas-stone.png");
  }

  &__world {
    position: absolute;
    inset: 0;
    transform: translate3d(calc(var(--camera-x) * var(--tile) * -1),
        calc(var(--camera-y) * var(--tile) * -1),
        0);
    will-change: transform;

    @include bp.motion-safe {
      transition: transform var(--slide) ease-in-out;
    }
  }
}

:deep(.dungeon-tile) {
  position: absolute;
  left: calc(var(--x) * var(--tile) + var(--dx) * var(--px));
  top: calc(var(--y) * var(--tile) + var(--dy) * var(--px));
  inline-size: calc(var(--sw) * var(--px));
  block-size: calc(var(--sh) * var(--px));
  background-position: calc(var(--sx) * var(--px) * -1) calc(var(--sy) * var(--px) * -1);
  background-repeat: no-repeat;
  image-rendering: pixelated;
}

:deep(.dungeon-tile--atlas) {
  background-image: var(--atlas);
  background-size: calc(var(--atlas-width) * var(--px)) calc(var(--atlas-height) * var(--px));
}

:deep(.dungeon-tile--props) {
  background-image: url("@/assets/dongeon/props.png");
  background-size: calc(384 * var(--px)) calc(256 * var(--px));
}

:deep(.dungeon-tile--objects) {
  background-image: url("@/assets/dongeon/objects.png");
  background-size: calc(320 * var(--px)) calc(480 * var(--px));
}

// Water and lava ripple: three frames, 32 source pixels apart (see `LIQUID`). Lava, thicker,
// moves slower.
:deep(.dungeon-tile--water),
:deep(.dungeon-tile--lava) {
  background-image: url("@/assets/dongeon/liquids.png");
  background-size: calc(96 * var(--px)) calc(64 * var(--px));

  @include bp.motion-safe {
    animation: dungeon-liquid 1.2s steps(3) infinite;
  }
}

:deep(.dungeon-tile--lava) {
  @include bp.motion-safe {
    animation-duration: 2.1s;
  }
}

@keyframes dungeon-liquid {
  from {
    background-position-x: calc(var(--sx) * var(--px) * -1);
  }

  to {
    background-position-x: calc((var(--sx) + 96) * var(--px) * -1);
  }
}

// Depth: what stands on a tile is drawn in front of what stands on the rows behind it,
// so that the hero passing behind a column is hidden by it. Rows count twice: on one
// row, the hero and the mobs stand in front of the furniture.
:deep(.dungeon-tile--upright) {
  z-index: calc(2 * var(--y) + 2);
}

// The walls hide the hero, the mobs and the furniture behind them or beside them, whose
// sprites overflow their tile: nothing sticks out over the walls of a corridor (see
// `TileLayer.wall`). The lower half of a face hides what stands on its row; the upper half
// and the top of a wall, what stands on their row and the row below, still the wall's.
// What stands in front of the wall is drawn over it.
:deep(.dungeon-tile--wall-face) {
  z-index: calc(2 * var(--y) + 4);
}

:deep(.dungeon-tile--wall-top) {
  z-index: calc(2 * var(--y) + 6);
}

:deep(.dungeon-tile--torch) {
  background-image: url("@/assets/dongeon/objects.png");
  background-size: calc(320 * var(--px)) calc(480 * var(--px));

  // Five frames, 32 source pixels apart.
  @include bp.motion-safe {
    animation: dungeon-torch 0.7s steps(5) infinite;
  }
}

:deep(.dungeon-tile--flip-x) {
  transform: scaleX(-1);
}

@keyframes dungeon-torch {
  to {
    background-position-x: calc((var(--sx) + 160) * var(--px) * -1);
  }
}

// Animated sprites (see `tiles/sprites.ts`): a window on the first frame, moved along
// the row of frames.
.dungeon-sprite {
  position: absolute;
  left: 0;
  top: 0;
  inline-size: calc(var(--sw) * var(--px) * var(--scale));
  block-size: calc(var(--sh) * var(--px) * var(--scale));
  background-repeat: no-repeat;
  background-position:
    calc(var(--sx) * var(--px) * var(--scale) * -1) calc(var(--sy) * var(--px) * var(--scale) * -1);
  image-rendering: pixelated;
  pointer-events: none;

  &--objects {
    background-image: url("@/assets/dongeon/objects.png");
    background-size: calc(320 * var(--px) * var(--scale)) calc(480 * var(--px) * var(--scale));
  }

  &--mob {
    background-image: url("@/assets/dongeon/placeholder_mob.png");
    background-size: calc(32 * var(--px) * var(--scale)) calc(32 * var(--px) * var(--scale));
  }

  // The image of each layer is set by the viewport (see `heroLayers`).
  &--hero {
    background-size:
      calc(var(--hero-width) * var(--px) * var(--scale)) calc(var(--hero-height) * var(--px) * var(--scale));
  }

  @include bp.motion-safe {
    animation: dungeon-frames var(--duration) steps(var(--frames)) infinite;
  }
}

// The first frame is explicit: without it, a sprite whose background position is set
// elsewhere would animate from there, and steps() would land between two frames.
@keyframes dungeon-frames {
  from {
    background-position-x: calc(var(--sx) * var(--px) * var(--scale) * -1);
  }

  to {
    background-position-x: calc((var(--sx) + var(--pitch) * var(--frames)) * var(--px) * var(--scale) * -1);
  }
}

// Elements and the gate stand on their tile, offset by (--dx, --dy).
.dungeon-element,
.dungeon-door {
  transform: translate3d(calc(var(--x) * var(--tile) + var(--dx) * var(--px)),
      calc(var(--y) * var(--tile) + var(--dy) * var(--px)),
      0);
}

// The gate is set in its wall: over the faces and the top beside it (see
// `.dungeon-tile--wall-face`), under what stands in front of it.
.dungeon-door {
  z-index: calc(2 * var(--y) + 5);
}

// In depth order with the furniture (see `.dungeon-tile--upright`).
.dungeon-element {
  z-index: calc(2 * var(--y) + 3);
}

// Once in aggro, a mob glows red and its glow throbs: it hunts the party. Two classes, so
// that it wins over the hover animation of `.dungeon-element--enemy` below.
@property --mob-glow-size {
  syntax: "<length>";
  inherits: true;
  initial-value: 0px;
}

.dungeon-mob.dungeon-mob--aggro {
  --mob-glow: rgb(255 70 70 / 95%);
  --mob-glow-size: calc(var(--px) * 3);

  @include bp.motion-safe {
    animation:
      dungeon-hover 1.6s ease-in-out var(--delay, 0s) infinite,
      dungeon-aggro-glow 0.7s ease-in-out infinite alternate;
  }
}

@keyframes dungeon-aggro-glow {
  to {
    --mob-glow-size: calc(var(--px) * 6);
  }
}

// A killed mob first slides to the tile it fell on (the transition of `.dungeon-mob`), then
// flashes white, rises and fades out. No `scale` here nor
// on any sprite placed by `transform`: `scale` applies before `transform`, so it would
// shrink the tile offset too and drag the sprite toward the top-left corner of the floor.
.dungeon-mob.dungeon-mob--dying {
  animation: dungeon-mob-death var(--death) ease-in var(--slide) forwards;
}

@keyframes dungeon-mob-death {
  20% {
    opacity: 1;
    filter: brightness(6) drop-shadow(0 0 calc(var(--px) * 6) rgb(255 255 255 / 95%));
  }

  to {
    opacity: 0;
    translate: 0 calc(var(--px) * -10);
  }
}

// A mob slides from one tile to the next between turns, as the hero does; a mage jumps.
.dungeon-mob {
  @include bp.motion-safe {
    transition: transform var(--slide) ease-in-out;
  }
}

.dungeon-element--mage {
  transition: none;
}

// The tile a mage announced: a bright violet glow, larger than its tile, drawn over the
// mobs so that it reads at a glance.
.dungeon-teleport {
  position: absolute;
  left: 0;
  top: 0;
  inline-size: calc(var(--tile) * 1.5);
  block-size: calc(var(--tile) * 1.5);
  transform: translate3d(
    calc((var(--x) - 0.25) * var(--tile)),
    calc((var(--y) - 0.25) * var(--tile)),
    0
  );
  z-index: calc(2 * var(--y) + 4);
  border-radius: 50%;
  background: radial-gradient(
    closest-side,
    rgb(255 255 255 / 95%),
    rgb(214 150 255 / 90%) 30%,
    rgb(160 70 255 / 55%) 60%,
    transparent
  );
  mix-blend-mode: screen;
  pointer-events: none;

  // A slow breath of light and motes of magic: eight spiral into the tile, gathering for
  // the jump, four rise from it.
  @include bp.motion-safe {
    animation: dungeon-teleport-pulse 1.2s ease-in-out infinite alternate;
  }

  // Pixel squares, centred on the tile; hidden without motion, where they would only
  // be dots.
  &__mote {
    position: absolute;
    left: 50%;
    top: 50%;
    inline-size: calc(var(--px) * 1.5);
    block-size: calc(var(--px) * 1.5);
    margin: calc(var(--px) * -0.75);
    background: rgb(230 190 255);
    box-shadow: 0 0 calc(var(--px) * 2) calc(var(--px) * 0.5) rgb(170 90 255 / 90%);
    opacity: 0;

    &:nth-child(odd) {
      background: rgb(255 255 255);
    }

    @include bp.motion-safe {
      animation: dungeon-teleport-gather 1.6s ease-in calc(var(--i) * -0.2s) infinite;

      &:nth-child(n + 9) {
        animation: dungeon-teleport-rise 1.4s ease-out calc(var(--i) * -0.37s) infinite;
      }
    }
  }
}

@keyframes dungeon-teleport-gather {
  from {
    transform: rotate(calc(var(--i) * 45deg)) translateX(calc(var(--tile) * 0.85)) scale(1.3);
  }

  25% {
    opacity: 1;
  }

  to {
    transform: rotate(calc(var(--i) * 45deg + 200deg)) translateX(0) scale(0.4);
    opacity: 0;
  }
}

// Spread across the tile: --i is 9 to 12, so the offset runs from -1.5 to 1.5 steps.
@keyframes dungeon-teleport-rise {
  from {
    transform: translate(calc((var(--i) - 10.5) * var(--tile) * 0.15), calc(var(--tile) * 0.25));
  }

  30% {
    opacity: 1;
  }

  to {
    transform: translate(calc((var(--i) - 10.5) * var(--tile) * 0.15), calc(var(--tile) * -0.9));
    opacity: 0;
  }
}

@keyframes dungeon-teleport-pulse {
  to {
    opacity: 0.75;
  }
}

// Mobs float: a single still image, bobbing over a shadow that stays on the floor and
// shrinks as they rise. A pale outline keeps the dark placeholder visible on the stones.
.dungeon-element--enemy,
.dungeon-element--boss {
  filter: drop-shadow(0 0 calc(var(--px) * 1) rgb(214 206 255 / 55%));

  &::after {
    content: "";
    position: absolute;
    left: 25%;
    top: calc(35 * var(--px) * var(--scale));
    inline-size: 50%;
    block-size: calc(4 * var(--px) * var(--scale));
    border-radius: 50%;
    background: radial-gradient(closest-side, rgb(0 0 0 / 45%), transparent);
  }

  @include bp.motion-safe {
    animation: dungeon-hover 1.6s ease-in-out var(--delay, 0s) infinite;

    &::after {
      animation: dungeon-hover-shadow 1.6s ease-in-out var(--delay, 0s) infinite;
    }
  }
}

.dungeon-element--boss {
  filter: drop-shadow(0 0 calc(var(--px) * 3) var(--color-danger));
}

// Until each kind has its own sprite, the placeholder is tinted: sepia first, since a hue
// rotation alone leaves a grey image grey. The placeholder is dark navy (luminance below
// 65/255), so it is brightened first, or every tint stays almost black.
// TODO(tech-debt): a tinted placeholder stands in for the mob sprites — give each kind
// its own sprite in spriteOf and drop these filters.
.dungeon-element--zombie,
.dungeon-element--mage,
.dungeon-element--goblin,
.dungeon-element--bat {
  filter: brightness(3) sepia(1) saturate(var(--mob-saturation, 4))
    hue-rotate(var(--mob-hue))
    drop-shadow(0 0 var(--mob-glow-size, calc(var(--px) * 1)) var(--mob-glow, rgb(214 206 255 / 55%)));
}

.dungeon-element--zombie {
  --mob-hue: 60deg;
}

.dungeon-element--mage {
  --mob-hue: 230deg;
}

.dungeon-element--goblin {
  --mob-hue: 10deg;
}

.dungeon-element--bat {
  --mob-hue: 0deg;
  --mob-saturation: 0;
}

@keyframes dungeon-hover {
  50% {
    translate: 0 calc(var(--px) * var(--scale) * -3);
  }
}

// The shadow undoes the rise of its mob, so that it stays on the floor.
@keyframes dungeon-hover-shadow {
  50% {
    translate: 0 calc(var(--px) * var(--scale) * 3);
    scale: 0.7;
  }
}

.dungeon-element--item {
  filter: drop-shadow(0 0 calc(var(--px) * 2) color-mix(in srgb, var(--color-accent) 60%, transparent));
}

// The gate down stays on its first frame, closed, until its boss is defeated; then it
// rises to its last one, open.
.dungeon-door {
  animation: none;

  &--opening {
    background-position-x: calc((var(--sx) + var(--pitch) * 4) * var(--px) * -1);
  }

  &--opening {
    @include bp.motion-safe {
      animation: dungeon-door-open var(--duration) steps(4) backwards;
    }
  }
}

@keyframes dungeon-door-open {
  from {
    background-position-x: calc(var(--sx) * var(--px) * -1);
  }

  to {
    background-position-x: calc((var(--sx) + var(--pitch) * 4) * var(--px) * -1);
  }
}

// The hero stands on guard and shuffles between tiles (see `heroSprite`), its layers
// stacked in one window that casts a single shadow.
.dungeon-hero {
  position: absolute;
  left: 0;
  top: 0;
  inline-size: calc(var(--sw) * var(--px));
  block-size: calc(var(--sh) * var(--px));
  translate: calc(var(--dx) * var(--px)) calc(var(--dy) * var(--px));
  filter: drop-shadow(0 calc(var(--px) * 1) 0 rgb(0 0 0 / 35%));
}

.dungeon-token {
  position: absolute;
  left: 0;
  top: 0;
  inline-size: var(--tile);
  block-size: var(--tile);
  transform: translate3d(calc(var(--x) * var(--tile)),
      calc(var(--y) * var(--tile)),
      0);
  pointer-events: none;

  &--hero {
    // In depth order with the furniture and the mobs (see `.dungeon-tile--upright`).
    z-index: calc(2 * var(--y) + 3);

    @include bp.motion-safe {
      transition: transform var(--slide) ease-in-out;
    }
  }

  &__body {
    position: absolute;
    inset: 0;
  }

  @each $direction, $x, $y in (north, 0, -1), (east, 1, 0), (south, 0, 1), (west, -1, 0) {
    &__body--bump-#{$direction} {
      @include bp.motion-safe {
        animation: dungeon-bump-#{$direction} var(--duration-fast) ease-out;
      }
    }

    @keyframes dungeon-bump-#{$direction} {
      50% {
        translate: calc(var(--px) * #{$x * 3}) calc(var(--px) * #{$y * 3});
      }
    }
  }
}
</style>
