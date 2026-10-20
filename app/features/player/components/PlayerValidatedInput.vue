<script setup lang="ts">
import { InputType } from "~/shared/ui/UiInput.vue";

export interface TextValidationRule {
  message: string;
  isValid: (value: string) => boolean;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    rules: readonly TextValidationRule[];
    id: string;
    label: string;
    hint?: string;
    serverError?: string;
    placeholder?: string;
    autocomplete?: string;
    maxLength?: number;
    required?: boolean;
  }>(),
  {
    hint: "",
    serverError: "",
    placeholder: "",
    autocomplete: "off",
    maxLength: undefined,
    required: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "validity-change": [isValid: boolean];
}>();

const touched = ref(false);
const clientError = ref("");
const visibleError = computed(
  () => props.serverError || (touched.value ? clientError.value : ""),
);

function validationError(value: string): string {
  return props.rules.find((rule) => !rule.isValid(value))?.message ?? "";
}

function setValidity(value: string) {
  clientError.value = validationError(value);
  emit("validity-change", !clientError.value && !props.serverError);
}

function update(value: string) {
  emit("update:modelValue", value);
  setValidity(value);
}

function validate(): boolean {
  touched.value = true;
  setValidity(props.modelValue);
  return !clientError.value && !props.serverError;
}

defineExpose({ validate });
</script>

<template>
  <UiInput
    :id="id"
    :model-value="modelValue"
    :label="label"
    :hint="hint"
    :error="visibleError"
    :type="InputType.TEXT"
    :placeholder="placeholder"
    :autocomplete="autocomplete"
    :max-length="maxLength"
    :required="required"
    @update:model-value="update(String($event))"
    @blur="
      touched = true;
      setValidity(modelValue);
    "
  />
</template>
