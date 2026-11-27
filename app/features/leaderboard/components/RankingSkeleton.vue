<script setup lang="ts">
/**
 * Placeholder lines while the ranking loads (CA10). Hidden from assistive
 * technologies: the loading is announced by the live region of
 * `LeaderboardLoadState`. The shimmer only plays without reduced motion.
 */
withDefaults(defineProps<{ rows?: number }>(), { rows: 10 });
</script>

<template>
  <div class="ranking-skeleton" aria-hidden="true" data-testid="ranking-skeleton">
    <div v-for="row in rows" :key="row" class="ranking-skeleton__row">
      <span class="ranking-skeleton__cell ranking-skeleton__cell--short" />
      <span class="ranking-skeleton__cell" />
      <span class="ranking-skeleton__cell ranking-skeleton__cell--wide" />
      <span class="ranking-skeleton__cell" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.ranking-skeleton {
  display: grid;
  gap: var(--space-2);
  border: 1px solid var(--color-border-subtle);
  padding: var(--space-3);
  background-color: var(--color-surface-raised);

  &__row {
    display: grid;
    grid-template-columns: 1fr 2fr 4fr 2fr;
    gap: var(--space-3);
  }

  &__cell {
    display: block;
    block-size: var(--space-4);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-overlay);

    &--short {
      inline-size: 50%;
    }

    @include bp.motion-safe {
      animation: ranking-skeleton-pulse 1.4s var(--easing-standard) infinite alternate;
    }
  }
}

@keyframes ranking-skeleton-pulse {
  from {
    opacity: 1;
  }

  to {
    opacity: 0.5;
  }
}
</style>
