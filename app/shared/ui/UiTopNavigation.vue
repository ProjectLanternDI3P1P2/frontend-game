<script setup lang="ts">
export interface TopNavigationItem {
  label: string;
  to: string;
}

defineProps<{
  brand: string;
  brandTo: string;
  items: readonly TopNavigationItem[];
}>();
</script>

<template>
  <header class="top-navigation">
    <div class="top-navigation__content">
      <NuxtLink class="top-navigation__brand" :to="brandTo">{{ brand }}</NuxtLink>
      <nav class="top-navigation__links" aria-label="Main navigation">
        <NuxtLink v-for="item in items" :key="item.to" :to="item.to">
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div v-if="$slots.actions" class="top-navigation__actions">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.top-navigation {
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);

  &__content {
    display: flex;
    max-width: 90rem;
    min-height: 3.25rem;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-5);
    padding-inline: var(--layout-gutter);
    margin-inline: auto;
  }

  &__brand {
    color: var(--color-text-highlight);
    font-family: var(--font-family-display);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.035em;
    text-decoration: none;
    text-transform: uppercase;
  }

  &__links {
    display: flex;
    align-items: center;
    gap: var(--space-5);

    a {
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
      text-decoration: none;
    }

    a:hover,
    a.router-link-active {
      color: var(--color-text-highlight);
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
}

@media (max-width: 36rem) {
  .top-navigation {
    &__content {
      align-items: flex-start;
      flex-direction: column;
      padding-block: var(--space-3);
    }

    &__links {
      width: 100%;
      justify-content: space-between;
      gap: var(--space-2);
    }

    &__actions {
      align-self: flex-end;
    }
  }
}
</style>
