<script lang="ts">
import { IconButtonSize } from "./UiIconButton.vue";

export enum NoticeTone {
  INFO = "info",
  SUCCESS = "success",
  WARNING = "warning",
  DANGER = "danger",
}
</script>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    tone?: NoticeTone;
    dismissible?: boolean;
  }>(),
  { title: "", tone: NoticeTone.INFO, dismissible: false },
);

defineEmits<{ dismiss: [] }>();
</script>

<template>
  <section
    class="ui-notice"
    :class="'ui-notice--' + tone"
    :role="tone === NoticeTone.DANGER ? 'alert' : 'status'"
  >
    <div class="ui-notice__content">
      <strong v-if="title">{{ title }}</strong>
      <div><slot /></div>
    </div>
    <UiIconButton
      v-if="dismissible"
      label="Close message"
      :size="IconButtonSize.SM"
      @click="$emit('dismiss')"
      >×</UiIconButton
    >
  </section>
</template>

<style scoped lang="scss">
.ui-notice {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  border: 1px solid var(--color-arcane);
  border-left-width: var(--space-1);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  background-color: var(--color-surface-overlay);
}
.ui-notice__content {
  display: grid;
  gap: var(--space-1);
}
.ui-notice--success {
  border-color: var(--color-success);
}
.ui-notice--warning {
  border-color: var(--color-accent);
}
.ui-notice--danger {
  border-color: var(--color-danger);
}
</style>
