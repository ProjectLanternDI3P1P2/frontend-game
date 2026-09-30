<script lang="ts">
export enum InputType {
  TEXT = "text",
  EMAIL = "email",
  PASSWORD = "password",
  NUMBER = "number",
  SEARCH = "search",
}
</script>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string | number;
    label?: string;
    hint?: string;
    error?: string;
    id?: string;
    type?: InputType;
    placeholder?: string;
    name?: string;
    autocomplete?: string;
    maxLength?: number;
    disabled?: boolean;
    required?: boolean;
  }>(),
  {
    label: "",
    hint: "",
    error: "",
    id: "",
    type: InputType.TEXT,
    placeholder: "",
    name: "",
    autocomplete: "",
    maxLength: undefined,
    disabled: false,
    required: false,
  },
);

defineEmits<{
  "update:modelValue": [value: string | number];
  blur: [];
}>();
</script>

<template>
  <label
    class="ui-input"
    :class="{ 'ui-input--error': error, 'ui-input--disabled': disabled }"
    :for="id"
  >
    <span v-if="label" class="ui-input__label"
      >{{ label }} <span v-if="required" aria-hidden="true">*</span></span
    >
    <span class="ui-input__control">
      <span v-if="$slots.prefix" class="ui-input__adornment"
        ><slot name="prefix"
      /></span>
      <input
        :id="id"
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        :name="name"
        :autocomplete="autocomplete"
        :maxlength="maxLength"
        :disabled="disabled"
        :required="required"
        :aria-invalid="Boolean(error)"
        :aria-describedby="
          hint || error ? (id ? id + '-description' : undefined) : undefined
        "
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @blur="$emit('blur')"
      />
      <span v-if="$slots.suffix" class="ui-input__adornment"
        ><slot name="suffix"
      /></span>
    </span>
    <span
      v-if="error || hint"
      :id="id ? id + '-description' : undefined"
      class="ui-input__hint"
    >
      {{ error || hint }}
    </span>
  </label>
</template>

<style scoped lang="scss">
.ui-input {
  display: grid;
  gap: var(--space-2);
  color: var(--color-text-primary);
}
.ui-input__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}
.ui-input__control {
  display: flex;
  align-items: center;
  min-height: 2.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-base);
  box-shadow: var(--shadow-inset);
}
.ui-input input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  padding: var(--space-2) var(--space-3);
  background: transparent;
}
.ui-input__adornment {
  display: inline-flex;
  padding-inline: var(--space-3);
  color: var(--color-text-muted);
}
.ui-input__hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.ui-input--error .ui-input__control {
  border-color: var(--color-danger);
}
.ui-input--error .ui-input__hint {
  color: var(--color-danger);
}
.ui-input--disabled {
  opacity: 0.55;
}
</style>
