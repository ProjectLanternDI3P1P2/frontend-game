<script setup lang="ts">
import type { HeroClassOption } from "../types";
import HeroPortraitPlaceholder from "./HeroPortraitPlaceholder.vue";

defineProps<{
  heroClass: HeroClassOption;
  selected: boolean;
}>();

defineEmits<{ select: [] }>();
</script>

<template>
  <button
    class="hero-class-selection-card"
    :class="{ 'hero-class-selection-card--selected': selected }"
    type="button"
    role="radio"
    :aria-checked="selected"
    @click="$emit('select')"
  >
    <span class="hero-class-selection-card__status">{{
      selected ? "Chosen" : ""
    }}</span>
    <HeroPortraitPlaceholder
      :class-code="heroClass.code"
      :label="`${heroClass.label} placeholder`"
    />
    <strong>{{ heroClass.label }}</strong>
    <span>{{ heroClass.description }}</span>
    <small>Base health · {{ heroClass.baseHealth }}</small>
  </button>
</template>

<style scoped lang="scss">
.hero-class-selection-card {
  display: grid;
  min-height: 10.5rem;
  align-content: start;
  justify-items: start;
  gap: var(--space-2);
  border: 1px solid var(--color-border-subtle);
  padding: var(--space-3);
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: var(--color-border-strong);
    background: var(--color-surface-base);
  }

  &--selected {
    border-color: var(--color-accent);
    background: var(--color-surface-overlay);
    box-shadow: var(--shadow-gold);
  }

  &__status {
    min-height: 0.75rem;
    justify-self: end;
    color: var(--color-text-highlight);
    font-size: 0.5625rem;
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  strong {
    font-family: var(--font-family-display);
    font-size: var(--font-size-md);
  }

  > span:not(.hero-class-selection-card__status) {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    line-height: var(--line-height-tight);
  }

  small {
    margin-top: auto;
    color: var(--color-text-highlight);
    font-size: 0.625rem;
  }
}
</style>
