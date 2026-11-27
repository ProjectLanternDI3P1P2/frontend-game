<script setup lang="ts">
/**
 * F05 (CA5) — Said when the final boss of the floor could not be located: the
 * floor received breaks the boss invariant (`findFloorBoss`). The exploration
 * stays on screen; the player may read the run and the floor again.
 * Presentational: the page wires `reload` to the explorer.
 */
import UiButton from "~/shared/ui/UiButton.vue";
import { ButtonSize, ButtonVariant } from "~/shared/ui/ui.types";

defineProps<{
  /** A reload is in flight: the button waits for it. */
  loading: boolean;
}>();

const emit = defineEmits<{ reload: [] }>();
</script>

<template>
  <div class="dungeon-boss-notice" role="alert">
    <p class="dungeon-boss-notice__message">
      The final boss of this floor could not be located.
    </p>
    <UiButton
      :variant="ButtonVariant.SECONDARY"
      :size="ButtonSize.SM"
      :busy="loading"
      @click="emit('reload')"
    >
      Reload floor
    </UiButton>
  </div>
</template>

<style scoped lang="scss">
.dungeon-boss-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  border-inline-start: 3px solid var(--color-danger);

  &__message {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }
}
</style>
