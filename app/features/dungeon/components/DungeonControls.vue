<script setup lang="ts">
/**
 * On-screen directional pad: the keyboard is not the only way to play
 * (ADR-FE-015), and it is the only way on a touch screen.
 */
import type { Direction } from "../types";

defineProps<{ disabled?: boolean }>();
defineEmits<{ move: [direction: Direction] }>();

const buttons: { direction: Direction; label: string; symbol: string }[] = [
  { direction: "north", label: "Move north", symbol: "▲" },
  { direction: "west", label: "Move west", symbol: "◀" },
  { direction: "east", label: "Move east", symbol: "▶" },
  { direction: "south", label: "Move south", symbol: "▼" },
];
</script>

<template>
  <div class="dungeon-controls" role="group" aria-label="Movement">
    <button
      v-for="button in buttons"
      :key="button.direction"
      type="button"
      :class="['dungeon-controls__button', `dungeon-controls__button--${button.direction}`]"
      :aria-label="button.label"
      :disabled="disabled"
      @click="$emit('move', button.direction)"
    >
      <span aria-hidden="true">{{ button.symbol }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
.dungeon-controls {
  display: grid;
  grid-template-areas:
    ". north ."
    "west . east"
    ". south .";
  grid-template-columns: repeat(3, 2.75rem);
  grid-template-rows: repeat(3, 2.75rem);
  gap: var(--space-1);

  &__button {
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-overlay);
    color: var(--color-text-primary);
    cursor: pointer;

    &:hover:not(:disabled) {
      background-color: var(--color-border-strong);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @each $direction in north, east, south, west {
      &--#{$direction} {
        grid-area: $direction;
      }
    }
  }
}
</style>
