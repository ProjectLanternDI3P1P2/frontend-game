<script setup lang="ts">
/**
 * Starts an exploration: a new dungeon, or the replay of a shared seed.
 * Client-rendered (ADR-FE-004): declared in nuxt.config.ts → routeRules and
 * justified in docs/rendering-modes.md.
 */
import { useDungeonLauncher } from "~/features/dungeon/composables/useDungeonLauncher";

useHead({ title: "Dungeon" });

const route = useRoute();
const seed = ref(typeof route.query.seed === "string" ? route.query.seed : "");
const { isStarting, errorMessage, start } = useDungeonLauncher();

async function explore(replayedSeed?: string) {
  const runId = await start(replayedSeed);
  if (runId) await navigateTo(`/dungeon/${runId}`);
}
</script>

<template>
  <div class="dungeon-start">
    <h1>Dungeon</h1>
    <p class="dungeon-start__intro">
      Forty rooms, one boss at the end of the longest branch. Every exploration
      draws a new seed; share it to let someone else play the same dungeon.
    </p>

    <UiButton :busy="isStarting" @click="explore()">New exploration</UiButton>

    <form class="dungeon-start__replay" @submit.prevent="explore(seed)">
      <label for="dungeon-seed">Replay a seed</label>
      <div class="dungeon-start__row">
        <input
          id="dungeon-seed"
          v-model="seed"
          class="dungeon-start__input"
          autocomplete="off"
          spellcheck="false"
          placeholder="0KX4-M2T9-QZ7PA"
        >
        <UiButton type="submit" variant="ghost" :disabled="!seed.trim()" :busy="isStarting">
          Replay
        </UiButton>
      </div>
    </form>

    <p v-if="errorMessage" class="dungeon-start__error" role="alert">
      {{ errorMessage }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.dungeon-start {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-5);

  &__intro {
    max-inline-size: 60ch;
    color: var(--color-text-muted);
  }

  &__replay {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  &__row {
    display: flex;
    gap: var(--space-3);
  }

  &__input {
    min-block-size: 2.75rem;
    padding-inline: var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-raised);
    color: var(--color-text-primary);
    font-family: var(--font-family-mono);
    text-transform: uppercase;
  }

  &__error {
    margin: 0;
    color: var(--color-danger);
  }
}
</style>
