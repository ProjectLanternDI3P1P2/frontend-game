<script setup lang="ts">
/**
 * One sprite cut out of a sheet, enlarged with crisp pixels, for the asset catalogue of
 * the UI kit. Animated sprites play their frames the way the viewport does: CSS moves the
 * background along the row, `pitch` source pixels per frame.
 */
import { computed } from "vue";
import type { SpriteRect } from "../tiles/tileset";

const props = withDefaults(
  defineProps<{
    src: string;
    sheet: { width: number; height: number };
    sprite: SpriteRect;
    label?: string;
    /** Screen pixels per source pixel. */
    zoom?: number;
    frames?: number;
    pitch?: number;
    /** Duration of one loop, in seconds. */
    duration?: number;
    flip?: boolean;
  }>(),
  { label: undefined, zoom: 3, frames: 1, pitch: 0, duration: 1, flip: false },
);

const style = computed(() => ({
  "--src": `url("${props.src}")`,
  "--px": `${props.zoom}px`,
  "--sheet-w": props.sheet.width,
  "--sheet-h": props.sheet.height,
  "--sx": props.sprite.x,
  "--sy": props.sprite.y,
  "--sw": props.sprite.w,
  "--sh": props.sprite.h,
  "--frames": props.frames,
  "--pitch": props.pitch,
  "--duration": `${props.duration}s`,
}));

const description = computed(
  () =>
    `${props.label ?? "Sprite"}: ${props.sprite.w} × ${props.sprite.h} px at (${props.sprite.x}, ${props.sprite.y})` +
    (props.frames > 1 ? `, ${props.frames} frames` : ""),
);
</script>

<template>
  <figure class="sprite-swatch" :title="description">
    <div class="sprite-swatch__stage">
      <img
        class="sprite-swatch__sprite"
        :class="{
          'sprite-swatch__sprite--animated': frames > 1,
          'sprite-swatch__sprite--flip': flip,
        }"
        :style="style"
        src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
        :alt="description"
      />
    </div>
    <figcaption v-if="label" class="sprite-swatch__label">{{ label }}</figcaption>
  </figure>
</template>

<style scoped lang="scss">
.sprite-swatch {
  display: grid;
  justify-items: center;
  align-content: start;
  gap: var(--space-1);
  margin: 0;
}

.sprite-swatch__stage {
  display: grid;
  place-items: center;
  min-inline-size: 3rem;
  min-block-size: 3rem;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  // A checkerboard shows where the sprite is transparent.
  background-color: #2a2433;
  background-image:
    linear-gradient(45deg, #332c3d 25%, transparent 25%, transparent 75%, #332c3d 75%),
    linear-gradient(45deg, #332c3d 25%, transparent 25%, transparent 75%, #332c3d 75%);
  background-position:
    0 0,
    8px 8px;
  background-size: 16px 16px;
}

.sprite-swatch__sprite {
  inline-size: calc(var(--sw) * var(--px));
  block-size: calc(var(--sh) * var(--px));
  background-image: var(--src);
  background-repeat: no-repeat;
  background-size: calc(var(--sheet-w) * var(--px)) calc(var(--sheet-h) * var(--px));
  background-position: calc(var(--sx) * var(--px) * -1) calc(var(--sy) * var(--px) * -1);
  image-rendering: pixelated;

  &--flip {
    scale: -1 1;
  }

  &--animated {
    @include bp.motion-safe {
      animation: sprite-swatch-frames var(--duration) steps(var(--frames)) infinite;
    }
  }
}

@keyframes sprite-swatch-frames {
  from {
    background-position-x: calc(var(--sx) * var(--px) * -1);
  }

  to {
    background-position-x: calc((var(--sx) + var(--pitch) * var(--frames)) * var(--px) * -1);
  }
}

.sprite-swatch__label {
  max-inline-size: 9rem;
  color: var(--color-text-muted);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  text-align: center;
  overflow-wrap: anywhere;
}
</style>
