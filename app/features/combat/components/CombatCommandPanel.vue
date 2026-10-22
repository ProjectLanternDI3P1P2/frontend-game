<script setup lang="ts">
/**
 * The parchment at the bottom of the fight, as in the art team's mock-up: the party's
 * gauges on the left, the commands on the right (Fight, Object, Run), and the battle log.
 * Presentational: every choice is an event for the composable.
 */
import type { CommandStep, Gauges } from "../combatRules";
import { canAfford, partyTone, usableItems } from "../combatRules";
import type { Ability, Combatant, CombatItem, FightResponse } from "../types";

const props = defineProps<{
  fight: FightResponse;
  gauges: Record<string, Gauges>;
  /** The hero who must act; undefined while the monsters play or the fight is over. */
  hero: Combatant | undefined;
  shownTurnId: string | null;
  step: CommandStep;
  busy: boolean;
  log: string[];
}>();

defineEmits<{
  fight: [];
  items: [];
  back: [];
  attack: [];
  ability: [ability: Ability];
  item: [item: CombatItem];
  defend: [];
  flee: [];
}>();

const lastLine = computed(() => props.log.at(-1) ?? "");

const prompt = computed(() => {
  if (props.fight.status !== "Active") return "";
  if (!props.hero) return props.busy ? "…" : "The monsters are playing…";
  if (props.step.kind === "target") {
    return props.step.action.type === "Attack" ||
      (props.step.action.type === "Ability" && props.step.action.ability.target === "SingleEnemy")
      ? "Choose a monster."
      : "Choose a hero.";
  }
  return `${props.hero.name}'s turn.`;
});

const gauge = (hero: Combatant) => props.gauges[hero.combatantId] ?? { hp: hero.hp, mana: hero.mana };
const percent = (value: number, max: number) => (max > 0 ? `${(value / max) * 100}%` : "0%");
</script>

<template>
  <section class="combat-panel" aria-label="Fight commands">
    <ul class="combat-panel__party">
      <li
        v-for="(member, index) in fight.heroes"
        :key="member.combatantId"
        class="combat-panel__member"
        :class="[
          'combat-panel__member--' + partyTone(index),
          { 'combat-panel__member--turn': shownTurnId === member.combatantId },
        ]"
      >
        <span class="combat-panel__name">{{ member.name }}</span>
        <span class="combat-panel__bars">
          <meter
            class="combat-panel__bar combat-panel__bar--hp"
            :aria-label="`${member.name} health`"
            :value="gauge(member).hp"
            min="0"
            :max="member.maxHp"
          >
            <span :style="{ inlineSize: percent(gauge(member).hp, member.maxHp) }" />
          </meter>
          <meter
            v-if="member.maxMana > 0"
            class="combat-panel__bar combat-panel__bar--mana"
            :aria-label="`${member.name} mana`"
            :value="gauge(member).mana"
            min="0"
            :max="member.maxMana"
          >
            <span :style="{ inlineSize: percent(gauge(member).mana, member.maxMana) }" />
          </meter>
        </span>
        <span class="combat-panel__numbers">{{ gauge(member).hp }}/{{ member.maxHp }}</span>
      </li>
    </ul>

    <div class="combat-panel__commands">
      <p class="combat-panel__prompt">{{ prompt }}</p>

      <div v-if="step.kind === 'root'" class="combat-panel__buttons">
        <button type="button" class="combat-panel__button" :disabled="!hero" @click="$emit('fight')">
          Fight
        </button>
        <button type="button" class="combat-panel__button" :disabled="!hero" @click="$emit('items')">
          Object
        </button>
        <button
          type="button"
          class="combat-panel__button combat-panel__button--run"
          :disabled="!hero || !fight.canFlee"
          :title="fight.canFlee ? undefined : 'There is no running away from a boss.'"
          @click="$emit('flee')"
        >
          Run
        </button>
      </div>

      <div v-else-if="step.kind === 'fight' && hero" class="combat-panel__buttons">
        <button type="button" class="combat-panel__button" @click="$emit('attack')">Attack</button>
        <button
          v-for="ability in hero.abilities"
          :key="ability.abilityId"
          type="button"
          class="combat-panel__button"
          :disabled="!canAfford(hero, ability)"
          @click="$emit('ability', ability)"
        >
          {{ ability.name }} <small>{{ ability.manaCost }} MP</small>
        </button>
        <button type="button" class="combat-panel__button" @click="$emit('defend')">Defend</button>
        <button type="button" class="combat-panel__button combat-panel__button--back" @click="$emit('back')">
          Back
        </button>
      </div>

      <div v-else-if="step.kind === 'items' && hero" class="combat-panel__buttons">
        <button
          v-for="item in usableItems(hero)"
          :key="item.itemId"
          type="button"
          class="combat-panel__button"
          @click="$emit('item', item)"
        >
          {{ item.name }} <small>x{{ item.quantity }}</small>
        </button>
        <p v-if="usableItems(hero).length === 0" class="combat-panel__empty">The bag is empty.</p>
        <button type="button" class="combat-panel__button combat-panel__button--back" @click="$emit('back')">
          Back
        </button>
      </div>

      <div v-else-if="step.kind === 'target'" class="combat-panel__buttons">
        <button type="button" class="combat-panel__button combat-panel__button--back" @click="$emit('back')">
          Back
        </button>
      </div>
    </div>

    <p class="combat-panel__log">{{ lastLine }}</p>
  </section>
