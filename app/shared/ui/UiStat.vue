<script lang="ts">
export enum StatTone {
  NEUTRAL = "neutral",
  ACCENT = "accent",
  SUCCESS = "success",
  DANGER = "danger",
  ARCANE = "arcane",
}
</script>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    detail?: string;
    tone?: StatTone;
  }>(),
  { detail: "", tone: StatTone.NEUTRAL },
);
</script>

<template>
  <div class="ui-stat" :class="'ui-stat--' + tone">
    <span v-if="$slots.icon" class="ui-stat__icon" aria-hidden="true"
      ><slot name="icon"
    /></span>
    <div>
      <div class="ui-stat__value">{{ value }}</div>
      <div class="ui-stat__label">{{ label }}</div>
      <div v-if="detail" class="ui-stat__detail">{{ detail }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ui-stat {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border-left: var(--space-1) solid var(--color-border-strong);
  background-color: var(--color-surface-raised);
}
.ui-stat__icon {
  display: inline-flex;
  color: var(--color-text-muted);
}
.ui-stat__value {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}
.ui-stat__label,
.ui-stat__detail {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.ui-stat--accent {
  border-color: var(--color-accent);
}
.ui-stat--accent .ui-stat__icon {
  color: var(--color-accent);
}
.ui-stat--success {
  border-color: var(--color-success);
}
.ui-stat--success .ui-stat__icon {
  color: var(--color-success);
}
.ui-stat--danger {
  border-color: var(--color-danger);
}
.ui-stat--danger .ui-stat__icon {
  color: var(--color-danger);
}
.ui-stat--arcane {
  border-color: var(--color-arcane);
}
.ui-stat--arcane .ui-stat__icon {
  color: var(--color-arcane);
}
</style>
