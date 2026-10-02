<script setup lang="ts">
/**
 * Full-screen shell of the game screens: no site header or footer, the game
 * takes the whole window. ADR-FE-015 — the skip link and the main landmark
 * are kept, as in the default layout.
 */
</script>

<template>
  <div class="game-shell">
    <a class="skip-link" href="#main">Skip to main content</a>

    <main id="main" class="game-shell__main">
      <slot />
    </main>
  </div>
</template>

<style scoped lang="scss">
.game-shell {
  block-size: 100dvh;
  overflow: hidden;

  &__main {
    position: relative;
    block-size: 100%;
  }
}
</style>
