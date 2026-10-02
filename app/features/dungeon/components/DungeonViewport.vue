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
import { gateOf } from "../dungeonMap";
import { cameraOrigin, type Viewport } from "../dungeonRules";
import { MAX_LAYERS } from "../tiles/autotile";
import {
  BOSS,
  ENEMY,
  HERO_SHEET,
  TRAP,
  gateSprite,
  heroFacesWest,
  heroSprite,
  itemSprite,
  spriteStyle,
  type AnimatedSprite,
} from "../tiles/sprites";
import { SHEETS, themeOf } from "../tiles/tileset";
import type { Direction, DungeonElement, Position } from "../types";

const props = defineProps<{
  loaded: LoadedFloor;
  hero: Position;
  /** Where the hero last tried to go: it faces that way. */
  facing: Direction;
  revealed: Uint8Array;
  /** Bumped whenever `revealed` changes: typed arrays are not reactive. */
  revealVersion: number;
  bump: { direction: Direction; id: number } | null;
  /** Tiles in view, and the size of a tile in CSS pixels (see `fitViewport`). */
  viewport: Viewport & { tile: number };
  /** Opens the gate down and removes the boss. */
  floorBossDefeated: boolean;
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
        !(element.type === "boss" && props.floorBossDefeated),
    )
    .map((element) => {
      const sprite = spriteOf(element);
      return {
        key: `element-${element.id}`,
        className: `dungeon-sprite dungeon-sprite--${sprite.sheet} dungeon-element dungeon-element--${element.type}`,
        // Mobs float out of step with one another.
        style: `${spriteStyle(sprite, element)};--delay:-${((element.id * 0.37) % 1.6).toFixed(2)}s`,
      };
    });
});

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

/** Running while the hero moves, standing idle otherwise. */
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

const facesWest = ref(heroFacesWest(props.facing, false));
watch(
  () => props.facing,
  (facing) => (facesWest.value = heroFacesWest(facing, facesWest.value)),
);

const heroStyle = computed(() =>
  spriteStyle(heroSprite(isWalking.value ? "run" : "idle"), { x: 0, y: 0 }),
);

const viewportStyle = computed(() => {
  const { columns, rows, tile } = props.viewport;
  return (
    `--columns:${columns};--rows:${rows};--tile:${tile}px;` +
    `--atlas-width:${SHEETS.atlas.width};--atlas-height:${SHEETS.atlas.height};` +
    `--hero-width:${HERO_SHEET.width};--hero-height:${HERO_SHEET.height}`
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

      <div class="dungeon-token dungeon-token--hero" :style="tokenStyle(hero)">
        <span
          :key="bump?.id ?? 0"
          :class="['dungeon-token__body', bump ? `dungeon-token__body--bump-${bump.direction}` : null]"
        >
          <!-- Keyed by pose: a new pose starts on its first frame. -->
          <span
            :key="isWalking ? 'run' : 'idle'"
            :class="['dungeon-sprite', 'dungeon-sprite--hero', 'dungeon-hero', { 'dungeon-hero--west': facesWest }]"
            :style="heroStyle"
          />
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
      transition: transform var(--duration-fast) var(--easing-standard);
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

  &--hero {
    background-image: url("@/assets/heroes/swordsman/hero_swordsman_spritesheet.png");
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

// In depth order with the furniture (see `.dungeon-tile--upright`).
.dungeon-element {
  z-index: calc(2 * var(--y) + 3);
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

// The hero idles on the spot and runs between tiles (see `heroSprite`). Its sheet faces
// east: it is mirrored, in place, to face west.
.dungeon-hero {
  translate: calc(var(--dx) * var(--px)) calc(var(--dy) * var(--px));
  filter: drop-shadow(0 calc(var(--px) * 1) 0 rgb(0 0 0 / 35%));

  &--west {
    scale: -1 1;
  }
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
      transition: transform var(--duration-fast) var(--easing-standard);
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
