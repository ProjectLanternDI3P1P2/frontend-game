<script setup lang="ts">
/**
 * The dungeon, rendered with plain DOM elements (ADR-FE-006).
 *
 * What keeps it fast without a canvas or an engine:
 * - only the tiles inside the camera window exist in the DOM (~400 elements,
 *   whatever the size of the floor), and only revealed ones;
 * - every tile is positioned in world coordinates and keyed by its index, so a
 *   step only creates the row or column entering the view and removes the one
 *   leaving it: the other elements are never touched;
 * - the camera and the tokens move with CSS transforms, composited by the GPU;
 * - sprites, sizes and animations are resolved in CSS from precomputed custom
 *   properties: no JavaScript runs per frame.
 */
import { computed } from "vue";
import type { LoadedFloor } from "../composables/useDungeonFloor";
import { gateOf } from "../dungeonMap";
import { cameraOrigin, type Viewport } from "../dungeonRules";
import { closedGate } from "../tiles/autotile";
import type { Direction, DungeonElement, Position } from "../types";

const props = defineProps<{
  loaded: LoadedFloor;
  hero: Position;
  revealed: Uint8Array;
  /** Bumped whenever `revealed` changes: typed arrays are not reactive. */
  revealVersion: number;
  bump: { direction: Direction; id: number } | null;
  viewport: Viewport;
  /** Opens the gate to the stairs and removes the boss. */
  floorBossDefeated: boolean;
}>();

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

  // One extra row below: its wall faces overflow onto the last visible row.
  for (let y = Math.max(0, top - 1); y <= Math.min(floor.height - 1, top + props.viewport.rows); y++) {
    for (let x = Math.max(0, left - 1); x <= Math.min(floor.width - 1, left + props.viewport.columns); x++) {
      const index = y * floor.width + x;
      if (revealed[index] === 0) continue;
      tiles[index]!.forEach((layer, layerIndex) =>
        layers.push({ key: index * 4 + layerIndex, ...layer }),
      );
    }
  }

  return layers;
});

const visibleElements = computed<DungeonElement[]>(() => {
  const { cells: revealed } = revealedMask.value;
  const { floor } = props.loaded;
  return floor.elements.filter(
    (element) =>
      revealed[element.y * floor.width + element.x] === 1 &&
      !(element.type === "boss" && props.floorBossDefeated),
  );
});

/** The gate of the boss room, drawn closed until the boss falls. */
const gate = computed(() => {
  const { cells: revealed } = revealedMask.value;
  const { floor } = props.loaded;
  const position = gateOf(floor);
  if (!position || props.floorBossDefeated) return null;
  return revealed[position.y * floor.width + position.x] === 1
    ? closedGate(position)
    : null;
});

const worldStyle = computed(
  () => `--camera-x:${camera.value.x};--camera-y:${camera.value.y}`,
);

const tokenStyle = ({ x, y }: Position) => `--x:${x};--y:${y}`;
</script>

