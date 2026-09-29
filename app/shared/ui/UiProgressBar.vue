<script lang="ts">
export enum ProgressTone {
  ACCENT = "accent",
  SUCCESS = "success",
  DANGER = "danger",
  ARCANE = "arcane",
}
</script>

<script setup lang="ts">
withDefaults(
  defineProps<{
    value: number;
    max?: number;
    label?: string;
    tone?: ProgressTone;
    showValue?: boolean;
  }>(),
  { max: 100, label: "", tone: ProgressTone.ACCENT, showValue: false },
);
</script>

<template>
  <div class="ui-progress" :class="'ui-progress--' + tone">
    <div v-if="label || showValue" class="ui-progress__heading">
      <span v-if="label">{{ label }}</span
      ><span v-if="showValue">{{ Math.round((value / max) * 100) }}%</span>
    </div>
    <div
      class="ui-progress__track"
      role="progressbar"
      :aria-label="label"
      :aria-valuemin="0"
      :aria-valuemax="max"
      :aria-valuenow="value"
    >
      <div
        class="ui-progress__value"
        :style="{
          width: Math.min(100, Math.max(0, (value / max) * 100)) + '%',
        }"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.ui-progress {
  display: grid;
  gap: var(--space-2);
}
.ui-progress__heading {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.ui-progress__track {
  height: var(--space-3);
  overflow: hidden;
  border-radius: var(--radius-pill);
  background-color: var(--color-surface-base);
}
.ui-progress__value {
  height: 100%;
  border-radius: inherit;
  background-color: var(--color-accent);
  transition: width var(--duration-slow) var(--easing-standard);
}
.ui-progress--success .ui-progress__value {
  background-color: var(--color-success);
}
.ui-progress--danger .ui-progress__value {
  background-color: var(--color-danger);
}
.ui-progress--arcane .ui-progress__value {
  background-color: var(--color-arcane);
}
</style>
