<script setup lang="ts">
/**
 * The light of the room, drawn over the fighters like a post-process pass, with CSS only:
 *
 * - a cool shade multiplied over the edges of the room (vignette, colour grading);
 * - a warm pool of light under each torch, added with the "screen" blend, flickering;
 * - dust motes drifting in the light, embers rising from the torches.
 *
 * Purely decorative: hidden from assistive technology, and still under reduced motion.
 */
const props = defineProps<{
  /** Flames of the torches, in source pixels. */
  lights: readonly { x: number; y: number }[];
}>();

/** Positions, sizes and speeds picked once, so that the dust does not jump between renders. */
const DUST = Array.from({ length: 18 }, (_, n) => ({
  x: (n * 73) % 320,
  y: 40 + ((n * 41) % 120),
  size: 1 + (n % 3) * 0.5,
  duration: 9 + (n % 5) * 2.5,
  delay: -((n * 1.7) % 9),
}));

const EMBERS_PER_LIGHT = 5;
const embers = computed(() =>
  props.lights.flatMap((light, l) =>
    Array.from({ length: EMBERS_PER_LIGHT }, (_, n) => ({
      key: `${l}-${n}`,
      x: light.x + ((n * 5) % 9) - 4,
      y: light.y,
      drift: ((n * 7) % 11) - 5,
      duration: 1.8 + (n % 3) * 0.6,
      delay: -(n * 0.45),
    })),
  ),
);
</script>

<template>
  <div class="combat-atmosphere" aria-hidden="true">
    <span class="combat-atmosphere__shade" />
    <span
      v-for="(light, index) in lights"
      :key="index"
      class="combat-atmosphere__light"
      :style="{ '--lx': light.x, '--ly': light.y, '--delay': `${-index * 0.37}s` }"
    />
    <span
      v-for="(mote, index) in DUST"
      :key="'d' + index"
      class="combat-atmosphere__dust"
      :style="{
        '--dx': mote.x,
        '--dy': mote.y,
        '--ds': mote.size,
        '--duration': `${mote.duration}s`,
        '--delay': `${mote.delay}s`,
      }"
    />
    <span
      v-for="ember in embers"
      :key="ember.key"
      class="combat-atmosphere__ember"
      :style="{
        '--dx': ember.x,
        '--dy': ember.y,
        '--drift': ember.drift,
        '--duration': `${ember.duration}s`,
        '--delay': `${ember.delay}s`,
      }"
    />
  </div>
</template>

<style scoped lang="scss">
.combat-atmosphere {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;

  // Darker, cooler edges: the eye goes to the middle of the room.
  // No z-index on the layer itself (it would isolate the blends): each light does.
  &__shade {
    position: absolute;
    z-index: 800;
    inset: 0;
    background: radial-gradient(
      ellipse 68% 72% at 50% 58%,
      #fff 28%,
      #9aa1c0 62%,
      #30344c 100%
    );
    mix-blend-mode: multiply;
  }

  // Warm light under a torch, breathing with its flame.
  &__light {
    position: absolute;
    z-index: 801;
    left: calc(var(--lx) * var(--u));
    top: calc(var(--ly) * var(--u));
    inline-size: calc(150 * var(--u));
    block-size: calc(120 * var(--u));
    translate: -50% -38%;
    background: radial-gradient(
      ellipse closest-side,
      rgb(255 180 95 / 65%),
      rgb(255 135 55 / 28%) 50%,
      rgb(255 110 40 / 0%) 100%
    );
    mix-blend-mode: screen;
    animation: atmosphere-flicker 2.3s ease-in-out infinite;
    animation-delay: var(--delay);
  }

  &__dust {
    position: absolute;
    z-index: 802;
    left: calc(var(--dx) * var(--u));
    top: calc(var(--dy) * var(--u));
    inline-size: calc(var(--ds) * var(--u));
    block-size: calc(var(--ds) * var(--u));
    border-radius: 50%;
    background: rgb(255 236 200 / 70%);
    mix-blend-mode: screen;
    opacity: 0;
    animation: atmosphere-dust var(--duration) linear infinite;
    animation-delay: var(--delay);
  }

  &__ember {
    position: absolute;
    z-index: 802;
    left: calc(var(--dx) * var(--u));
    top: calc(var(--dy) * var(--u));
    inline-size: var(--u);
    block-size: var(--u);
    background: #ffb347;
    box-shadow: 0 0 calc(1.5 * var(--u)) #ff7a1a;
    mix-blend-mode: screen;
    opacity: 0;
    animation: atmosphere-ember var(--duration) ease-out infinite;
    animation-delay: var(--delay);
  }
}

@keyframes atmosphere-flicker {
  0%, 100% { opacity: 0.85; scale: 1; }
  20% { opacity: 1; scale: 1.03; }
  35% { opacity: 0.75; scale: 0.98; }
  60% { opacity: 0.95; scale: 1.02; }
  80% { opacity: 0.8; scale: 0.99; }
}

@keyframes atmosphere-dust {
  0% { opacity: 0; translate: 0 0; }
  20% { opacity: 0.6; }
  80% { opacity: 0.5; }
  100% { opacity: 0; translate: calc(14 * var(--u)) calc(-10 * var(--u)); }
}

@keyframes atmosphere-ember {
  0% { opacity: 0; translate: 0 0; }
  15% { opacity: 1; }
  100% { opacity: 0; translate: calc(var(--drift) * var(--u)) calc(-26 * var(--u)); }
}

// Reduced motion: the light stays, nothing moves.
:global(.combat-motion--reduced .combat-atmosphere__light) {
  animation: none;
}

:global(.combat-motion--reduced .combat-atmosphere__dust),
:global(.combat-motion--reduced .combat-atmosphere__ember) {
  display: none;
}
</style>
