<script setup lang="ts">
/**
 * One card per hero class with its best hero (F04 CA4). Every class gets its
 * card, even when the response leaves it out ("No ranked hero yet").
 */
import { computed } from "vue";
import { HERO_CLASS_LABELS, displayPlayerName } from "../leaderboardRules";
import { formatCount } from "../statisticsRules";
import { HeroClass, type PublicRankingResponse } from "../types";

const props = defineProps<{
  seasonLabel: string;
  leaders: PublicRankingResponse["leadersByClass"];
}>();

const cards = computed(() =>
  Object.values(HeroClass).map((heroClass) => ({
    heroClass,
    entry:
      props.leaders.find((leader) => leader.heroClass === heroClass)?.entry ?? null,
  })),
);
</script>

<template>
  <section class="public-class-leaders" aria-labelledby="public-class-leaders-title">
    <h2 id="public-class-leaders-title" class="public-class-leaders__title">
      {{ seasonLabel }} leaders by class
    </h2>
    <ul role="list" class="public-class-leaders__list">
      <li
        v-for="leader in cards"
        :key="leader.heroClass"
        class="public-class-leaders__card"
      >
        <h3 class="public-class-leaders__class">
          {{ HERO_CLASS_LABELS[leader.heroClass] }}
        </h3>
        <template v-if="leader.entry">
          <p class="public-class-leaders__hero">{{ leader.entry.heroName }}</p>
          <p class="public-class-leaders__meta">
            {{ displayPlayerName(leader.entry) }} · Rank {{ leader.entry.rank }} · Level
            {{ leader.entry.level }}
          </p>
          <p class="public-class-leaders__xp">
            {{ formatCount(leader.entry.totalXp) }} XP
          </p>
        </template>
        <p v-else class="public-class-leaders__none">No ranked hero yet</p>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.public-class-leaders {
  display: grid;
  gap: var(--space-3);

  &__title {
    margin: 0;
    font-size: var(--font-size-lg);
  }

  &__list {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__card {
    display: grid;
    align-content: start;
    gap: var(--space-1);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
    padding: var(--space-4);
    background-color: var(--color-surface-raised);
  }

  &__class {
    margin: 0;
    color: var(--color-text-highlight);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  &__hero {
    margin: 0;
    font-family: var(--font-family-display);
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-bold);
    overflow-wrap: anywhere;
  }

  &__meta,
  &__none {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  &__xp {
    margin: 0;
    font-family: var(--font-family-mono);
    font-variant-numeric: tabular-nums;
  }

  @include bp.from("md") {
    &__list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
}
</style>
