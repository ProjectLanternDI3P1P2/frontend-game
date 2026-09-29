<script lang="ts">
export enum BadgeTone {
  NEUTRAL = "neutral",
  SUCCESS = "success",
  DANGER = "danger",
  ARCANE = "arcane",
  RARITY = "rarity",
}

export enum BadgeSize {
  SM = "sm",
  MD = "md",
}
</script>

<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: BadgeTone;
    size?: BadgeSize;
    outlined?: boolean;
  }>(),
  { tone: BadgeTone.NEUTRAL, size: BadgeSize.MD, outlined: false },
);
</script>

<template>
  <span
    class="ui-badge"
    :class="[
      'ui-badge--' + tone,
      'ui-badge--' + size,
      { 'ui-badge--outlined': outlined },
    ]"
  >
    <slot />
  </span>
</template>

<style scoped lang="scss">
.ui-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  width: fit-content;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-2);
  background-color: var(--color-surface-overlay);
  color: var(--color-text-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  box-shadow: var(--shadow-inset);

  &--md {
    padding: var(--space-1) var(--space-3);
    font-size: var(--font-size-sm);
  }

  &--success {
    background-color: var(--color-success);
    color: var(--color-text-inverse);
  }
  &--danger {
    background-color: var(--color-danger);
    color: var(--color-text-primary);
  }
  &--arcane {
    background-color: var(--color-arcane);
    color: var(--color-text-primary);
  }
  &--rarity {
    background-color: var(--color-rarity-rare);
    color: var(--color-text-inverse);
  }

  &--outlined {
    background-color: transparent;
    border-color: currentcolor;
  }
}
</style>
