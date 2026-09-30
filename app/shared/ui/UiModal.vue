<script lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

export enum ModalSize {
  SM = "sm",
  MD = "md",
  LG = "lg",
}
</script>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    size?: ModalSize;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    showCloseButton?: boolean;
    dialogClass?: string;
    bodyClass?: string;
    /** Keep the modal frame and header fixed; a child owns scrolling. */
    scrollBody?: boolean;
  }>(),
  {
    title: "",
    size: ModalSize.MD,
    closeOnBackdrop: true,
    closeOnEscape: true,
    showCloseButton: true,
    dialogClass: "",
    bodyClass: "",
    scrollBody: true,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  close: [];
}>();
const close = () => {
  emit("update:modelValue", false);
  emit("close");
};
const onKeydown = (event: KeyboardEvent) => {
  if (props.modelValue && props.closeOnEscape && event.key === "Escape") close();
};

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="ui-modal" role="presentation">
      <button
        v-if="closeOnBackdrop"
        class="ui-modal__backdrop"
        type="button"
        aria-label="Close dialog"
        @click="close"
      />
      <dialog
        class="ui-modal__dialog"
        :class="[
          'ui-modal__dialog--' + size,
          dialogClass,
          { 'ui-modal__dialog--fixed-body': !scrollBody },
        ]"
        :aria-label="title"
        :open="modelValue"
        tabindex="-1"
      >
        <header
          v-if="title || $slots.header || showCloseButton"
          class="ui-modal__header"
        >
          <h2 v-if="title" class="ui-modal__title">{{ title }}</h2>
          <slot name="header" />
          <UiIconButton v-if="showCloseButton" label="Close dialog" @click="close"
            >×</UiIconButton
          >
        </header>
        <div
          class="ui-modal__body"
          :class="[bodyClass, { 'ui-modal__body--fixed': !scrollBody }]"
        ><slot /></div>
        <footer v-if="$slots.footer" class="ui-modal__footer">
          <slot name="footer" />
        </footer>
      </dialog>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.ui-modal {
  position: fixed;
  z-index: var(--z-overlay);
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background-color: rgb(0 0 0 / 65%);
}
.ui-modal__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: transparent;
  cursor: default;
}
.ui-modal__dialog {
  position: relative;
  z-index: var(--z-content);
  width: min(100%, 34rem);
  max-height: min(42rem, 100%);
  overflow: auto;
  border: 1px solid var(--color-border-accent);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-raised);
  box-shadow: var(--shadow-lg), var(--shadow-gold), var(--shadow-inset);
}
.ui-modal__dialog--sm {
  max-width: 25rem;
}
.ui-modal__dialog--lg {
  max-width: 48rem;
}
.ui-modal__dialog--fixed-body {
  display: flex;
  height: min(42rem, calc(100dvh - var(--space-8)));
  flex-direction: column;
  overflow: hidden;
}
.ui-modal__header,
.ui-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
}
.ui-modal__header {
  border-bottom: 1px solid var(--color-border-accent);
}
.ui-modal__footer {
  justify-content: flex-end;
  border-top: 1px solid var(--color-border-accent);
}
.ui-modal__title {
  margin: 0;
  color: var(--color-text-highlight);
  font-family: var(--font-family-display);
  font-size: var(--font-size-xl);
}
.ui-modal__body {
  padding: var(--space-5);
}
.ui-modal__body--fixed {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}
</style>
