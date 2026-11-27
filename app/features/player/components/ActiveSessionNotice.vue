<script setup lang="ts">
import { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import { NoticeTone } from "~/shared/ui/UiNotice.vue";

defineProps<{ resuming: boolean; error: string }>();
defineEmits<{ resume: []; dismiss: [] }>();
</script>

<template>
  <UiNotice
    title="This hero is already in a game"
    :tone="NoticeTone.WARNING"
    dismissible
    @dismiss="$emit('dismiss')"
  >
    <p class="active-session-notice__text">Resume that game, or choose another hero.</p>
    <p v-if="error" class="active-session-notice__error" role="alert">{{ error }}</p>
    <UiButton
      :size="ButtonSize.SM"
      :variant="ButtonVariant.PRIMARY"
      :busy="resuming"
      @click="$emit('resume')"
      >{{ resuming ? "Resuming…" : "Resume game" }}</UiButton
    >
  </UiNotice>
</template>

<style scoped lang="scss">
.active-session-notice__text,
.active-session-notice__error {
  margin: 0 0 var(--space-2);
}
.active-session-notice__error {
  color: var(--color-danger);
}
</style>
