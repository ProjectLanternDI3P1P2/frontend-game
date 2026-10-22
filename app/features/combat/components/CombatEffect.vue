<script setup lang="ts">
/**
 * One visual effect over the board: a sword arc, claw marks, a fireball flying across the
 * room, a ring of frost, rising sparkles... Drawn with CSS only (gradients, borders,
 * keyframes): no image and no JavaScript per frame. The stage removes it once played.
 */
import type { EffectKind } from "../composables/useBattleStage";

defineProps<{
  kind: EffectKind;
  /** Centre of the target's body, in source pixels. */
  x: number;
  y: number;
  /** Where a travelling effect starts. */
  fromX?: number;
  fromY?: number;
  /** Size of the target, to fit rings and arcs around it. */
  size: number;
  /** Milliseconds. */
  duration: number;
  /** Feet of the target, for effects on the floor. */
  floorY: number;
}>();

const PARTICLES = [0, 1, 2, 3, 4, 5];
const RAYS = [0, 1, 2, 3, 4, 5, 6, 7];
</script>

<template>
  <span
    class="combat-effect"
    :class="'combat-effect--' + kind"
    :style="{
      '--ex': x,
      '--ey': kind === 'aura' || kind === 'shield' ? floorY : y,
      '--ex0': fromX ?? x,
      '--ey0': fromY ?? y,
      '--size': size,
      '--life': `${duration}ms`,
    }"
    aria-hidden="true"
  >
    <template v-if="kind === 'claw'">
      <span v-for="n in 3" :key="n" class="combat-effect__claw" :style="{ '--n': n }" />
    </template>
    <template v-else-if="kind === 'critical'">
      <span v-for="n in RAYS" :key="n" class="combat-effect__ray" :style="{ '--n': n }" />
    </template>
    <template v-else-if="kind === 'heal' || kind === 'mana' || kind === 'potion' || kind === 'frost' || kind === 'explosion' || kind === 'smoke' || kind === 'impact'">
      <span
        v-for="n in PARTICLES"
        :key="n"
        class="combat-effect__particle"
        :style="{ '--n': n }"
      />
    </template>
  </span>
</template>

