<script lang="ts">
export enum PanelVariant {
  RAISED = "raised",
  OUTLINED = "outlined",
  INSET = "inset",
}

export enum PanelPadding {
  NONE = "none",
  COMPACT = "compact",
  REGULAR = "regular",
}

export enum PanelHeadingLevel {
  TWO = 2,
  THREE = 3,
  FOUR = 4,
}
</script>

<script setup lang="ts">
/** ADR-FE-010 — Surface wrapper. Presentational only. */
defineProps<{
  title?: string;
  /** Heading level, so each page keeps a correct outline (ADR-FE-015). */
  headingLevel?: PanelHeadingLevel;
  variant?: PanelVariant;
  padding?: PanelPadding;
}>();
</script>

<template>
  <section
    class="ui-panel"
    :class="[
      'ui-panel--' + (variant ?? PanelVariant.RAISED),
      'ui-panel--padding-' + (padding ?? PanelPadding.REGULAR),
    ]"
  >
    <header v-if="title || $slots.header || $slots.actions" class="ui-panel__header">
      <component
        :is="`h${headingLevel ?? PanelHeadingLevel.TWO}`"
        class="ui-panel__title"
      >
        <slot name="header">{{ title }}</slot>
      </component>
      <div class="ui-panel__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="ui-panel__body">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss">
.ui-panel {
  background-color: var(--color-surface-raised);
  position: relative;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-gold), var(--shadow-inset);
  overflow: hidden;

  &::before {
    position: absolute;
    inset: 0;
    border: 1px solid var(--color-border-accent);
    border-radius: inherit;
    content: "";
    opacity: 0.35;
    pointer-events: none;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--color-border-accent);
    background-color: var(--color-surface-overlay);
  }

  &__title {
    margin: 0;
    color: var(--color-text-highlight);
    font-family: var(--font-family-display);
    font-size: var(--font-size-lg);
    letter-spacing: 0.04em;
  }

  &__body {
    padding: var(--space-5);
  }

  &--outlined {
    background-color: transparent;
    box-shadow: none;
  }

  &--inset {
    background-color: var(--color-surface-base);
    box-shadow: var(--shadow-sm);
  }

  &--padding-none &__body {
    padding: var(--space-0);
  }

  &--padding-compact &__body {
    padding: var(--space-3);
  }
}
</style>
