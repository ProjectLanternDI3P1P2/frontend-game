<script lang="ts">
export type SelectOption = {
  label: string;
  value: string | number;
  disabled?: boolean;
};
</script>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string | number | undefined;
    options: SelectOption[];
    label?: string;
    hint?: string;
    error?: string;
    id?: string;
    name?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
  }>(),
  {
    label: "",
    hint: "",
    error: "",
    id: "",
    name: "",
    placeholder: "",
    disabled: false,
    required: false,
  },
);

defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <label
    class="ui-select"
    :class="{ 'ui-select--error': error, 'ui-select--disabled': disabled }"
    :for="id"
  >
    <span v-if="label" class="ui-select__label"
      >{{ label }} <span v-if="required" aria-hidden="true">*</span></span
    >
    <select
      :id="id"
      :value="modelValue"
      :name="name"
      :disabled="disabled"
      :required="required"
      :aria-invalid="Boolean(error)"
      :aria-describedby="
        hint || error ? (id ? id + '-description' : undefined) : undefined
      "
      @change="
        $emit('update:modelValue', ($event.target as HTMLSelectElement).value)
      "
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="String(option.value)"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
    <span
      v-if="error || hint"
      :id="id ? id + '-description' : undefined"
      class="ui-select__hint"
      >{{ error || hint }}</span
    >
  </label>
</template>

<style scoped lang="scss">
.ui-select {
  display: grid;
  gap: var(--space-2);
}
.ui-select__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}
.ui-select select {
  width: 100%;
  min-height: 2.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  padding-inline: var(--space-3);
  background-color: var(--color-surface-base);
  box-shadow: var(--shadow-inset);
}
.ui-select__hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.ui-select--error select {
  border-color: var(--color-danger);
}
.ui-select--error .ui-select__hint {
  color: var(--color-danger);
}
.ui-select--disabled {
  opacity: 0.55;
}
</style>