<template>
  <div class="dungeon-viewport" :style="`--columns:${viewport.columns};--rows:${viewport.rows}`">
    <div class="dungeon-viewport__world" :style="worldStyle">
      <div v-for="layer in visibleLayers" :key="layer.key" :class="layer.className" :style="layer.style" />

      <div v-if="gate" :class="gate.className" :style="gate.style" />

      <div
        v-for="element in visibleElements"
        :key="`element-${element.id}`"
        :class="['dungeon-token', `dungeon-token--${element.type}`]"
        :style="tokenStyle(element)"
      />

      <div class="dungeon-token dungeon-token--hero" :style="tokenStyle(hero)">
        <span
          :key="bump?.id ?? 0"
          :class="['dungeon-token__body', bump ? `dungeon-token__body--bump-${bump.direction}` : null]"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dungeon-viewport {
  // One source pixel = --px; one tile = --tile. Everything below derives from
  // them, so resizing the view never requires recomputing a tile.
  --tile: 24px;
  --px: calc(var(--tile) / 16);

  position: relative;
  overflow: hidden;
  inline-size: calc(var(--columns) * var(--tile));
  block-size: calc(var(--rows) * var(--tile));
  max-inline-size: 100%;
  // The void of the tileset itself: the outer faces of the walls fade into it.
  background-color: #000f0d;
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);

  @include bp.from(sm) {
    --tile: 32px;
  }

  @include bp.from(lg) {
    --tile: 48px;
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

:deep(.dungeon-tile--tileset) {
  background-image: url("@/assets/dongeon/dungeon-tileset.png");
  background-size: calc(384 * var(--px)) calc(192 * var(--px));
}

:deep(.dungeon-tile--torch) {
  background-image: url("@/assets/dongeon/torch-strip.png");
  background-size: calc(64 * var(--px)) calc(32 * var(--px));

  @include bp.motion-safe {
    animation: dungeon-strip-4 0.6s steps(4) infinite;
  }
}

:deep(.dungeon-tile--fireWall) {
  background-image: url("@/assets/dongeon/fire-wall-strip.png");
  background-size: calc(80 * var(--px)) calc(32 * var(--px));

  @include bp.motion-safe {
    animation: dungeon-strip-5 0.75s steps(5) infinite;
  }
}

:deep(.dungeon-tile--flip-y) {
  transform: scaleY(-1);
}

@keyframes dungeon-strip-4 {
  to {
    background-position-x: calc(64 * var(--px) * -1);
  }
}

@keyframes dungeon-strip-5 {
  to {
    background-position-x: calc(80 * var(--px) * -1);
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

  &::before,
  &__body {
    content: "";
    position: absolute;
    inset: 22%;
    border-radius: 50%;
  }

  &--enemy::before {
    background: radial-gradient(circle at 35% 35%,
        var(--color-danger),
        var(--color-danger-strong));
    box-shadow: var(--shadow-sm);
  }

  &--boss::before {
    inset: 8%;
    background: radial-gradient(circle at 35% 35%,
        var(--color-arcane),
        var(--color-danger-strong));
    box-shadow:
      0 0 0 var(--px) var(--color-accent),
      var(--shadow-md);

    @include bp.motion-safe {
      animation: dungeon-pulse 1.6s ease-in-out infinite;
    }
  }

  &--item::before {
    // The jar of the tileset (163, 91), 9 x 15 source pixels.
    inset: auto;
    left: calc(3.5 * var(--px));
    top: 0;
    inline-size: calc(9 * var(--px));
    block-size: calc(15 * var(--px));
    border-radius: 0;
    background: url("@/assets/dongeon/dungeon-tileset.png") no-repeat;
    background-size: calc(384 * var(--px)) calc(192 * var(--px));
    background-position: calc(163 * var(--px) * -1) calc(91 * var(--px) * -1);
    image-rendering: pixelated;
    filter: drop-shadow(0 0 calc(var(--px) * 2) var(--color-accent));

    @include bp.motion-safe {
      animation: dungeon-float 1.8s ease-in-out infinite;
    }
  }

  &--trap::before {
    // Spikes that rise and retract: 8 frames of 16 x 16 source pixels.
    inset: 0;
    border-radius: 0;
    background: url("@/assets/dongeon/spikes-strip.png") no-repeat;
    background-size: calc(128 * var(--px)) calc(16 * var(--px));
    background-position: calc(48 * var(--px) * -1) 0;
    image-rendering: pixelated;

    @include bp.motion-safe {
      animation: dungeon-spikes 3.24s step-end infinite;
    }
  }

  &--hero {
    z-index: var(--z-content);

    @include bp.motion-safe {
      transition: transform var(--duration-fast) var(--easing-standard);
    }

    &::before {
      content: none;
    }
  }

  &__body {
    inset: 18%;
    background: radial-gradient(circle at 35% 30%,
        var(--color-text-primary),
        var(--color-accent) 45%,
        var(--color-accent-strong));
    box-shadow:
      0 0 0 var(--px) var(--color-surface-base),
      var(--shadow-sm),
      0 0 calc(var(--px) * 10) calc(var(--px) * 2) color-mix(in srgb, var(--color-accent) 35%, transparent);
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

// Frame durations of the original GIF: 60, 60, 60, 1400, 100, 100, 60, 1400 ms.
@keyframes dungeon-spikes {
  0% {
    background-position-x: 0;
  }

  1.85% {
    background-position-x: calc(16 * var(--px) * -1);
  }

  3.7% {
    background-position-x: calc(32 * var(--px) * -1);
  }

  5.56% {
    background-position-x: calc(48 * var(--px) * -1);
  }

  48.77% {
    background-position-x: calc(64 * var(--px) * -1);
  }

  51.85% {
    background-position-x: calc(80 * var(--px) * -1);
  }

  54.94% {
    background-position-x: calc(96 * var(--px) * -1);
  }

  56.79% {
    background-position-x: calc(112 * var(--px) * -1);
  }
}

@keyframes dungeon-pulse {
  50% {
    scale: 1.08;
  }
}

@keyframes dungeon-float {
  50% {
    translate: 0 calc(var(--px) * -2);
  }
}
</style>
