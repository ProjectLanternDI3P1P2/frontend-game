<script setup lang="ts">
/**
 * One combatant on the board: its animated sprite in its current stance, a small HP gauge
 * and the numbers popping over it. Presentational: the stage decides where it stands and
 * how; moving `x`/`y` makes it run there (a CSS transition).
 */
import type { CombatSprite } from "../combatSprites";
import { spriteStyle } from "../combatSprites";
import type { PartyTone } from "../combatRules";
import type { FloatingText, Stance } from "../composables/useBattleStage";
import type { Combatant } from "../types";

const props = defineProps<{
  combatant: Combatant;
  sprite: CombatSprite;
  hp: number;
  /** Feet of the fighter on the board, in source pixels. */
  x: number;
  y: number;
  stance: Stance;
  /** Drawn mirrored: running back to its place, or away. */
  facesBack: boolean;
  tone?: PartyTone;
  /** A hero waiting for the player's command. */
  isTurn: boolean;
  isTargetable: boolean;
  floating: FloatingText[];
}>();

defineEmits<{ pick: [combatant: Combatant] }>();

const isHero = computed(() => props.combatant.side === "Hero");
const isDown = computed(() => props.stance === "down" || props.hp <= 0);

/**
 * A beaten monster dissolves: a noise mask eats it away (an SVG filter of its own, so that
 * its clock starts when it falls). Alpha = 4 x noise + offset, the offset sliding from 1
 * (all kept) to -4 (all gone).
 */
const dissolveId = computed(() => `combat-dissolve-${props.combatant.combatantId}`);
const DISSOLVE_FROM = "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4 0 0 0 1";
const DISSOLVE_TO = "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4 0 0 0 -4";
const dissolve = ref<SVGAnimateElement | null>(null);
const isDissolving = ref(false);
watch(isDown, async (down) => {
  if (!down || isHero.value) return;
  isDissolving.value = true;
  await nextTick();
  dissolve.value?.beginElement();
});
const style = computed(() => {
  const sprite: Record<string, string> = spriteStyle(props.sprite);
  // A party colour comes from the tone class: the inline filter would override it.
  if (props.tone) delete sprite["--filter"];
  return {
    ...sprite,
    "--fx": String(props.x),
    "--fy": String(props.y),
    zIndex: String(Math.round(props.y)),
  };
});
</script>

<template>
  <component
    :is="isTargetable ? 'button' : 'div'"
    :type="isTargetable ? 'button' : undefined"
    class="combat-fighter"
    :class="[
      isHero ? 'combat-fighter--hero' : 'combat-fighter--monster',
      tone ? 'combat-fighter--' + tone : null,
      'combat-fighter--' + (isDown ? 'down' : stance),
      {
        'combat-fighter--back': facesBack,
        'combat-fighter--turn': isTurn && !isDown,
        'combat-fighter--defending': combatant.isDefending && !isDown,
        'combat-fighter--targetable': isTargetable,
        'combat-fighter--floats': sprite.floats,
      },
    ]"
    :style="style"
    :aria-label="isTargetable ? `Target ${combatant.name}, ${hp} of ${combatant.maxHp} HP` : undefined"
    @click="isTargetable && $emit('pick', combatant)"
  >
    <svg v-if="!isHero" class="combat-fighter__filters" width="0" height="0" aria-hidden="true">
      <filter :id="dissolveId" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.14" numOctaves="2" result="noise" />
        <feColorMatrix in="noise" type="matrix" :values="DISSOLVE_FROM" result="mask">
          <animate
            ref="dissolve"
            attributeName="values"
            :from="DISSOLVE_FROM"
            :to="DISSOLVE_TO"
            dur="700ms"
            begin="indefinite"
            fill="freeze"
          />
        </feColorMatrix>
        <feComposite in="SourceGraphic" in2="mask" operator="in" />
      </filter>
    </svg>
    <span class="combat-fighter__shadow" aria-hidden="true" />
    <span
      class="combat-fighter__body"
      :style="isDissolving ? { filter: `url(#${dissolveId})` } : undefined"
      aria-hidden="true"
    >
      <span class="combat-fighter__sprite" :class="'combat-fighter__sprite--' + sprite.sheet" />
    </span>
    <span v-if="!isHero && !isDown" class="combat-fighter__gauge" aria-hidden="true">
      <span
        class="combat-fighter__gauge-fill"
        :style="{ inlineSize: `${(hp / combatant.maxHp) * 100}%` }"
      />
    </span>
    <span v-if="isTurn && !isDown" class="combat-fighter__marker" aria-hidden="true" />
    <span v-if="isTargetable" class="combat-fighter__name">{{ combatant.name }}</span>
    <span
      v-for="text in floating"
      :key="text.key"
      class="combat-fighter__float"
      :class="'combat-fighter__float--' + text.kind"
      aria-hidden="true"
    >{{ text.text }}</span>
  </component>