</template>

<style scoped lang="scss">
// The parchment of the mock-up, drawn with the design tokens' parchment palette.
.combat-panel {
  position: relative;
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) minmax(14rem, 1.3fr);
  grid-template-areas:
    "party commands"
    "log log";
  gap: var(--space-2) var(--space-5);
  padding: var(--space-4) var(--space-6) var(--space-3);
  color: var(--palette-charcoal-700);
  background:
    radial-gradient(ellipse at 20% 30%, rgb(255 255 255 / 35%), transparent 60%),
    radial-gradient(ellipse at 80% 80%, rgb(117 101 80 / 25%), transparent 55%),
    var(--palette-parchment-300);
  border: 3px solid var(--palette-parchment-700);
  border-radius: 14px 30px 12px 26px / 26px 12px 30px 14px;
  box-shadow:
    inset 0 0 22px rgb(117 101 80 / 55%),
    0 8px 24px rgb(0 0 0 / 55%);
  font-family: var(--font-family-display);

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
    grid-template-areas: "party" "commands" "log";
    padding: var(--space-3) var(--space-4);
  }

  &__party {
    grid-area: party;
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__member {
    display: grid;
    grid-template-columns: 5rem 1fr auto;
    align-items: center;
    gap: var(--space-2);
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm, 4px);

    &--turn {
      background: rgb(169 127 36 / 25%);
      outline: 1px solid var(--palette-gold-600);
    }

    &--red .combat-panel__name { color: var(--palette-blood-600); }
    &--yellow .combat-panel__name { color: var(--palette-gold-600); }
    &--grey .combat-panel__name { color: var(--palette-obsidian-500); }
    &--blue .combat-panel__name { color: #2f5f9e; }
  }

  &__name {
    font-variant: small-caps;
    font-weight: 700;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__bars {
    display: grid;
    gap: 2px;
  }

  &__bar {
    display: block;
    block-size: 0.7rem;
    overflow: hidden;
    border: 1px solid var(--palette-charcoal-600);
    border-radius: var(--radius-pill);
    background: #fff;

    > span {
      display: block;
      block-size: 100%;
      transition: inline-size 350ms ease-out;
    }

    &--hp > span { background: #e01b1b; }

    &--mana {
      block-size: 0.35rem;
      > span { background: var(--palette-arcane-400); }
    }
  }

  &__numbers {
    min-inline-size: 4.5rem;
    font-family: var(--font-family-mono);
    font-size: var(--font-size-xs);
    text-align: right;
  }

  &__commands {
    grid-area: commands;
    display: grid;
    align-content: start;
    gap: var(--space-2);
  }

  &__prompt {
    margin: 0;
    font-size: var(--font-size-sm);
    font-style: italic;
  }

  &__buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  &__button {
    min-inline-size: 7rem;
    padding: var(--space-1) var(--space-4);
    border: 2px solid var(--palette-charcoal-700);
    border-radius: 10px;
    background: #fff;
    color: var(--palette-charcoal-700);
    font-family: inherit;
    font-size: var(--font-size-sm);
    font-variant: small-caps;
    font-weight: 700;
    cursor: pointer;

    small {
      font-variant: normal;
      font-weight: 400;
      opacity: 0.7;
    }

    &:hover:not(:disabled) {
      background: var(--palette-gold-400);
    }

    &:focus-visible {
      outline: 3px solid var(--color-focus-ring);
      outline-offset: 2px;
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    &--run {
      min-inline-size: 9rem;
    }

    &--back {
      min-inline-size: auto;
      background: transparent;
    }
  }

  &__empty {
    margin: 0;
    align-self: center;
    font-size: var(--font-size-sm);
  }

  &__log {
    grid-area: log;
    min-block-size: 1.3em;
    margin: 0;
    font-size: var(--font-size-sm);
    text-align: center;
  }
}
</style>
