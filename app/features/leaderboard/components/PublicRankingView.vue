<script setup lang="ts">
/**
 * Public, indexable rankings (F04, decision D11): podium, leaders by class and
 * top 10. Presentational: the page reads the state (`usePublicRanking`) and
 * hands it over, so this view renders the same on the server and the client.
 */
import { computed } from "vue";
import {
  formatFreshness,
  formatRankedHeroes,
  type PublicRankingState,
} from "../composables/usePublicRanking";
import { LoadStatus } from "../types";
import LeaderboardLoadState from "./LeaderboardLoadState.vue";
import PublicClassLeaders from "./PublicClassLeaders.vue";
import PublicPodium from "./PublicPodium.vue";
import PublicTopTable from "./PublicTopTable.vue";

const props = withDefaults(
  defineProps<{ state: PublicRankingState; refreshing?: boolean }>(),
  { refreshing: false },
);

defineEmits<{ retry: [] }>();

const ranking = computed(() => props.state.ranking);
const seasonLabel = computed(() => ranking.value?.season?.label?.trim() || "");
const title = computed(() =>
  seasonLabel.value ? `Rankings · ${seasonLabel.value}` : "Rankings",
);
const freshness = computed(() => formatFreshness(ranking.value?.consolidatedAt));
const hasData = computed(
  () =>
    props.state.status === LoadStatus.READY || props.state.status === LoadStatus.EMPTY,
);
</script>

<template>
  <main id="main" class="public-ranking">
    <header class="public-ranking__header">
      <div class="public-ranking__heading">
        <p class="public-ranking__eyebrow">Public rankings</p>
        <h1 class="public-ranking__title">{{ title }}</h1>
        <p v-if="hasData" class="public-ranking__meta">
          <time v-if="freshness.datetime" :datetime="freshness.datetime">{{
            freshness.label
          }}</time>
          <span v-else>{{ freshness.label }}</span>
          <span aria-hidden="true"> · </span>
          <span>{{ formatRankedHeroes(ranking?.totalCount ?? 0) }}</span>
        </p>
      </div>
      <NuxtLink to="/leaderboard" class="public-ranking__cta"
        >Claim your place</NuxtLink
      >
    </header>

    <LeaderboardLoadState
      :loading="state.status === LoadStatus.LOADING || refreshing"
      :loading-label="refreshing ? 'Refreshing rankings…' : 'Loading rankings…'"
      :failed="state.status === LoadStatus.ERROR"
      :error="state.errorMessage"
      error-title="The rankings could not be loaded"
      @retry="$emit('retry')"
    />

    <div v-if="state.status === LoadStatus.EMPTY" class="public-ranking__empty">
      <p class="public-ranking__empty-title">No ranked run yet</p>
      <p class="public-ranking__empty-hint">
        Finish a dungeon run to take the first place of
        {{ seasonLabel || "the season" }}.
      </p>
    </div>

    <template v-else-if="state.status === LoadStatus.READY && ranking">
      <PublicPodium v-if="ranking.podium.length > 0" :entries="ranking.podium" />
      <PublicClassLeaders
        :season-label="seasonLabel || 'Season'"
        :leaders="ranking.leadersByClass"
      />
      <PublicTopTable v-if="ranking.top.length > 0" :entries="ranking.top" />
    </template>
  </main>
</template>

<style scoped lang="scss">
.public-ranking {
  display: grid;
  gap: var(--space-6);

  &__header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
  }

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

  &__meta {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  &__cta {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem; // ADR-FE-015: comfortable pointer target.
    border: 1px solid var(--color-accent-strong);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-5);
    background-color: var(--color-accent);
    color: var(--color-text-inverse);
    font-weight: var(--font-weight-bold);
    text-decoration: none;

    &:hover {
      background-color: var(--color-accent-strong);
    }

    &:focus-visible {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }

    @include bp.motion-safe {
      transition: background-color 150ms ease;
    }
  }

  &__empty {
    display: grid;
    gap: var(--space-2);
    border: 1px dashed var(--color-border-strong);
    padding: var(--space-5);
    text-align: center;
  }

  &__empty-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
  }

  &__empty-hint {
    margin: 0;
    color: var(--color-text-muted);
  }

  @include bp.from("md") {
    &__header {
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
    }

    &__title {
      font-size: var(--font-size-2xl);
    }
  }
}
</style>