<style scoped lang="scss">
// Everything is in source pixels times `--u`, like the fighters.
.combat-effect {
  --s: calc(var(--size) * var(--u));

  position: absolute;
  z-index: 900;
  left: calc(var(--ex) * var(--u));
  top: calc(var(--ey) * var(--u));
  inline-size: 0;
  block-size: 0;
  pointer-events: none;

  // Light adds up instead of covering: the "screen" blend makes every flash glow on the
  // dark room, and the bloom filter blurs a copy under it (see CombatFilters).
  &--slash,
  &--impact,
  &--explosion,
  &--frost,
  &--critical,
  &--heal,
  &--mana,
  &--aura {
    mix-blend-mode: screen;
    filter: url(#combat-bloom);
  }

  // Fire burns: its shape wobbles under the heat filter, then blooms.
  &--fireball,
  &--explosion {
    mix-blend-mode: screen;
    filter: url(#combat-heat) url(#combat-bloom);
  }

  // ---- Critical: a burst of light rays ----
  &__ray {
    position: absolute;
    left: calc(-0.75 * var(--u));
    top: 0;
    inline-size: calc(1.5 * var(--u));
    block-size: calc(var(--s) * 0.9);
    border-radius: var(--u);
    background: linear-gradient(#fff, #ffd23f 40%, rgb(255 106 0 / 0%));
    transform-origin: 50% 0;
    rotate: calc(var(--n) * 45deg + 22deg);
    animation: effect-ray var(--life) cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
  }

  // ---- Shockwave: a ring that bends the room behind it as it spreads ----
  &--shockwave::before {
    content: "";
    position: absolute;
    left: calc(var(--s) * -0.8);
    top: calc(var(--s) * -0.8);
    inline-size: calc(var(--s) * 1.6);
    block-size: calc(var(--s) * 1.6);
    border: calc(1.5 * var(--u)) solid rgb(255 255 255 / 55%);
    border-radius: 50%;
    backdrop-filter: blur(1.5px) brightness(1.35) saturate(1.4);
    animation: effect-shockwave var(--life) ease-out forwards;
  }

  // ---- Sword arc: a white crescent sweeping down across the target ----
  &--slash::before {
    content: "";
    position: absolute;
    left: calc(var(--s) * -0.6);
    top: calc(var(--s) * -0.6);
    inline-size: calc(var(--s) * 1.2);
    block-size: calc(var(--s) * 1.2);
    border-radius: 50%;
    border-top: calc(2.5 * var(--u)) solid #fff;
    border-right: calc(1 * var(--u)) solid rgb(255 255 255 / 60%);
    filter: drop-shadow(0 0 calc(2 * var(--u)) #bfe3ff);
    animation: effect-slash var(--life) ease-out forwards;
  }

  // ---- Claw: three red marks raking the target ----
  &__claw {
    position: absolute;
    left: calc((var(--n) - 2) * 4 * var(--u) - var(--u));
    top: calc(var(--s) * -0.4);
    inline-size: calc(1.5 * var(--u));
    block-size: calc(var(--s) * 0.8);
    border-radius: var(--u);
    background: linear-gradient(#fff, #ff4d4d);
    rotate: 25deg;
    transform-origin: top;
    filter: drop-shadow(0 0 var(--u) #ff2a2a);
    animation: effect-claw var(--life) ease-out forwards;
    animation-delay: calc(var(--n) * 30ms);
    scale: 1 0;
  }

  // ---- Impact: a burst star ----
  &--impact::before {
    content: "";
    position: absolute;
    left: calc(-6 * var(--u));
    top: calc(-6 * var(--u));
    inline-size: calc(12 * var(--u));
    block-size: calc(12 * var(--u));
    background: radial-gradient(circle, #fff 0 20%, #ffe680 30%, transparent 65%);
    clip-path: polygon(50% 0, 61% 35%, 100% 50%, 61% 65%, 50% 100%, 39% 65%, 0 50%, 39% 35%);
    animation: effect-burst var(--life) ease-out forwards;
  }

  // ---- Fireball: flies from the caster, then explodes ----
  &--fireball::before {
    content: "";
    position: absolute;
    left: calc(-4 * var(--u));
    top: calc(-4 * var(--u));
    inline-size: calc(8 * var(--u));
    block-size: calc(8 * var(--u));
    border-radius: 50%;
    background: radial-gradient(circle at 40% 40%, #fff 0 15%, #ffd23f 30%, #ff6a00 60%, #b31800 100%);
    box-shadow:
      0 0 calc(4 * var(--u)) #ff8c1a,
      calc(-5 * var(--u)) 0 calc(4 * var(--u)) rgb(255 120 0 / 60%),
      calc(-10 * var(--u)) 0 calc(5 * var(--u)) rgb(255 60 0 / 30%);
    animation:
      effect-fly var(--life) cubic-bezier(0.5, 0, 0.8, 1) forwards,
      effect-flicker 90ms steps(2) infinite;
  }

  &--fireball {
    left: 0;
    top: 0;
  }

  &--explosion::before {
    content: "";
    position: absolute;
    left: calc(var(--s) * -0.7);
    top: calc(var(--s) * -0.7);
    inline-size: calc(var(--s) * 1.4);
    block-size: calc(var(--s) * 1.4);
    border-radius: 50%;
    background: radial-gradient(circle, #fff 0 10%, #ffd23f 25%, #ff6a00 50%, rgb(120 20 0 / 0%) 70%);
    animation: effect-burst var(--life) ease-out forwards;
  }

  // ---- Frost: an icy ring and shards around the target ----
  &--frost::before {
    content: "";
    position: absolute;
    left: calc(var(--s) * -0.6);
    top: calc(var(--s) * -0.6);
    inline-size: calc(var(--s) * 1.2);
    block-size: calc(var(--s) * 1.2);
    border: calc(1.5 * var(--u)) solid #d6f3ff;
    border-radius: 50%;
    background: radial-gradient(circle, rgb(170 225 255 / 55%), transparent 70%);
    box-shadow: 0 0 calc(4 * var(--u)) #7fd1ff;
    animation: effect-burst var(--life) ease-out forwards;
  }

  // ---- Shield: a golden bubble ----
  &--shield::before {
    content: "";
    position: absolute;
    left: calc(var(--s) * -0.6);
    top: calc(var(--s) * -1.25);
    inline-size: calc(var(--s) * 1.2);
    block-size: calc(var(--s) * 1.3);
    border: calc(1 * var(--u)) solid rgb(255 220 120 / 90%);
    border-radius: 50% 50% 45% 45%;
    background: radial-gradient(circle at 35% 30%, rgb(255 255 255 / 45%), rgb(255 200 80 / 15%) 60%);
    box-shadow: 0 0 calc(4 * var(--u)) #ffcf4a;
    animation: effect-shield var(--life) ease-out forwards;
  }

  // ---- Aura: a magic circle under the caster's feet ----
  &--aura::before {
    content: "";
    position: absolute;
    left: calc(var(--s) * -0.7);
    top: calc(var(--s) * -0.18);
    inline-size: calc(var(--s) * 1.4);
    block-size: calc(var(--s) * 0.36);
    border: calc(1 * var(--u)) solid #9fd4ff;
    border-radius: 50%;
    box-shadow:
      0 0 calc(3 * var(--u)) #6cbcff,
      inset 0 0 calc(3 * var(--u)) #6cbcff;
    animation: effect-aura var(--life) ease-out forwards;
  }

  // ---- Particles: rising sparkles, ice shards, sparks, smoke ----
  &__particle {
    --angle: calc(var(--n) * 60deg);

    position: absolute;
    left: calc(((var(--n) * 37) - 90) * var(--size) * var(--u) / 200);
    top: 0;
    inline-size: calc(3 * var(--u));
    block-size: calc(3 * var(--u));
    animation: effect-rise var(--life) ease-out forwards;
    animation-delay: calc(var(--n) * 60ms);
    opacity: 0;
  }

  &--heal &__particle,
  &--potion &__particle {
    background: linear-gradient(#7dff9a, #7dff9a) center / 100% 34% no-repeat,
      linear-gradient(#7dff9a, #7dff9a) center / 34% 100% no-repeat;
    filter: drop-shadow(0 0 var(--u) #2fff6a);
  }

  &--potion &__particle {
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #fff, #ff5a7a 60%);
    filter: none;
  }

  &--mana &__particle {
    border-radius: 50%;
    background: radial-gradient(circle, #fff, #6c8cff 70%);
    filter: drop-shadow(0 0 var(--u) #6c8cff);
  }

  &--frost &__particle {
    inline-size: calc(1.5 * var(--u));
    block-size: calc(5 * var(--u));
    background: linear-gradient(#fff, #9fe0ff);
    rotate: var(--angle);
    animation-name: effect-shard;
  }

  &--explosion &__particle {
    border-radius: 50%;
    background: #ffd23f;
    box-shadow: 0 0 var(--u) #ff6a00;
    animation-name: effect-shard;
  }

  // Sparks flying off a blow.
  &--impact &__particle {
    inline-size: calc(1 * var(--u));
    block-size: calc(3 * var(--u));
    border-radius: var(--u);
    background: linear-gradient(#fff, #ffe680);
    rotate: var(--angle);
    animation-name: effect-shard;
    animation-duration: calc(var(--life) * 0.9);
    animation-delay: 0ms;
  }

  &--smoke &__particle {
    inline-size: calc(var(--s) * 0.35);
    block-size: calc(var(--s) * 0.35);
    border-radius: 50%;
    background: radial-gradient(circle, rgb(220 220 230 / 85%), rgb(150 150 165 / 0%) 70%);
    animation-name: effect-smoke;
  }
}

@keyframes effect-slash {
  0% { opacity: 0; rotate: -100deg; scale: 0.6; }
  20% { opacity: 1; }
  70% { opacity: 1; rotate: 40deg; scale: 1; }
  100% { opacity: 0; rotate: 60deg; scale: 1.05; }
}

@keyframes effect-claw {
  0% { scale: 1 0; opacity: 1; }
  40% { scale: 1 1; opacity: 1; }
  100% { scale: 1 1; opacity: 0; }
}

@keyframes effect-ray {
  0% { opacity: 0; scale: 1 0.1; }
  20% { opacity: 1; scale: 1 1.1; }
  100% { opacity: 0; scale: 0.6 1.4; }
}

@keyframes effect-shockwave {
  0% { opacity: 1; scale: 0.15; }
  100% { opacity: 0; scale: 1.5; }
}

@keyframes effect-burst {
  0% { scale: 0.2; opacity: 1; }
  60% { scale: 1.1; opacity: 1; }
  100% { scale: 1.4; opacity: 0; }
}

@keyframes effect-fly {
  from { translate: calc(var(--ex0) * var(--u)) calc(var(--ey0) * var(--u)); }
  to { translate: calc(var(--ex) * var(--u)) calc(var(--ey) * var(--u)); }
}

@keyframes effect-flicker {
  from { filter: brightness(1); }
  to { filter: brightness(1.4); }
}

@keyframes effect-shield {
  0% { opacity: 0; scale: 0.5; }
  25% { opacity: 1; scale: 1.08; }
  40% { scale: 1; }
  80% { opacity: 0.9; }
  100% { opacity: 0; scale: 1.05; }
}

@keyframes effect-aura {
  0% { opacity: 0; scale: 0.3; }
  30% { opacity: 1; scale: 1; }
  100% { opacity: 0; scale: 1.25; }
}

@keyframes effect-rise {
  0% { opacity: 0; translate: 0 0; }
  20% { opacity: 1; }
  100% { opacity: 0; translate: 0 calc(-18 * var(--u)); }
}

@keyframes effect-shard {
  0% { opacity: 1; translate: 0 0; }
  100% {
    opacity: 0;
    translate: calc(cos(var(--angle)) * var(--size) * 0.7 * var(--u))
      calc(sin(var(--angle)) * var(--size) * 0.7 * var(--u));
  }
}

@keyframes effect-smoke {
  0% { opacity: 0.9; scale: 0.4; translate: 0 0; }
  100% { opacity: 0; scale: 1.6; translate: 0 calc(-8 * var(--u)); }
}

// Reduced motion: the player's choice, or the system's (see useMotionPreference).
// The WHOLE selector goes inside :global(): Vue drops whatever follows it.
:global(.combat-motion--reduced .combat-effect),
:global(.combat-motion--reduced .combat-effect *),
:global(.combat-motion--reduced .combat-effect::before) {
  animation-duration: 1ms !important;
}

</style>
