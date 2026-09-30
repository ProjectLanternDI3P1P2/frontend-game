<script setup lang="ts">
import PlayerTopNavigation from "~/features/player/components/PlayerTopNavigation.vue";
</script>

<template>
  <div class="player-layout">
    <a class="skip-link" href="#main">Skip to main content</a>
    <PlayerTopNavigation />
    <slot />
  </div>
</template>

<style scoped lang="scss">
.player-layout {
  min-height: 100vh;
  background: var(--color-surface-base);
}
</style>
