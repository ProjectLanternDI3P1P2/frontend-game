<script setup lang="ts">
import { usePlayerApi } from "../api/playerApi";
const currentPlayerRoute = "me";
import type { HeroSummary } from "../types";
import HeroCollectionCard from "./HeroCollectionCard.vue";

const heroes = ref<HeroSummary[]>([]);
const loading = ref(true);
const error = ref("");

async function loadHeroes() {
  loading.value = true;
  error.value = "";
  try {
    heroes.value = await usePlayerApi().listHeroes(currentPlayerRoute);
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Unable to load the seeded heroes.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadHeroes);
</script>

<template>
  <main id="main" class="player-home">
    <header class="player-home__header">
      <p class="player-home__eyebrow">Demo account</p>
      <h1>Choose your hero</h1>
      <p>
        MaelisRune's roster is ready to explore. Pick a hero or start a solo dungeon.
      </p>
    </header>
    <p v-if="loading" class="player-home__message" aria-live="polite">
      Loading heroes…
    </p>
    <div
      v-else-if="error"
      class="player-home__message player-home__message--error"
      role="alert"
    >
      <p>{{ error }}</p>
      <UiButton @click="loadHeroes">Retry</UiButton>
    </div>
    <section v-else class="player-home__heroes" aria-label="MaelisRune's heroes">
      <HeroCollectionCard
        v-for="hero in heroes"
        :key="hero.id"
        :hero="hero"
        :selected="hero.isSelected"
        :to="`/players/${currentPlayerRoute}/heroes/${hero.id}`"
      />
    </section>
    <NuxtLink class="player-home__dungeon-link" to="/dungeon"
      >Start a solo dungeon</NuxtLink
    >
  </main>
</template>

<style scoped lang="scss">
.player-home {
  display: flex;
  flex-direction: column;
  width: min(100% - (var(--layout-gutter) * 2), 72rem);
  gap: var(--space-5);
  padding-block: var(--space-7);
  margin-inline: auto;
}
.player-home__header > * {
  margin: 0;
}
.player-home__header > p:last-child {
  max-inline-size: 58ch;
  margin-top: var(--space-3);
  color: var(--color-text-muted);
}
.player-home__eyebrow {
  color: var(--color-text-highlight);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.player-home h1 {
  margin-top: var(--space-1);
  color: var(--color-text-primary);
  font-size: var(--font-size-xl);
  text-transform: uppercase;
}
.player-home__heroes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--space-4);
}
.player-home__message {
  margin: 0;
  border: 1px solid var(--color-border-subtle);
  padding: var(--space-4);
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
}
.player-home__message--error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  border-inline-start: var(--space-1) solid var(--color-danger);
}
.player-home__message--error p {
  margin: 0;
}
.player-home__dungeon-link {
  align-self: start;
  color: var(--color-text-highlight);
  font-family: var(--font-family-display);
  font-weight: var(--font-weight-bold);
}
</style>
