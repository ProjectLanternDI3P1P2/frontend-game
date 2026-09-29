<script lang="ts">
import { ButtonType } from "./UiButton.vue";

export enum IconButtonVariant {
  GHOST = "ghost",
  OUTLINE = "outline",
  FILLED = "filled",
  DANGER = "danger",
}

export enum IconButtonSize {
  SM = "sm",
  MD = "md",
}
</script>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    variant?: IconButtonVariant;
    size?: IconButtonSize;
    type?: ButtonType;
    disabled?: boolean;
  }>(),
  {
    variant: IconButtonVariant.GHOST,
    size: IconButtonSize.MD,
    type: ButtonType.BUTTON,
    disabled: false,
  },
);

defineEmits<{ click: [event: MouseEvent] }>();
</script>

<template>
  <button
    class="ui-icon-button"
    :class="['ui-icon-button--' + variant, 'ui-icon-button--' + size]"
    :type="type"
    :disabled="disabled"
    :aria-label="label"
    :title="label"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style scoped lang="scss">
.ui-icon-button {
  display: inline-grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background-color: transparent;
  color: var(--color-text-primary);
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    background-color: var(--color-surface-overlay);
  }
  &--sm {
    width: 2.25rem;
    height: 2.25rem;
  }
  &--outline {
    border-color: var(--color-border-strong);
    background-color: var(--color-surface-raised);
  }
  &--filled {
    background-color: var(--color-surface-overlay);
  }
  &--danger {
    color: var(--color-danger);
    &:hover:not(:disabled) {
      background-color: var(--color-surface-overlay);
    }
  }
}
</style>
