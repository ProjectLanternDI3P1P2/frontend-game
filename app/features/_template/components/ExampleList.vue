<script setup lang="ts">
/**
 * TEMPLATE — a feature component.
 *
 * ADR-FE-009 — One responsibility, typed props, no HTTP call of its own.
 * ADR-FE-010 — BEM class names, every value from a design token.
 * ADR-FE-015 — A load failure is announced, not merely coloured.
 */
import type { ExampleResource } from "../types";

defineProps<{
  items: ExampleResource[];
  failed: boolean;
}>();
</script>

<template>
  <div class="example-list">
    <p v-if="failed" class="example-list__error" role="alert">
      This content could not be loaded.
    </p>

    <ul v-else class="example-list__items">
      <li v-for="item in items" :key="item.id" class="example-list__item">
        {{ item.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.example-list {
  &__items {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    list-style: none;
    padding: 0;
    margin: 0;
  }

  &__item {
    padding: var(--space-3);
    background-color: var(--color-surface-raised);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
  }

  &__error {
    margin: 0;
    color: var(--color-danger);
  }
}
</style>