</template>

<style scoped lang="scss">
// `--u` is one source pixel on screen, set by the scene.
.combat-fighter {
  --w: calc(var(--sw) * var(--u) * var(--scale));
  --h: calc(var(--sh) * var(--u) * var(--scale));
  // Top of the drawing, inside the box: gauges, markers and numbers sit just above it.
  --head: calc((var(--pad-top) + var(--pad-bottom)) * var(--u) * var(--scale));
  // Which way "forward" is: heroes face the monsters on the right, monsters the left.
  --forward: 1;

  position: absolute;
  left: calc(var(--fx) * var(--u) - var(--w) / 2);
  top: calc(var(--fy) * var(--u) - var(--h));
  inline-size: var(--w);
  block-size: var(--h);
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  // Moving `--fx`/`--fy` makes the fighter run there.
  transition:
    left 360ms cubic-bezier(0.45, 0, 0.3, 1),
    top 360ms cubic-bezier(0.45, 0, 0.3, 1),
    opacity 500ms ease-in;

  &--monster {
    --forward: -1;
  }

  &--targetable {
    cursor: pointer;

    &:hover .combat-fighter__sprite,
    &:focus-visible .combat-fighter__sprite {
      filter: var(--filter) drop-shadow(0 0 calc(2 * var(--u)) var(--color-accent));
    }

    &:focus-visible {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }
  }

  // ---- Body: the stance animations play here, the sprite plays its frames inside ----

  &__body {
    position: absolute;
    inset: 0;
    transform-origin: 50% 100%;
  }

  &--back &__body {
    scale: -1 1;
  }

  // The hero whose turn it is steps forward, sword ready.
  &--hero.combat-fighter--turn &__body {
    translate: calc(5 * var(--u)) 0;
    transition: translate 200ms ease-out;
  }

  // Monsters hop when they move; heroes run with their sheet's run row.
  &--monster.combat-fighter--run &__body {
    animation: fighter-hop 180ms ease-in-out infinite alternate;
  }

  // A blow: a short wind-up back, then a lunge forward.
  &--strike &__body {
    animation: fighter-lunge 300ms cubic-bezier(0.3, 0, 0.2, 1);
  }

  &--monster.combat-fighter--strike &__body {
    animation: fighter-bite 300ms cubic-bezier(0.3, 0, 0.2, 1);
  }

  // Hit: knocked back, flashing white.
  &--hurt &__body {
    animation: fighter-recoil 260ms ease-out;
  }

  &--hurt .combat-fighter__sprite {
    animation:
      combat-frames var(--duration) steps(var(--frames)) infinite,
      fighter-flash 260ms steps(2);
  }

  // Casting: an icy outline glows around the sprite (see CombatFilters).
  &--cast .combat-fighter__sprite {
    filter: var(--filter) url(#combat-glow-edge) brightness(1.15);
  }

  // Dodging: a quick hop back, leaning away from the blow.
  &--dodge &__body {
    animation: fighter-dodge 320ms cubic-bezier(0.2, 0.9, 0.3, 1);
  }

  &--guard .combat-fighter__sprite,
  &--defending .combat-fighter__sprite {
    filter: var(--filter) drop-shadow(0 0 calc(2 * var(--u)) var(--palette-gold-400));
  }

  &--cheer &__body {
    animation: fighter-cheer 420ms ease-out infinite;
  }

  // Knocked out: a hero falls on its side; a monster flickers and melts away.
  &--hero.combat-fighter--down &__body {
    rotate: -90deg;
    translate: 0 calc(-4 * var(--u));
    transition:
      rotate 300ms ease-in,
      translate 300ms ease-in;
  }

  &--hero.combat-fighter--down .combat-fighter__sprite {
    filter: grayscale(1) brightness(0.6);
  }

  &--monster.combat-fighter--down {
    pointer-events: none;
  }

  // The noise filter eats it away; meanwhile it flashes and sinks.
  &--monster.combat-fighter--down &__body {
    animation: fighter-vanish 720ms ease-in forwards;
  }

  &--monster.combat-fighter--down .combat-fighter__shadow {
    opacity: 0;
    transition: opacity 600ms;
  }

  &__filters {
    position: absolute;
    inline-size: 0;
    block-size: 0;
    overflow: hidden;
  }

  &__shadow {
    position: absolute;
    left: 22%;
    bottom: calc(-1 * var(--u));
    inline-size: 56%;
    block-size: calc(3 * var(--u) * var(--scale));
    border-radius: 50%;
    background: rgb(0 0 0 / 35%);
  }

  &__sprite {
    position: absolute;
    inset: 0;
    // The empty rows under the drawing go below the feet line.
    top: calc(var(--pad-bottom) * var(--u) * var(--scale));
    bottom: auto;
    block-size: var(--h);
    background-repeat: no-repeat;
    background-size: calc(var(--sheet-w) * var(--u) * var(--scale))
      calc(var(--sheet-h) * var(--u) * var(--scale));
    background-position: calc(var(--sx) * var(--u) * var(--scale) * -1)
      calc(var(--sy) * var(--u) * var(--scale) * -1);
    image-rendering: pixelated;
    filter: var(--filter);
    animation: combat-frames var(--duration) steps(var(--frames)) infinite;

    &--hero {
      background-image: url("@/assets/heroes/swordsman/hero_swordsman_spritesheet.png");
    }

    &--objects {
      background-image: url("@/assets/dongeon/objects.png");
    }

    &--mob {
      background-image: url("@/assets/dongeon/placeholder_mob.png");
    }
  }

  // Only at rest: a flying monster still lunges and recoils like the others.
  &--floats.combat-fighter--idle &__body {
    animation: fighter-float 2.4s ease-in-out infinite;
  }

  // Party colours, as in the mock-up (red, yellow, grey).
  &--red {
    --filter: hue-rotate(230deg) saturate(1.4);
  }

  &--yellow {
    --filter: hue-rotate(-70deg) saturate(1.6);
  }

  &--grey {
    --filter: grayscale(0.85) brightness(1.1);
  }

  &--blue {
    --filter: hue-rotate(80deg);
  }

  &__gauge {
    position: absolute;
    left: 20%;
    top: calc(var(--head) - 4 * var(--u));
    inline-size: 60%;
    block-size: calc(2 * var(--u));
    min-block-size: 3px;
    background: var(--color-surface-base);
    outline: 1px solid rgb(0 0 0 / 60%);
  }

  &__gauge-fill {
    display: block;
    block-size: 100%;
    background: var(--color-danger);
    transition: inline-size 300ms ease-out;
  }

  // A bobbing golden arrow over the hero who must act.
  &__marker {
    position: absolute;
    left: 50%;
    top: calc(var(--head) - 9 * var(--u));
    inline-size: 0;
    block-size: 0;
    border-inline: calc(3 * var(--u)) solid transparent;
    border-top: calc(4 * var(--u)) solid var(--palette-gold-400);
    filter: drop-shadow(0 1px 0 #000);
    translate: -50% 0;
    animation: fighter-marker 700ms ease-in-out infinite alternate;
  }

  &__name {
    position: absolute;
    left: 50%;
    top: calc(var(--head) - 13 * var(--u));
    translate: -50% 0;
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm, 4px);
    background: rgb(0 0 0 / 70%);
    color: var(--color-text-primary);
    font-size: var(--font-size-xs);
    white-space: nowrap;
  }

  // Damage pops out big, settles, then floats away.
  &__float {
    position: absolute;
    z-index: 2;
    left: 50%;
    top: calc(var(--head) - 8 * var(--u));
    font-family: var(--font-family-display);
    font-size: calc(8 * var(--u));
    font-weight: 800;
    line-height: 1;
    -webkit-text-stroke: calc(0.6 * var(--u)) #1a0f0a;
    paint-order: stroke fill;
    text-shadow: 0 calc(1 * var(--u)) 0 #000;
    pointer-events: none;
    animation: fighter-pop 1.1s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;

    &--damage {
      color: #fff;
    }

    &--heavy {
      color: #ffd23f;
      font-size: calc(11 * var(--u));
    }

    &--crit {
      color: #ff6a3d;
      font-size: calc(14 * var(--u));
      animation: fighter-pop-crit 1.2s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
      filter: drop-shadow(0 0 calc(3 * var(--u)) rgb(255 120 40 / 80%));
    }

    &--miss {
      color: #cfd6e6;
      font-size: calc(7 * var(--u));
      font-style: italic;
    }

    &--heal {
      color: #7dff9a;
    }

    &--mana {
      color: #8fb8ff;
    }
  }
}

@keyframes combat-frames {
  from {
    background-position-x: calc(var(--sx) * var(--u) * var(--scale) * -1);
  }
  to {
    background-position-x: calc(
      (var(--sx) + var(--frames) * var(--pitch)) * var(--u) * var(--scale) * -1
    );
  }
}

@keyframes fighter-lunge {
  0% { translate: 0 0; }
  30% { translate: calc(-3 * var(--u) * var(--forward)) 0; }
  60% { translate: calc(7 * var(--u) * var(--forward)) 0; }
  100% { translate: 0 0; }
}

@keyframes fighter-bite {
  0% { translate: 0 0; scale: 1 1; }
  30% { translate: calc(-2 * var(--u) * var(--forward)) 0; scale: 0.85 1.15; }
  60% { translate: calc(8 * var(--u) * var(--forward)) 0; scale: 1.25 0.8; }
  100% { translate: 0 0; scale: 1 1; }
}

@keyframes fighter-recoil {
  0% { translate: 0 0; }
  30% { translate: calc(-6 * var(--u) * var(--forward)) calc(-1 * var(--u)); }
  100% { translate: 0 0; }
}

@keyframes fighter-flash {
  0% { filter: brightness(4) saturate(0); }
  100% { filter: var(--filter); }
}

@keyframes fighter-hop {
  from { translate: 0 0; }
  to { translate: 0 calc(-4 * var(--u)); }
}

@keyframes fighter-cheer {
  0%, 100% { translate: 0 0; }
  40% { translate: 0 calc(-7 * var(--u)); }
}

@keyframes fighter-vanish {
  0% { opacity: 1; scale: 1 1; translate: 0 0; }
  20% { opacity: 0.6; }
  35% { opacity: 1; scale: 1.1 0.92; }
  100% { opacity: 0; scale: 1.15 0.6; translate: 0 calc(-4 * var(--u)); }
}

@keyframes fighter-dodge {
  0% { translate: 0 0; skew: 0deg; }
  40% { translate: calc(-9 * var(--u) * var(--forward)) calc(-3 * var(--u)); skew: calc(-12deg * var(--forward)); }
  100% { translate: 0 0; skew: 0deg; }
}

@keyframes fighter-pop-crit {
  0% { opacity: 0; transform: translate(-50%, 0) scale(2.6) rotate(-8deg); }
  12% { opacity: 1; transform: translate(-50%, calc(-6 * var(--u))) scale(1.2) rotate(4deg); }
  18% { transform: translate(calc(-50% - var(--u)), calc(-6 * var(--u))) scale(1.25) rotate(-3deg); }
  24% { transform: translate(calc(-50% + var(--u)), calc(-6 * var(--u))) scale(1.2) rotate(2deg); }
  32% { transform: translate(-50%, calc(-5 * var(--u))) scale(1); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, calc(-20 * var(--u))) scale(0.95); }
}

@keyframes fighter-float {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 calc(-3 * var(--u)); }
}

@keyframes fighter-marker {
  from { translate: -50% 0; }
  to { translate: -50% calc(-2 * var(--u)); }
}

@keyframes fighter-pop {
  0% { opacity: 0; transform: translate(-50%, 0) scale(0.4); }
  15% { opacity: 1; transform: translate(-50%, calc(-4 * var(--u))) scale(1.5); }
  30% { transform: translate(-50%, calc(-3 * var(--u))) scale(1); }
  75% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, calc(-16 * var(--u))) scale(0.9); }
}

// Reduced motion: the player's choice, or the system's (see useMotionPreference).
// The WHOLE selector goes inside :global(): Vue drops whatever follows it.
:global(.combat-motion--reduced .combat-fighter) {
  transition: none;
}

:global(.combat-motion--reduced .combat-fighter__body),
:global(.combat-motion--reduced .combat-fighter__marker) {
  animation: none !important;
}

</style>
