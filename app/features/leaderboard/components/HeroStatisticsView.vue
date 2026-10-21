<script setup lang="ts">
/**
 * Hero statistics screen (CA1–CA5). Data comes through `useHeroStatistics`,
 * which goes through `api/`; this view never knows whether it is simulated.
 */
import { computed } from "vue";
import { useHeroStatistics } from "../composables/useHeroStatistics";
import { LoadStatus } from "../types";
import ConsolidationStatus from "./ConsolidationStatus.vue";
import HeroStatisticsGroups from "./HeroStatisticsGroups.vue";
import LeaderboardLoadState from "./LeaderboardLoadState.vue";

const props = defineProps<{ playerId: string; heroId: string }>();

const { status, groups, consolidation, errorMessage, retry } = useHeroStatistics(
  () => props.playerId,
  () => props.heroId,
);

const heroPath = computed(
  () =>
    `/players/${encodeURIComponent(props.playerId)}/heroes/${encodeURIComponent(props.heroId)}`,
);
</script>

<template>
  <main id="main" class="hero-statistics">
    <header class="hero-statistics__header">
      <div class="hero-statistics__heading">
        <p class="hero-statistics__eyebrow">Progression</p>
        <h1 class="hero-statistics__title">Hero statistics</h1>
        <ConsolidationStatus
          v-if="status === LoadStatus.READY && consolidation"
          :consolidation="consolidation"
        />
      </div>
      <NuxtLink class="hero-statistics__back" :to="heroPath">← Back to hero</NuxtLink>
    </header>

    <LeaderboardLoadState
      :loading="status === LoadStatus.LOADING"
      loading-label="Loading statistics…"
      :error="status === LoadStatus.ERROR ? errorMessage : ''"
      error-title="Statistics could not be loaded"
      @retry="retry"
    />

    <HeroStatisticsGroups v-if="status === LoadStatus.READY" :groups="groups" />
  </main>
</template>

<style scoped lang="scss">
.hero-statistics {
  display: grid;
  gap: var(--space-5);

  &__header {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
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

  &__back {
    font-family: var(--font-family-display);
    font-size: var(--font-size-sm);
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
