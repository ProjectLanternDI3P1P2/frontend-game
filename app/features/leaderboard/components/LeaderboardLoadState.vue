<script setup lang="ts">
/**
 * Loading and error states shared by the two leaderboard pages (CA5, CA10).
 * The live region is always rendered so that its changes are announced.
 */
import UiButton, { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import UiNotice, { NoticeTone } from "~/shared/ui/UiNotice.vue";

defineProps<{
  loading: boolean;
  loadingLabel: string;
  /** Empty when there is no error. */
  error: string;
  errorTitle: string;
}>();

defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="leaderboard-load-state">
    <p class="leaderboard-load-state__live" aria-live="polite">
      <template v-if="loading">{{ loadingLabel }}</template>
    </p>
    <UiNotice v-if="error" :tone="NoticeTone.DANGER" :title="errorTitle">
      <p class="leaderboard-load-state__message">{{ error }}</p>
      <UiButton
        :size="ButtonSize.SM"
        :variant="ButtonVariant.SECONDARY"
        @click="$emit('retry')"
        >Retry</UiButton
      >
    </UiNotice>
  </div>
</template>

<style scoped lang="scss">
.leaderboard-load-state {
  display: grid;
  gap: var(--space-3);

  &__live {
    margin: 0;
    color: var(--color-text-muted);

    &:empty {
      display: none;
    }
  }

  &__message {
    margin: 0 0 var(--space-3);
  }
}
</style>
