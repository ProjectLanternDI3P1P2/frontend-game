<script lang="ts">
export enum ButtonVariant {
  PRIMARY = "primary",
  SECONDARY = "secondary",
  GHOST = "ghost",
  DANGER = "danger",
}

export enum ButtonSize {
  SM = "sm",
  MD = "md",
  LG = "lg",
}

export enum ButtonType {
  BUTTON = "button",
  SUBMIT = "submit",
  RESET = "reset",
}
</script>

<script setup lang="ts">
/**
 * ADR-FE-009 / ADR-FE-010 — Reusable presentational control.
 * One responsibility, typed props, explicit events, no HTTP call, no business
 * rule. Styled with BEM class names built from design tokens.
 */
withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    type?: ButtonType;
    disabled?: boolean;
    /** Renders a busy state and blocks interaction without removing the button. */
    busy?: boolean;
    fullWidth?: boolean;
  }>(),
  {
    variant: ButtonVariant.PRIMARY,
    size: ButtonSize.MD,
    type: ButtonType.BUTTON,
    disabled: false,
    busy: false,
    fullWidth: false,
  },
);

defineEmits<{ click: [event: MouseEvent] }>();
</script>

<template>
  <button
    class="ui-button"
    :class="[
      'ui-button--' + variant,
      'ui-button--' + size,
      { 'ui-button--busy': busy, 'ui-button--full-width': fullWidth },
    ]"
    :type="type"
    :disabled="disabled || busy"
    :aria-busy="busy"
    @click="$emit('click', $event)"
  >
    <span v-if="busy" class="ui-button__spinner" aria-hidden="true" />
    <span v-else-if="$slots.icon" class="ui-button__icon" aria-hidden="true">
      <slot name="icon" />
    </span>
    <span class="ui-button__label"><slot /></span>
  </button>
</template>

<style scoped lang="scss">
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 2.75rem; // ADR-FE-015: comfortable pointer target.
  padding: var(--space-2) var(--space-5);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-inset);
  font-family: var(--font-family-display);
  letter-spacing: 0.035em;
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--easing-standard);

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--primary {
    background-color: var(--color-accent);
    color: var(--color-text-inverse);
    border-color: var(--color-accent-strong);

    &:hover:not(:disabled) {
      background-color: var(--color-accent-strong);
    }
  }

  &--secondary {
    background-color: var(--color-surface-overlay);
    border-color: var(--color-border-strong);
    color: var(--color-text-primary);
    box-shadow: var(--shadow-inset), var(--shadow-gold);

    &:hover:not(:disabled) {
      background-color: var(--color-surface-raised);
      border-color: var(--color-accent);
    }
  }

  &--ghost {
    background-color: transparent;
    border-color: var(--color-border-strong);
    color: var(--color-text-primary);

    &:hover:not(:disabled) {
      background-color: var(--color-surface-overlay);
    }
  }

  &--danger {
    background-color: var(--color-danger);
    color: var(--color-text-primary);
    border-color: var(--color-danger-strong);

    &:hover:not(:disabled) {
      background-color: var(--color-danger-strong);
    }
  }

  &--busy {
    cursor: progress;
  }

  &--sm {
    min-height: 2.25rem;
    padding: var(--space-1) var(--space-3);
    font-size: var(--font-size-sm);
  }

  &--lg {
    min-height: 3.25rem;
    padding: var(--space-3) var(--space-6);
    font-size: var(--font-size-lg);
  }

  &--full-width {
    width: 100%;
  }

  &__icon {
    display: inline-flex;
  }

  &__spinner {
    width: 1em;
    height: 1em;
    border: 2px solid currentcolor;
    border-right-color: transparent;
    border-radius: var(--radius-pill);
    animation: ui-button-spin var(--duration-slow) linear infinite;
  }

  &__label {
    line-height: 1;
  }
}

@keyframes ui-button-spin {
  to {
    transform: rotate(1turn);
  }
}
</style>
