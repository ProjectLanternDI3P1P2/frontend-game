<script setup lang="ts">
/**
 * The battlefield: a dungeon room drawn with the Dungeon feature's tiles (same atlas, same
 * theme per floor), the party on the left and the monsters on the right, as in the art
 * team's mock-up. The scene is 20 x 12 tiles of 16 pixels, stretched to fill its box.
 */
import type { SpriteRect } from "~/features/dungeon/tiles/tileset";
import { BANNERS, FACES, FLOORS, TORCH, rimSprite, themeOf } from "~/features/dungeon/tiles/tileset";
import CombatAtmosphere from "./CombatAtmosphere.vue";
import CombatEffect from "./CombatEffect.vue";
import CombatFilters from "./CombatFilters.vue";
import CombatFighter from "./CombatFighter.vue";
import type { CombatSprite } from "../combatSprites";
import { heroSprite, monsterSprite } from "../combatSprites";
import type { Gauges, PartyTone } from "../combatRules";
import { partyTone } from "../combatRules";
import type { BattleStage, Stance } from "../composables/useBattleStage";
import type { Combatant, FightResponse } from "../types";

const props = defineProps<{
  fight: FightResponse;
  gauges: Record<string, Gauges>;
  stage: BattleStage;
  shownTurnId: string | null;
  /** A hero must pick a command: its marker shows. */
  awaitingCommand: boolean;
  targetIds: string[];
}>();

defineEmits<{ pick: [combatant: Combatant] }>();

const COLUMNS = 20;
const ROWS = 12;
const TILE = 16;

// Feet of each slot, in source pixels: a diagonal column on each side.
const HERO_SLOTS = [
  [88, 82],
  [112, 106],
  [84, 130],
  [116, 150],
];
const MONSTER_SLOTS = [
  [236, 84],
  [210, 110],
  [240, 136],
  [262, 108],
];
const BOSS_SLOT = [234, 128];

// --- Scale: one source pixel on screen -----------------------------------------------------

const root = ref<HTMLElement | null>(null);
const unit = ref(3);
let observer: ResizeObserver | undefined;

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const { width, height } = entry.contentRect;
    unit.value = Math.max(1, Math.max(width / (COLUMNS * TILE), height / (ROWS * TILE)));
  });
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());

// --- Room ---------------------------------------------------------------------------------

interface Tile {
  key: string;
  x: number;
  y: number;
  sprite: SpriteRect;
}

const theme = computed(() => themeOf(props.fight.floor - 1));

/** Deterministic dressing, so the room does not change between two renders. */
const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

const tiles = computed<Tile[]>(() => {
  const result: Tile[] = [];
  const rim = rimSprite("VRIR----");
  for (let x = 0; x < COLUMNS; x++) {
    const column = x % FACES.upper.plain.length;
    const worn = hash(x, 1) % 5 === 0;
    result.push(
      { key: `r${x}`, x, y: 0, sprite: rim },
      {
      key: `u${x}`, x, y: 1,
      sprite: worn ? FACES.upper.worn[hash(x, 2) % FACES.upper.worn.length]! : FACES.upper.plain[column]!,
      },
      {
      key: `l${x}`, x, y: 2,
      sprite: worn ? FACES.lower.worn[hash(x, 3) % FACES.lower.worn.length]! : FACES.lower.plain[column]!,
      },
    );
    for (let y = 3; y < ROWS; y++) {
      const cracked = hash(x, y) % 7 === 0;
      const set = cracked ? FLOORS.cracked : FLOORS.plain;
      result.push({ key: `f${x}-${y}`, x, y, sprite: set[hash(y, x) % set.length]! });
    }
  }
  return result;
});

const banners = [2, 9, 17].map((x, index) => ({ x, sprite: BANNERS[index % BANNERS.length]! }));
const torches = [5, 14];

function rectStyle(sprite: SpriteRect, x: number, y: number): Record<string, string> {
  return {
    "--tx": String(x),
    "--ty": String(y),
    "--sx": String(sprite.x),
    "--sy": String(sprite.y),
    "--sw": String(sprite.w),
    "--sh": String(sprite.h),
  };
}

// --- Fighters -----------------------------------------------------------------------------

const isBossFight = computed(
  () => props.fight.encounter !== "Ordinary" && props.fight.monsters.length === 1,
);

interface Fighter {
  combatant: Combatant;
  sprite: CombatSprite;
  /** Its own place on the board. */
  home: readonly [number, number];
  tone?: PartyTone;
}

function stanceOf(id: string): Stance {
  const hp = props.gauges[id]?.hp;
  return props.stage.stances.value[id] ?? (hp === 0 ? "down" : "idle");
}

