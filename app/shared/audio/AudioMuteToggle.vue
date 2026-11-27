<script setup lang="ts">
/**
 * ADR-FE-016 / ADR-FE-015 — The mute toggle of the game client: a real button
 * whose pressed state is announced, with a stable name ("Mute sound"). The
 * choice is kept by the shared audio engine.
 */
import { computed } from "vue";
import UiButton from "~/shared/ui/UiButton.vue";
import { ButtonSize, ButtonVariant } from "~/shared/ui/ui.types";
import { useAudio } from "./useAudio";

const audio = useAudio();
const muted = computed(() => audio.preferences.value.muted);
</script>

<template>
  <UiButton
    class="audio-mute-toggle"
    :class="{ 'audio-mute-toggle--muted': muted }"
    :variant="ButtonVariant.GHOST"
    :size="ButtonSize.SM"
    :aria-pressed="muted ? 'true' : 'false'"
    aria-keyshortcuts="M"
    @click="audio.toggleMuted()"
  >
    <span aria-hidden="true">{{ muted ? "🔇" : "🔊" }}</span>
    Mute sound
  </UiButton>
</template>

<style scoped lang="scss">
.audio-mute-toggle {
  gap: var(--space-2);

  &--muted {
    color: var(--color-text-muted);
  }
}
</style>
