<script setup lang="ts">
useHead({ title: "Component library" });

const sections = [
  {
    to: "/demo/actions",
    title: "Actions & states",
    description: "Buttons, icons, and badges.",
  },
  {
    to: "/demo/forms",
    title: "Forms",
    description: "Inputs, selects, checkboxes, and switches.",
  },
  {
    to: "/demo/display",
    title: "Game data",
    description: "Panels, avatars, stats, items, and progress.",
  },
  {
    to: "/demo/feedback",
    title: "Feedback & overlays",
    description: "Notices, tabs, and dialogs.",
  },
];
</script>

<template>
  <div class="demo-home">
    <header class="demo-home__hero">
      <p class="demo-home__eyebrow">Project Lantern · UI kit</p>
      <h1>The adventurer’s library</h1>
      <p>
        Reusable, accessible Vue primitives driven by the game design tokens.
      </p>
    </header>
    <nav class="demo-home__grid" aria-label="Component categories">
      <NuxtLink
        v-for="section in sections"
        :key="section.to"
        :to="section.to"
        class="demo-home__card"
      >
        <span class="demo-home__arrow" aria-hidden="true">↗</span>
        <h2>{{ section.title }}</h2>
        <p>{{ section.description }}</p>
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped lang="scss">
.demo-home {
  display: grid;
  gap: var(--space-7);
}
.demo-home__hero {
  display: grid;
  gap: var(--space-3);
  max-width: 48rem;
}
.demo-home__eyebrow {
  color: var(--color-accent);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
}
.demo-home__hero > p:last-child {
  color: var(--color-text-muted);
  font-size: var(--font-size-lg);
}
.demo-home__grid {
  display: grid;
  gap: var(--space-4);
  @include bp.from("md") {
    grid-template-columns: repeat(2, 1fr);
  }
}
.demo-home__card {
  position: relative;
  display: grid;
  gap: var(--space-2);
  min-height: 10rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  background-color: var(--color-surface-raised);
  color: var(--color-text-primary);
  text-decoration: none;
  box-shadow: var(--shadow-sm);
}
.demo-home__card:hover {
  border-color: var(--color-accent);
  background-color: var(--color-surface-overlay);
}
.demo-home__card p {
  color: var(--color-text-muted);
}
.demo-home__arrow {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  color: var(--color-accent);
  font-size: var(--font-size-xl);
}
</style>
