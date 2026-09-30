<script setup lang="ts">
import { IconButtonSize } from "./UiIconButton.vue";
import type { Toast } from "~/shared/composables/useToast";

defineProps<{ toast: Toast }>();
defineEmits<{ close: [] }>();
</script>

<template>
  <article
    class="ui-toast"
    :class="`ui-toast--${toast.tone}`"
    :role="toast.tone === 'danger' ? 'alert' : 'status'"
  >
    <span class="ui-toast__indicator" aria-hidden="true">●</span>
    <div class="ui-toast__content">
      <strong v-if="toast.title">{{ toast.title }}</strong>
      <p>{{ toast.message }}</p>
    </div>
    <UiIconButton
      class="ui-toast__close"
      label="Close notification"
      :size="IconButtonSize.SM"
      @click="$emit('close')"
      >×</UiIconButton
    >
  </article>
</template>

<style scoped lang="scss">
.ui-toast {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  width: min(calc(100vw - (var(--space-5) * 2)), 25rem);
  gap: var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-left: var(--space-1) solid var(--color-arcane);
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-md);
  color: var(--color-text-primary);

  &--success {
    border-left-color: var(--color-success);
  }

  &--warning {
    border-left-color: var(--color-accent);
  }

  &--danger {
    border-left-color: var(--color-danger);
  }

  &__indicator {
    color: var(--color-arcane);
    font-size: var(--font-size-sm);
    line-height: 2.25rem;
  }

  &--success &__indicator {
    color: var(--color-success);
  }

  &--warning &__indicator {
    color: var(--color-accent);
  }

  &--danger &__indicator {
    color: var(--color-danger);
  }

  &__content {
    min-width: 0;
    padding-block: var(--space-2);
  }

  &__content strong,
  &__content p {
    margin: 0;
  }

  &__content p {
    margin-top: var(--space-1);
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    overflow-wrap: anywhere;
  }

  &__close {
    margin: calc(var(--space-1) * -1);
  }
}
</style>
