<script setup lang="ts">
/**
 * A hero on the combat board, drawn from the Player team's codes (class + appearance) on
 * the Mana Seed combat page (`pONE2`, the page the dungeon hero uses): facing the monsters
 * (east), on guard, or moving when it runs and strikes. The layers come from the Player
 * catalogue (`heroLayerPieces`, `heroSheetUrl`); this file only adds the class weapon and
 * plays the frames. No image is chosen by path here.
 */
import {
  heroLayerPieces,
  heroSheetUrl,
  type HeroAppearance,
  type HeroPiece,
  type HeroSlot,
} from "~/features/player/appearance";
import type { HeroClassCode } from "~/features/player/types";
import type { Stance } from "../composables/useBattleStage";

const props = withDefaults(
  defineProps<{
    classCode?: HeroClassCode | null;
    appearance?: Partial<HeroAppearance> | null;
    stance?: Stance;
    label?: string;
  }>(),
  { classCode: null, appearance: null, stance: "idle", label: "" },
);

/** The combat page of the art: on guard and moving, a weapon in one hand. */
const PAGE = "pONE2";
const CELL = 64;
/** Row of the sheets facing east, toward the monsters. */
const EAST_ROW = 2;
/** Back to front, facing east: the shield behind, the weapon in front. */
const EAST_ORDER: readonly HeroSlot[] = [
  "shield",
  "body",
  "outfit",
  "hair",
  "hat",
  "weapon",
];

/** What each class fights with (combat look; the Player screens show the hero unarmed). */
const CLASS_GEAR: Record<
  HeroClassCode,
  { weapon: HeroPiece; shield: HeroPiece | null }
> = {
  warrior: {
    weapon: { style: "sw01", variant: 1 },
    shield: { style: "sh01", variant: 1 },
  },
  shaman: { weapon: { style: "mc01", variant: 1 }, shield: null },
  mage: { weapon: { style: "wand", variant: 1 }, shield: null },
};

/** Idle: the first four cells of the row; move: the last four. */
const POSES = {
  idle: { column: 0, frameMs: 200 },
  move: { column: 4, frameMs: 150 },
  strike: { column: 4, frameMs: 75 },
} as const;
const FRAMES = 4;

const canvas = ref<HTMLCanvasElement | null>(null);

const sheets = computed(() => {
  const gear = props.classCode ? CLASS_GEAR[props.classCode] : CLASS_GEAR.warrior;
  const pieces: { slot: HeroSlot; piece: HeroPiece }[] = [
    ...heroLayerPieces(props.classCode, props.appearance),
    { slot: "weapon", piece: gear.weapon },
    ...(gear.shield ? [{ slot: "shield" as const, piece: gear.shield }] : []),
  ];
  return pieces
    .sort((a, b) => EAST_ORDER.indexOf(a.slot) - EAST_ORDER.indexOf(b.slot))
    .map(({ slot, piece }) => heroSheetUrl(PAGE, slot, piece));
});

const pose = computed(() =>
  props.stance === "strike"
    ? POSES.strike
    : props.stance === "run" || props.stance === "dodge"
      ? POSES.move
      : POSES.idle,
);

const cache = new Map<string, Promise<HTMLImageElement>>();
function load(url: string): Promise<HTMLImageElement> {
  let image = cache.get(url);
  if (!image) {
    image = new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Missing hero sheet: ${url}`));
      element.src = url;
    });
    cache.set(url, image);
  }
  return image;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

async function play(): Promise<void> {
  clearTimeout(timer);
  const current = ++generation;
  const context = canvas.value?.getContext("2d");
  if (!context) return;
  let images: HTMLImageElement[];
  try {
    images = await Promise.all(sheets.value.map(load));
  } catch {
    return;
  }
  if (current !== generation) return;

  const { column, frameMs } = pose.value;
  const animated = !reducedMotion() && props.stance !== "down";
  let frame = 0;
  const draw = () => {
    if (current !== generation) return;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, CELL, CELL);
    for (const image of images) {
      context.drawImage(
        image,
        (column + frame) * CELL,
        EAST_ROW * CELL,
        CELL,
        CELL,
        0,
        0,
        CELL,
        CELL,
      );
    }
    if (!animated) return;
    timer = setTimeout(() => {
      frame = (frame + 1) % FRAMES;
      draw();
    }, frameMs);
  };
  draw();
}

onMounted(() => void play());
watch(
  () => JSON.stringify([sheets.value, pose.value, props.stance === "down"]),
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
    class="combat-hero-sprite"
    :width="CELL"
    :height="CELL"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    data-testid="combat-hero-sprite"
  />
</template>

<style scoped>
.combat-hero-sprite {
  display: block;
  image-rendering: pixelated;
}
</style>
