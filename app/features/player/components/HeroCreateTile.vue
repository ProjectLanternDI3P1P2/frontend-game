<script setup lang="ts">
defineProps<{
  to: string;
  availableSlots: number;
}>();
</script>

<template>
  <NuxtLink class="hero-create-tile" :to="to">
    <span class="hero-create-tile__plus" aria-hidden="true">+</span>
    <span class="hero-create-tile__label">Create a hero</span>
    <span class="hero-create-tile__slots">{{ availableSlots }} open slots</span>
  </NuxtLink>
</template>

<style scoped lang="scss">
.hero-create-tile {
  display: grid;
  min-height: 10.25rem;
  place-content: center;
  gap: var(--space-2);
  border: 1px dashed var(--color-border-subtle);
  color: var(--color-text-muted);
  text-align: center;
  text-decoration: none;

  &:hover {
    border-color: var(--color-accent);
    color: var(--color-text-highlight);
  }

  &__plus {
    color: var(--color-text-highlight);
    font-size: var(--font-size-xl);
    line-height: 1;
  }

  &__label {
    color: var(--color-text-primary);
    font-family: var(--font-family-display);
    font-size: var(--font-size-sm);
  }

  &__slots {
    font-size: var(--font-size-xs);
  }
}
</style>