const fighters = computed<Fighter[]>(() => [
  ...props.fight.heroes.map((hero, index) => ({
    combatant: hero,
    sprite: heroSprite(stanceOf(hero.combatantId)),
    home: HERO_SLOTS[index % HERO_SLOTS.length]! as [number, number],
    tone: partyTone(index),
  })),
  ...props.fight.monsters.map((monster, index) => ({
    combatant: monster,
    sprite: monsterSprite(monster.spriteKey),
    home: (isBossFight.value
      ? BOSS_SLOT
      : MONSTER_SLOTS[index % MONSTER_SLOTS.length]!) as [number, number],
  })),
]);

const byId = computed(() => new Map(fighters.value.map((f) => [f.combatant.combatantId, f])));

/** Visible width and height of a fighter's drawing, in source pixels. */
function bodyOf(fighter: Fighter): { width: number; height: number } {
  const { sprite } = fighter;
  return {
    width: (sprite.sheet === "hero" ? 20 : sprite.w * 0.6) * sprite.scale,
    height: (sprite.h - sprite.padTop - sprite.padBottom) * sprite.scale,
  };
}

/**
 * Where a fighter's feet are now: at home, in front of the combatant it is striking, or
 * off the left edge when the party flees. Heroes come from the left, monsters from the right.
 */
function standingPoint(fighter: Fighter): [number, number] {
  const placement = props.stage.placements.value[fighter.combatant.combatantId];
  const [homeX, homeY] = fighter.home;
  if (!placement) return [homeX, homeY];
  if ("offScreen" in placement) return [-40, homeY];
  const target = byId.value.get(placement.near);
  if (!target) return [homeX, homeY];
  const [targetX, targetY] = target.home;
  const gap = (bodyOf(target).width + bodyOf(fighter).width) / 2 + 2;
  const side = fighter.combatant.side === "Hero" ? -1 : 1;
  return [targetX + side * gap, targetY + 1];
}

const effects = computed(() =>
  props.stage.effects.value.flatMap((effect) => {
    const target = byId.value.get(effect.targetId);
    if (!target) return [];
    const [x, y] = standingPoint(target);
    const body = bodyOf(target);
    const source = effect.sourceId ? byId.value.get(effect.sourceId) : undefined;
    const from = source ? standingPoint(source) : undefined;
    return [
      {
        ...effect,
        x,
        y: y - body.height / 2,
        floorY: y,
        size: Math.max(body.width, body.height),
        fromX: from ? from[0] + 8 : undefined,
        fromY: from && source ? from[1] - bodyOf(source).height / 2 : undefined,
      },
    ];
  }),
);

/** Flames of the torches, where their light comes from. */
const lights = torches.map((x) => ({ x: x * TILE + 8, y: 18 }));

// A critical hit: the camera punches in on the target for an instant.
const camera = ref<{ x: number; y: number } | null>(null);
let cameraTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => props.stage.punch.value,
  (punch) => {
    const target = punch ? byId.value.get(punch.targetId) : undefined;
    if (!target) return;
    const [x, y] = standingPoint(target);
    camera.value = { x, y: y - bodyOf(target).height / 2 };
    clearTimeout(cameraTimer);
    cameraTimer = setTimeout(() => (camera.value = null), 260);
  },
);

// The party takes a heavy blow: the edges of the screen flash red.
const hurtFlash = ref(0);
watch(
  () => props.stage.flash.value,
  (value) => (hurtFlash.value = value),
);

// A heavy hit shakes the board for a moment.
const shaking = ref(false);
let shakeTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => props.stage.shake.value,
  () => {
    shaking.value = false;
    clearTimeout(shakeTimer);
    requestAnimationFrame(() => {
      shaking.value = true;
      shakeTimer = setTimeout(() => (shaking.value = false), 300);
    });
  },
);
</script>

<template>
  <div
    ref="root"
    class="combat-scene"
    :class="['combat-scene--' + theme, { 'combat-scene--shake': shaking }]"
    :style="{ '--u': `${unit}px` }"
  >
    <CombatFilters />
    <div
      class="combat-scene__camera"
      :class="{ 'combat-scene__camera--punch': camera }"
      :style="camera ? { transformOrigin: `calc(${camera.x} * var(--u)) calc(${camera.y} * var(--u))` } : undefined"
    >
      <div class="combat-scene__room" aria-hidden="true">
        <span
          v-for="tile in tiles"
          :key="tile.key"
          class="combat-scene__piece combat-scene__piece--atlas"
          :style="rectStyle(tile.sprite, tile.x * TILE, tile.y * TILE)"
        />
        <span
          v-for="banner in banners"
          :key="'b' + banner.x"
          class="combat-scene__piece combat-scene__piece--props"
          :style="rectStyle(banner.sprite, banner.x * TILE, TILE + 2)"
        />
        <span
          v-for="x in torches"
          :key="'t' + x"
          class="combat-scene__piece combat-scene__piece--torch"
          :style="rectStyle(TORCH, x * TILE - 8, 4)"
        />
      </div>

      <div class="combat-scene__stage">
        <CombatFighter
          v-for="fighter in fighters"
          :key="fighter.combatant.combatantId"
          :combatant="fighter.combatant"
          :sprite="fighter.sprite"
          :hp="gauges[fighter.combatant.combatantId]?.hp ?? fighter.combatant.hp"
          :x="standingPoint(fighter)[0]"
          :y="standingPoint(fighter)[1]"
          :stance="stanceOf(fighter.combatant.combatantId)"
          :faces-back="stage.turnedBack.value.includes(fighter.combatant.combatantId)"
          :tone="fighter.tone"
          :is-turn="awaitingCommand && shownTurnId === fighter.combatant.combatantId"
          :is-targetable="targetIds.includes(fighter.combatant.combatantId)"
          :floating="stage.floating.value.filter((f) => f.combatantId === fighter.combatant.combatantId)"
          @pick="$emit('pick', $event)"
        />
      </div>

      <CombatAtmosphere class="combat-scene__atmosphere" :lights="lights" />

      <div class="combat-scene__effects">
        <CombatEffect
          v-for="effect in effects"
          :key="effect.key"
          :kind="effect.kind"
          :x="effect.x"
          :y="effect.y"
          :floor-y="effect.floorY"
          :from-x="effect.fromX"
          :from-y="effect.fromY"
          :size="effect.size"
          :duration="effect.duration"
        />
      </div>
    </div>

    <span v-if="hurtFlash" :key="hurtFlash" class="combat-scene__hurt" aria-hidden="true" />
  </div>
