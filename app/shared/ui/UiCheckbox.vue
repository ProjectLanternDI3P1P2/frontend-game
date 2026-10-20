<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean;
    label?: string;
    hint?: string;
    id?: string;
    name?: string;
    disabled?: boolean;
  }>(),
  { label: "", hint: "", id: "", name: "", disabled: false },
);

defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>

<template>
  <label class="ui-checkbox" :class="{ 'ui-checkbox--disabled': disabled }" :for="id">
    <input
      :id="id"
      type="checkbox"
      :name="name"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="ui-checkbox__box" aria-hidden="true">✓</span>
    <span class="ui-checkbox__content">
      <span v-if="label || $slots.default" class="ui-checkbox__label"
        ><slot>{{ label }}</slot></span
      >
      <span v-if="hint" class="ui-checkbox__hint">{{ hint }}</span>
    </span>
  </label>
</template>

<style scoped lang="scss">
.ui-checkbox {
  display: inline-flex;
  align-items: flex-start;
  gap: var(--space-2);
  cursor: pointer;
}
.ui-checkbox input {
  position: absolute;
  opacity: 0;
}
.ui-checkbox__box {
  display: grid;
  place-items: center;
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  margin-top: var(--space-1);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  color: transparent;
}
.ui-checkbox input:checked + .ui-checkbox__box {
  border-color: var(--color-accent);
  background-color: var(--color-accent);
  color: var(--color-text-inverse);
}
.ui-checkbox input:focus-visible + .ui-checkbox__box {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
.ui-checkbox__content {
  display: grid;
  gap: var(--space-1);
}
.ui-checkbox__hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.ui-checkbox--disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
