<script setup lang="ts">
/** The page heading: the only `h1`, who is signed in, and the public rankings link (CA1, CA12). */
defineProps<{ playerName: string }>();
</script>

<template>
  <header class="ranking-header">
    <div class="ranking-header__heading">
      <p class="ranking-header__eyebrow">Hero ranking</p>
      <h1 class="ranking-header__title">Leaderboard</h1>
      <p class="ranking-header__signed-in">
        Signed in as <strong>{{ playerName }}</strong>
      </p>
    </div>
    <NuxtLink to="/rankings" class="ranking-header__public">Public rankings</NuxtLink>
  </header>
</template>

<style scoped lang="scss">
.ranking-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);

  &__heading {
    display: grid;
    gap: var(--space-2);
  }

  &__eyebrow {
    margin: 0;
    color: var(--color-text-highlight);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-xl);
  }

  &__signed-in {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  &__public {
    color: var(--color-text-highlight);

    &:focus-visible {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }
  }

  @include bp.from("md") {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;

    &__title {
      font-size: var(--font-size-2xl);
    }
  }
}
</style>
