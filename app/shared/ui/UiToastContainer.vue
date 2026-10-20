<script setup lang="ts">
import { useToast } from "~/shared/composables/useToast";

const { toasts, remove } = useToast();
</script>

<template>
  <Teleport to="body">
    <section class="ui-toast-container" aria-label="Notifications">
      <TransitionGroup name="ui-toast">
        <UiToast
          v-for="toast in toasts"
          :key="toast.id"
          :toast="toast"
          @close="remove(toast.id)"
        />
      </TransitionGroup>
    </section>
  </Teleport>
</template>

<style lang="scss">
.ui-toast-container {
  position: fixed;
  right: var(--space-5);
  bottom: var(--space-5);
  z-index: var(--z-toast);
  display: grid;
  justify-items: end;
  gap: var(--space-3);
  pointer-events: none;
}

.ui-toast-container > * {
  pointer-events: auto;
}

.ui-toast-enter-active,
.ui-toast-leave-active {
  transition:
    opacity var(--duration-slow) var(--easing-standard),
    transform var(--duration-slow) var(--easing-standard);
}

.ui-toast-enter-from,
.ui-toast-leave-to {
  opacity: 0;
  transform: translateX(var(--space-5));
}

@media (max-width: 36rem) {
  .ui-toast-container {
    right: var(--space-3);
    bottom: var(--space-3);
  }
}
</style>
