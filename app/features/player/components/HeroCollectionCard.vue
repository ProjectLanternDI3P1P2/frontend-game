<script setup lang="ts">
import type { HeroSummary } from "../types";
import HeroPortraitPlaceholder from "./HeroPortraitPlaceholder.vue";

const props = defineProps<{
  hero: HeroSummary;
  selected?: boolean;
  to: string;
}>();

const createdAt = computed(() => {
  if (!props.hero.createdAt) return null;
  const date = new Date(props.hero.createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
});
</script>

<template>
  <NuxtLink
    class="hero-collection-card"
    :class="{
      'hero-collection-card--selected': selected,
      'hero-collection-card--engaged': hero.isEngagedInActiveSession,
    }"
    :to="to"
    :aria-label="`View ${hero.name}'s hero sheet`"
  >
    <span class="hero-collection-card__flag">
      {{ selected ? "Selected" : hero.isEngagedInActiveSession ? "In session" : "" }}
    </span>
    <span class="hero-collection-card__portrait">
      <HeroPortraitPlaceholder
        :class-code="hero.classCode"
        :label="`${hero.name} portrait`"
      />
    </span>
    <span class="hero-collection-card__name">{{ hero.name }}</span>
    <span class="hero-collection-card__class">{{ hero.classCode }}</span>
    <span class="hero-collection-card__details">
      Level {{ hero.level }} · {{ hero.maximumHealth }} HP
    </span>
    <span class="hero-collection-card__created">{{
      createdAt ? `Created ${createdAt}` : "Created —"
    }}</span>
  </NuxtLink>
</template>

<style scoped lang="scss">
.hero-collection-card {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 10.25rem;
  align-content: start;
  gap: var(--space-1);
  border: 1px solid var(--color-border-subtle);
  padding: var(--space-3);
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
  text-decoration: none;
  transition:
    border-color var(--duration-fast) var(--easing-standard),
    background-color var(--duration-fast) var(--easing-standard);

  &:hover {
    border-color: var(--color-accent-strong);
    background: var(--color-surface-base);
  }

  &--selected {
    border-color: var(--color-accent);
    box-shadow: var(--shadow-gold);
  }

  &--engaged:not(&--selected) {
    border-color: var(--color-arcane);
  }

  &__flag {
    min-height: 1rem;
    color: var(--color-text-highlight);
    font-size: 0.625rem;
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.12em;
    line-height: 1;
    text-transform: uppercase;
  }

  &__portrait {
    display: grid;
    min-height: 5.5rem;
    margin-block: var(--space-1) var(--space-2);
    place-items: center;
    background: var(--color-surface-overlay);
  }

  &__name {
    overflow: hidden;
    color: var(--color-text-primary);
    font-family: var(--font-family-display);
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-bold);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__class,
  &__details,
  &__created {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    line-height: var(--line-height-tight);
  }

  &__class {
    text-transform: capitalize;
  }

  &__details {
    margin-top: var(--space-1);
  }

  &__created {
    margin-top: auto;
  }
}
</style>