</template>

<style scoped lang="scss">
.combat-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background-color: #000f0d;

  // Everything the camera sees. The layers carry NO z-index: in CSS, a z-index makes an
  // isolated group, and the light and the effects must blend with the room and the
  // fighters below them. Their own elements are stacked instead: fighters by row (up to
  // ~200), the light of the room at 800, the effects at 900 (see the child components).
  &__camera,
  &__room,
  &__stage,
  &__effects {
    position: absolute;
    inset: 0;
  }

  // The camera is the one isolated group: everything inside blends together.
  &__camera {
    filter: saturate(1.08) contrast(1.06);
    transition: scale 220ms cubic-bezier(0.2, 0.9, 0.3, 1);
  }

  &__camera--punch {
    scale: 1.08;
    transition-duration: 70ms;
  }

  &__effects {
    pointer-events: none;
  }

  &--shake &__camera {
    animation: scene-shake 300ms linear;
  }

  // Red at the edges of the screen when the party takes a heavy blow.
  &__hurt {
    position: absolute;
    z-index: 4;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(ellipse at center, transparent 55%, rgb(200 20 30 / 55%) 100%);
    animation: scene-hurt 420ms ease-out forwards;
  }

  &__piece {
    position: absolute;
    left: calc(var(--tx) * var(--u));
    top: calc(var(--ty) * var(--u));
    // A hair wider, so that fractional scales never show a seam between tiles.
    inline-size: calc(var(--sw) * var(--u) + 0.5px);
    block-size: calc(var(--sh) * var(--u) + 0.5px);
    background-repeat: no-repeat;
    background-position: calc(var(--sx) * var(--u) * -1) calc(var(--sy) * var(--u) * -1);
    image-rendering: pixelated;

    &--atlas {
      background-size: calc(576 * var(--u)) calc(298 * var(--u));
    }

    &--props {
      background-image: url("@/assets/dongeon/props.png");
      background-size: calc(384 * var(--u)) calc(256 * var(--u));
    }

    &--torch {
      background-image: url("@/assets/dongeon/objects.png");
      background-size: calc(320 * var(--u)) calc(480 * var(--u));
      animation: combat-torch 0.6s steps(5) infinite;
      // The flame wobbles in its own heat (see CombatFilters).
      filter: url(#combat-heat) brightness(1.15);
    }
  }

  &--violet .combat-scene__piece--atlas {
    background-image: url("@/assets/dongeon/atlas-violet.png");
  }

  &--stone .combat-scene__piece--atlas {
    background-image: url("@/assets/dongeon/atlas-stone.png");
  }
}

@keyframes scene-hurt {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes scene-shake {
  0%, 100% { translate: 0 0; }
  20% { translate: calc(-2 * var(--u)) calc(1 * var(--u)); }
  40% { translate: calc(2 * var(--u)) calc(-1 * var(--u)); }
  60% { translate: calc(-1 * var(--u)) calc(-1 * var(--u)); }
  80% { translate: calc(1 * var(--u)) calc(1 * var(--u)); }
}

@keyframes combat-torch {
  from {
    background-position-x: calc(var(--sx) * var(--u) * -1);
  }
  to {
    background-position-x: calc((var(--sx) + 5 * 32) * var(--u) * -1);
  }
}

// Reduced motion: the player's choice, or the system's (see useMotionPreference).
// The WHOLE selector goes inside :global(): Vue drops whatever follows it.
:global(.combat-motion--reduced .combat-scene__piece--torch),
:global(.combat-motion--reduced .combat-scene--shake .combat-scene__camera) {
  animation: none;
}

:global(.combat-motion--reduced .combat-scene__camera--punch) {
  scale: 1;
}

</style>
