<script setup lang="ts">
/**
 * ADR-FE-015 — Landmarks and the skip link live in the layout so every public
 * page inherits them. The public site targets RGAA compliance with no expected
 * exception: nothing here is a gameplay constraint.
 */
const config = useRuntimeConfig();
</script>

<template>
  <div class="site-shell">
    <a class="skip-link" href="#main">Skip to main content</a>

    <header class="site-shell__header">
      <div class="layout-container site-shell__bar">
        <NuxtLink to="/" class="site-shell__brand">Project Lantern</NuxtLink>

        <nav class="site-shell__nav" aria-label="Main">
          <NuxtLink to="/demo">UI kit</NuxtLink>
        </nav>
      </div>
    </header>

    <main id="main" class="site-shell__main layout-container">
      <slot />
    </main>

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

  &__header {
    border-block-end: 1px solid var(--color-border-subtle);
    background-color: var(--color-surface-raised);
  }

  &__bar {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    min-block-size: 3.5rem;
  }

  &__brand {
    font-family: var(--font-family-display);
    font-size: var(--font-size-lg);
    color: var(--color-text-primary);
    text-decoration: none;
  }

  &__nav {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
  }

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
