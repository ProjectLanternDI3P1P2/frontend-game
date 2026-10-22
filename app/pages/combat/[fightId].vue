<script setup lang="ts">
/**
 * The fight screen. Client-rendered (ADR-FE-004): see routeRules.
 * Composes the combat feature; holds no rule of its own.
 */
import CombatCommandPanel from "~/features/combat/components/CombatCommandPanel.vue";
import CombatScene from "~/features/combat/components/CombatScene.vue";
import CombatTurnOrder from "~/features/combat/components/CombatTurnOrder.vue";
import { outcomeTitle } from "~/features/combat/combatRules";
import { useCombat } from "~/features/combat/composables/useCombat";
import { useMotionPreference } from "~/features/combat/composables/useMotionPreference";

definePageMeta({ layout: "game" });
useHead({ title: "Fight" });

const route = useRoute();
const combat = useCombat(String(route.params.fightId));
const {
  fight,
  gauges,
  status,
  errorMessage,
  step,
  log,
  announcement,
  busy,
  stage,
  shownTurnId,
  hero,
  targets,
  isOver,
} = combat;

/**
 * Where to go once the fight is over: back to the dungeon, which reads `fight` to apply
 * the outcome; the demo launcher otherwise.
 */
const returnTo = computed(() => {
  const target = route.query.returnTo;
  if (typeof target !== "string" || !target.startsWith("/") || target.startsWith("//")) {
    return "/combat";
  }
  const separator = target.includes("?") ? "&" : "?";
  return `${target}${separator}fight=${encodeURIComponent(String(route.params.fightId))}`;
});

const targetIds = computed(() => targets.value.map((c) => c.combatantId));
const { reduced: reducedMotion, toggle: toggleMotion } = useMotionPreference();

onMounted(() => combat.start());
</script>

<template>
  <div class="combat-page" :class="{ 'combat-motion--reduced': reducedMotion }">
    <p v-if="status === 'loading'" class="combat-page__status">Entering the fight…</p>

    <p v-else-if="status === 'error'" class="combat-page__status" role="alert">
      The fight could not be loaded: {{ errorMessage }}
      <NuxtLink to="/combat">Back</NuxtLink>
    </p>

    <template v-else-if="fight">
      <CombatScene
        :fight="fight"
        :gauges="gauges"
        :stage="stage"
        :shown-turn-id="shownTurnId"
        :awaiting-command="hero !== undefined"
        :target-ids="targetIds"
        @pick="combat.pickTarget"
      />

      <header class="combat-page__hud">
        <span>Floor {{ fight.floor }}</span>
        <span>Round {{ fight.round }}</span>
        <span v-if="fight.encounter !== 'Ordinary'" class="combat-page__boss">
          {{ fight.encounter === "Boss" ? "Boss" : "Sub-boss" }}
        </span>
        <button
          type="button"
          class="combat-page__motion"
          :aria-pressed="!reducedMotion"
          @click="toggleMotion"
        >
          Animations: {{ reducedMotion ? "reduced" : "full" }}
        </button>
      </header>

      <CombatTurnOrder
        v-if="fight.status === 'Active'"
        class="combat-page__turns"
        :fight="fight"
        :shown-turn-id="shownTurnId"
      />

      <div class="combat-page__panel">
        <p v-if="errorMessage" class="combat-page__error" role="alert">{{ errorMessage }}</p>
        <CombatCommandPanel
          :fight="fight"
          :gauges="gauges"
          :hero="hero"
          :shown-turn-id="shownTurnId"
          :step="step"
          :busy="busy"
          :log="log"
          @fight="combat.openFight"
          @items="combat.openItems"
          @back="combat.back"
          @attack="combat.attack"
          @ability="combat.useAbility"
          @item="combat.useItem"
          @defend="combat.defend"
          @flee="combat.flee"
        />
      </div>

      <div v-if="isOver && !busy" class="combat-page__outcome" role="dialog" aria-modal="true" aria-labelledby="combat-outcome">
        <div class="combat-page__outcome-card" :class="'combat-page__outcome-card--' + fight.status.toLowerCase()">
          <h1 id="combat-outcome">{{ outcomeTitle(fight.status) }}</h1>
          <p>
            {{ fight.heroes.filter((h) => !h.isKnockedOut).length }} / {{ fight.heroes.length }}
            heroes standing after {{ fight.round }} rounds.
          </p>
          <NuxtLink :to="returnTo" class="combat-page__continue">Continue</NuxtLink>
        </div>
      </div>

      <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.combat-page {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background-color: #000f0d;

  &__status {
    position: absolute;
    top: 50%;
    left: 50%;
    margin: 0;
    translate: -50% -50%;
    color: var(--color-text-muted);
  }

  &__hud {
    position: absolute;
    z-index: var(--z-overlay);
    top: var(--space-4);
    left: var(--space-4);
    display: flex;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background-color: color-mix(in srgb, var(--color-surface-raised) 82%, transparent);
    font-size: var(--font-size-sm);
  }

  &__boss {
    color: var(--color-danger);
    font-weight: 700;
  }

  &__turns {
    position: absolute;
    z-index: var(--z-overlay);
    top: var(--space-4);
    left: 50%;
    translate: -50% 0;

    // On a narrow screen the HUD takes the top: the order goes under it.
    @media (max-width: 720px) {
      top: calc(var(--space-4) + 3rem);
    }
  }

  &__motion {
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-text-muted);
    font: inherit;
    font-size: var(--font-size-xs);
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }
  }

  &__panel {
    position: absolute;
    z-index: var(--z-overlay);
    left: 50%;
    bottom: var(--space-4);
    translate: -50% 0;
    inline-size: min(60rem, calc(100% - 2 * var(--space-4)));
  }

  &__error {
    margin: 0 0 var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-surface-raised) 90%, transparent);
    color: var(--color-danger);
    font-size: var(--font-size-sm);
  }

  &__outcome {
    position: absolute;
    z-index: calc(var(--z-overlay) + 1);
    inset: 0;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 55%);
  }

  &__outcome-card {
    display: grid;
    gap: var(--space-3);
    justify-items: center;
    padding: var(--space-6) var(--space-7);
    border: 3px solid var(--palette-parchment-700);
    border-radius: 18px;
    background: var(--palette-parchment-300);
    color: var(--palette-charcoal-700);
    font-family: var(--font-family-display);
    text-align: center;

    h1 {
      margin: 0;
      font-size: 2.5rem;
    }

    p {
      margin: 0;
    }

    &--victory h1 { color: var(--palette-gold-600); }
    &--defeat h1 { color: var(--palette-blood-600); }
  }

  &__continue {
    padding: var(--space-2) var(--space-5);
    border: 2px solid var(--palette-charcoal-700);
    border-radius: 10px;
    background: #fff;
    color: inherit;
    font-weight: 700;
    text-decoration: none;
  }
}
</style>
