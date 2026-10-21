<script setup lang="ts">
import { SEEDED_PLAYER_ID } from "~/features/player/seededPlayer";

/**
 * ADR-FE-015 — Landmarks and the skip link live in the layout so every public
 * page inherits them. The public site targets RGAA compliance with no expected
 * exception: nothing here is a gameplay constraint.
 */
const config = useRuntimeConfig();
const navigationItems = [
  { label: "Home", to: "/home" },
  { label: "Heroes", to: `/players/${SEEDED_PLAYER_ID}/heroes` },
  { label: "Lobby", to: `/players/${SEEDED_PLAYER_ID}/play` },
  { label: "Dungeon", to: "/dungeon" },
  { label: "Leaderboard", to: "/leaderboard" },
  { label: "Demo", to: "/demo" },
];
</script>

<template>
  <div class="site-shell">
    <a class="skip-link" href="#main">Skip to main content</a>

    <UiTopNavigation
      brand="Project Lantern"
      brand-to="/home"
      :items="navigationItems"
    />

    <div class="site-shell__main layout-container">
      <slot />
    </div>

    <footer class="site-shell__footer">
      <div class="layout-container">
        <p>Redwood Games — Project Lantern</p>
        <!-- Build identity, so a deployed page can be traced to a commit. -->
        <p class="site-shell__build">
          Build {{ config.public.appVersion }} ({{ config.public.commitSha }})
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.site-shell {
  display: flex;
  flex-direction: column;
  min-block-size: 100vh;

  &__main {
    flex: 1;
    padding-block: var(--space-7);
  }

  &__footer {
    border-block-start: 1px solid var(--color-border-subtle);
    padding-block: var(--space-5);
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  &__build {
    font-family: var(--font-family-mono);
  }
}
</style>
