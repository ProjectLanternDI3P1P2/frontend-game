<script setup lang="ts">
import { BadgeSize, BadgeTone } from "./UiBadge.vue";

/**
 * Presentational hero summary used by list, selection, detail and run-start
 * flows. It owns no API call and receives its actions through slots.
 */
export interface HeroCardHero {
  id: string;
  name: string;
  classCode: string;
  level: number;
  maximumHealth: number;
  isEngagedInActiveSession: boolean;
}

withDefaults(
  defineProps<{
    hero: HeroCardHero;
    selected?: boolean;
    interactive?: boolean;
  }>(),
  { selected: false, interactive: false },
);

defineEmits<{ select: [] }>();
</script>

<template>
  <article
    class="ui-hero-card"
    :class="{
      'ui-hero-card--selected': selected,
      'ui-hero-card--engaged': hero.isEngagedInActiveSession,
    }"
  >
    <button
      v-if="interactive"
      class="ui-hero-card__select"
      type="button"
      :aria-pressed="selected"
      :aria-label="`Select ${hero.name}`"
      @click="$emit('select')"
    >
      <span class="ui-hero-card__identity">
        <span class="ui-hero-card__name">{{ hero.name }}</span>
        <span class="ui-hero-card__class">{{ hero.classCode }}</span>
      </span>
      <span class="ui-hero-card__values">
        <span>Level {{ hero.level }}</span>
        <span>{{ hero.maximumHealth }} HP</span>
      </span>
    </button>
    <div v-else class="ui-hero-card__content">
      <span class="ui-hero-card__identity">
        <span class="ui-hero-card__name">{{ hero.name }}</span>
        <span class="ui-hero-card__class">{{ hero.classCode }}</span>
      </span>
      <span class="ui-hero-card__values">
        <span>Level {{ hero.level }}</span>
        <span>{{ hero.maximumHealth }} HP</span>
      </span>
    </div>
    <UiBadge
      v-if="hero.isEngagedInActiveSession"
      class="ui-hero-card__status"
      :tone="BadgeTone.DANGER"
      :size="BadgeSize.SM"
      >In session</UiBadge
    >
    <UiBadge
      v-else-if="selected"
      class="ui-hero-card__status"
      :tone="BadgeTone.SUCCESS"
      :size="BadgeSize.SM"
      >Selected</UiBadge
    >
    <div v-if="$slots.actions" class="ui-hero-card__actions">
      <slot name="actions" />
    </div>
  </article>
</template>

<style scoped lang="scss">
.ui-hero-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: center;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-inset);

  &--selected {
    border-color: var(--color-accent);
    box-shadow: var(--shadow-gold), var(--shadow-inset);
  }

  &--engaged {
    border-color: var(--color-danger);
  }

  &__content,
  &__select {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  &__select {
    width: 100%;
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  &__select:focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: var(--space-2);
  }

  &__identity,
  &__values {
    display: grid;
    gap: var(--space-1);
  }

  &__identity {
    min-width: 0;
  }

  &__name {
    overflow: hidden;
    color: var(--color-text-highlight);
    font-family: var(--font-family-display);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__class,
  &__values {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  &__values {
    justify-items: end;
    white-space: nowrap;
  }

  &__status {
    grid-column: 2;
  }

  &__actions {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
}
</style>
