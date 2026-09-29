<script lang="ts">
export type Tab = { id: string; label: string; disabled?: boolean };
</script>

<script setup lang="ts">
defineProps<{ modelValue: string; tabs: Tab[]; label?: string }>();
defineEmits<{ "update:modelValue": [id: string] }>();
</script>

<template>
  <div class="ui-tabs">
    <div class="ui-tabs__list" role="tablist" :aria-label="label">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="ui-tabs__tab"
        :class="{ 'ui-tabs__tab--active': modelValue === tab.id }"
        type="button"
        role="tab"
        :aria-selected="modelValue === tab.id"
        :disabled="tab.disabled"
        @click="$emit('update:modelValue', tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="ui-tabs__panel" role="tabpanel">
      <slot :active-tab="modelValue" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.ui-tabs__list {
  display: flex;
  gap: var(--space-1);
  overflow-x: auto;
  border-bottom: 1px solid var(--color-border-accent);
}
.ui-tabs__tab {
  flex: none;
  border: 0;
  border-bottom: 2px solid transparent;
  padding: var(--space-3) var(--space-4);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}
.ui-tabs__tab--active {
  border-color: var(--color-text-highlight);
  color: var(--color-text-highlight);
  font-family: var(--font-family-display);
}
.ui-tabs__tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ui-tabs__panel {
  padding-top: var(--space-4);
}
</style>
