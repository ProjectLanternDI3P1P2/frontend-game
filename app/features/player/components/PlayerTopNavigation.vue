<script setup lang="ts">
const route = useRoute();
const playerId = computed(() => String(route.params.playerId ?? ""));
const playerRoot = computed(() => `/players/${encodeURIComponent(playerId.value)}`);
</script>

<template>
  <header class="player-top-navigation">
    <div class="player-top-navigation__content">
      <NuxtLink class="player-top-navigation__brand" :to="`${playerRoot}/heroes`"
        >Lantern</NuxtLink
      >
      <nav class="player-top-navigation__links" aria-label="Player navigation">
        <NuxtLink :to="`${playerRoot}/play`">Play</NuxtLink>
        <NuxtLink :to="`${playerRoot}/heroes`">Heroes</NuxtLink>
        <NuxtLink class="player-top-navigation__account" to="/">My account</NuxtLink>
      </nav>
    </div>
  </header>
</template>

<style scoped lang="scss">
.player-top-navigation {
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);

  &__content {
    display: flex;
    max-width: 90rem;
    min-height: 3.25rem;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-5);
    padding-inline: var(--layout-gutter);
    margin-inline: auto;
  }

  &__brand {
    color: var(--color-text-highlight);
    font-family: var(--font-family-display);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.035em;
    text-decoration: none;
    text-transform: uppercase;
  }

  &__links {
    display: flex;
    align-items: center;
    gap: var(--space-5);

    a {
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
      text-decoration: none;
    }

    a:hover,
    a.router-link-active {
      color: var(--color-text-highlight);
    }
  }

  &__account {
    border: 1px solid var(--color-accent-strong);
    padding: var(--space-2) var(--space-4);
    background: var(--color-accent);
    color: var(--color-text-inverse) !important;
    font-family: var(--font-family-display);
    font-weight: var(--font-weight-bold);
  }
}

@media (max-width: 36rem) {
  .player-top-navigation {
    &__content {
      align-items: flex-start;
      flex-direction: column;
      padding-block: var(--space-3);
    }

    &__links {
      width: 100%;
      justify-content: space-between;
      gap: var(--space-2);
    }
  }
}
</style>
