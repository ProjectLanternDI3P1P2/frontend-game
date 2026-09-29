<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean;
    label: string;
    description?: string;
    id?: string;
    name?: string;
    disabled?: boolean;
  }>(),
  { description: "", id: "", name: "", disabled: false },
);

defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>

<template>
  <label
    class="ui-switch"
    :class="{ 'ui-switch--disabled': disabled }"
    :for="id"
  >
    <span class="ui-switch__content"
      ><span>{{ label }}</span
      ><small v-if="description">{{ description }}</small></span
    >
    <input
      :id="id"
      type="checkbox"
      :name="name"
      role="switch"
      :checked="modelValue"
      :disabled="disabled"
      @change="
        $emit('update:modelValue', ($event.target as HTMLInputElement).checked)
      "
    />
    <span class="ui-switch__track" aria-hidden="true"
      ><span class="ui-switch__thumb"
    /></span>
  </label>
</template>

<style scoped lang="scss">
.ui-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  cursor: pointer;
}
.ui-switch__content {
  display: grid;
  gap: var(--space-1);
}
.ui-switch small {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.ui-switch input {
  position: absolute;
  opacity: 0;
}
.ui-switch__track {
  display: flex;
  align-items: center;
  width: 2.75rem;
  height: 1.5rem;
  padding: var(--space-1);
  border-radius: var(--radius-pill);
  background-color: var(--color-border-strong);
  transition: background-color var(--duration-fast) var(--easing-standard);
}
.ui-switch__thumb {
  width: 1rem;
  height: 1rem;
  border-radius: var(--radius-pill);
  background-color: var(--color-text-primary);
  transition: transform var(--duration-fast) var(--easing-standard);
}
.ui-switch input:checked + .ui-switch__track {
  background-color: var(--color-accent);
}
.ui-switch input:checked + .ui-switch__track .ui-switch__thumb {
  transform: translateX(1.25rem);
  background-color: var(--color-text-inverse);
}
.ui-switch input:focus-visible + .ui-switch__track {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
.ui-switch--disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
