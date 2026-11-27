<script setup lang="ts">
/**
 * Pixel-art hero drawn on a canvas from stacked Mana Seed sheets (approach of the
 * character-creator POC). Every layer of a frame is drawn in the same pass, once all the
 * sheets are loaded, so the body, underwear, hair and headwear always show the same frame:
 * they can never drift apart or flash in one by one.
 *
 * Still: "stand, facing down". Animated: "walk, facing down", with the artist's timing.
 * Under `prefers-reduced-motion` only the still frame is drawn.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { heroLayerUrls, type HeroAppearance } from "../appearance";
import type { HeroClassCode } from "../types";

const props = withDefaults(
  defineProps<{
    classCode?: HeroClassCode | null;
    appearance?: Partial<HeroAppearance> | null;
    /** Screen pixels per source pixel: a whole number, so the pixels stay square. */
    scale?: number;
    animated?: boolean;
    label?: string;
  }>(),
  { classCode: null, appearance: null, scale: 1, animated: false, label: "" },
);

const CELL = 64;
/** The figure fits this window of every 64×64 cell. */
const VIEW = { x: 16, y: 8, width: 32, height: 40 } as const;
const STAND = { row: 0, frames: [{ column: 0, ms: 1000 }] };
const WALK = {
  row: 4,
  frames: [0, 1, 2, 3, 4, 5].map((column) => ({ column, ms: 135 })),
};

const canvas = ref<HTMLCanvasElement | null>(null);
const layers = computed(() => heroLayerUrls(props.classCode, props.appearance));
const width = computed(() => VIEW.width * props.scale);
const height = computed(() => VIEW.height * props.scale);

const sheets = new Map<string, Promise<HTMLImageElement>>();

function loadSheet(url: string): Promise<HTMLImageElement> {
  let sheet = sheets.get(url);
  if (!sheet) {
    sheet = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Missing hero sheet: ${url}`));
      image.src = url;
    });
    sheets.set(url, sheet);
  }
  return sheet;
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Bumped on every restart: a frame drawn for an older look is dropped. */
let generation = 0;

const prefersReducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

async function play(): Promise<void> {
  clearTimeout(timer);
  const current = ++generation;
  const context = canvas.value?.getContext("2d");
  if (!context) return;

  let images: HTMLImageElement[];
  try {
    images = await Promise.all(layers.value.map(loadSheet));
  } catch {
    return;
  }
  if (current !== generation) return;

  const animation = props.animated && !prefersReducedMotion() ? WALK : STAND;
  let index = 0;
  const step = () => {
    if (current !== generation) return;
    const frame = animation.frames[index]!;
    const { width: w, height: h } = context.canvas;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, w, h);
    for (const image of images) {
      context.drawImage(
        image,
        frame.column * CELL + VIEW.x,
        animation.row * CELL + VIEW.y,
        VIEW.width,
        VIEW.height,
        0,
        0,
        w,
        h,
      );
    }
    if (animation.frames.length < 2) return;
    timer = setTimeout(() => {
      index = (index + 1) % animation.frames.length;
      step();
    }, frame.ms);
  };
  step();
}

onMounted(() => void play());
// Compared by value: a new appearance object with the same look is not worth a restart.
watch(
  () => JSON.stringify([layers.value, props.animated, props.scale]),
  () => void play(),
  { flush: "post" },
);
onBeforeUnmount(() => {
  generation++;
  clearTimeout(timer);
});
</script>

<template>
  <canvas
    ref="canvas"
    class="hero-sprite"
    :width="width"
    :height="height"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    data-testid="hero-sprite"
    :data-layers="layers.length"
  />
</template>

<style scoped>
.hero-sprite {
  display: block;
  flex: none;
  image-rendering: pixelated;
}
</style>
