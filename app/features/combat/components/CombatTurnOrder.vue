<script setup lang="ts">
/**
 * Who plays next: the rest of the round, as the service ordered it (fastest first), the
 * active fighter in front. Heroes wear their party colour, monsters red.
 */
import type { PartyTone } from "../combatRules";
import { findCombatant, partyTone } from "../combatRules";
import type { FightResponse } from "../types";

const props = defineProps<{
  fight: FightResponse;
  /** The turn shown while the events replay. */
  shownTurnId: string | null;
}>();

interface Slot {
  id: string;
  name: string;
  initial: string;
  tone: PartyTone | "monster";
  isActive: boolean;
}

const slots = computed<Slot[]>(() => {
  const order = [...props.fight.upcomingTurns];
  // While replaying, the fighter on stage leads even if the service has moved on.
  if (props.shownTurnId && order[0] !== props.shownTurnId) {
    order.unshift(props.shownTurnId);
  }
  return [...new Set(order)].flatMap((id) => {
    const combatant = findCombatant(props.fight, id);
    if (!combatant) return [];
    const heroIndex = props.fight.heroes.indexOf(combatant);
    return [
      {
        id,
        name: combatant.name,
        initial: combatant.name.charAt(0),
        tone: heroIndex >= 0 ? partyTone(heroIndex) : "monster",
        isActive: id === props.shownTurnId,
      },
    ];
  });
});
</script>

<template>
  <ol class="turn-order" aria-label="Turn order">
    <li
      v-for="slot in slots"
      :key="slot.id"
      class="turn-order__slot"
      :class="['turn-order__slot--' + slot.tone, { 'turn-order__slot--active': slot.isActive }]"
      :title="slot.name"
    >
      <span class="turn-order__initial" aria-hidden="true">{{ slot.initial }}</span>
      <span class="visually-hidden">{{ slot.name }}</span>
    </li>
  </ol>
</template>

<style scoped lang="scss">
.turn-order {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-pill);
  background-color: color-mix(in srgb, var(--color-surface-raised) 82%, transparent);
  list-style: none;

  &__slot {
    --tone: var(--palette-parchment-300);

    display: grid;
    place-items: center;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border: 2px solid var(--tone);
    border-radius: 50%;
    background: color-mix(in srgb, var(--tone) 25%, var(--palette-obsidian-800));
    color: var(--color-text-primary);
    font-family: var(--font-family-display);
    font-size: var(--font-size-sm);
    font-weight: 700;
    opacity: 0.75;
    transition:
      scale 200ms ease-out,
      opacity 200ms;

    &--red { --tone: #e2563f; }
    &--yellow { --tone: var(--palette-gold-400); }
    &--grey { --tone: #b8bfcc; }
    &--blue { --tone: #6aa9f0; }
    &--monster { --tone: var(--palette-blood-400); }

    &--active {
      scale: 1.3;
      opacity: 1;
      box-shadow: 0 0 0.6rem var(--tone);
    }
  }
}
</style>
