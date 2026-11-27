<script setup lang="ts">
/**
 * The ten best heroes in a semantic table (F04 CA5). The trend arrow is
 * decorative; its meaning is spelled out for assistive technologies (RGAA).
 */
import {
  HERO_CLASS_LABELS,
  RankDeltaDirection,
  displayPlayerName,
  formatRankDelta,
} from "../leaderboardRules";
import { formatCount } from "../statisticsRules";
import type { RankingEntry } from "../types";

defineProps<{ entries: RankingEntry[] }>();

function places(count: number): string {
  return `${count} ${count === 1 ? "place" : "places"}`;
}

/** "Up 3 places", "Down 2 places", "No change", "New in the ranking". */
function describeTrend(delta: number | null): string {
  const trend = formatRankDelta(delta);
  const count = Math.abs(Math.trunc(delta ?? 0));
  switch (trend.direction) {
    case RankDeltaDirection.UP:
      return `Up ${places(count)}`;
    case RankDeltaDirection.DOWN:
      return `Down ${places(count)}`;
    case RankDeltaDirection.STABLE:
      return "No change";
    default:
      return "New in the ranking";
  }
}
</script>

<template>
  <section class="public-top-table" aria-labelledby="public-top-table-title">
    <h2 id="public-top-table-title" class="public-top-table__title">Top 10</h2>
    <div class="public-top-table__scroller">
      <table class="public-top-table__table">
        <caption class="visually-hidden">
          Top 10 heroes, by total XP
        </caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Trend</th>
            <th scope="col">Player</th>
            <th scope="col">Hero</th>
            <th scope="col">Class</th>
            <th scope="col" class="public-top-table__number">Level</th>
            <th scope="col" class="public-top-table__number">Total XP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.heroId">
            <td class="public-top-table__rank">{{ entry.rank }}</td>
            <td>
              <span
                class="public-top-table__trend"
                :class="`public-top-table__trend--${formatRankDelta(entry.rankDelta).direction}`"
              >
                <span aria-hidden="true">{{
                  formatRankDelta(entry.rankDelta).label
                }}</span>
                <span class="visually-hidden">{{
                  describeTrend(entry.rankDelta)
                }}</span>
              </span>
            </td>
            <td class="public-top-table__text">{{ displayPlayerName(entry) }}</td>
            <th scope="row" class="public-top-table__text">{{ entry.heroName }}</th>
            <td>{{ HERO_CLASS_LABELS[entry.heroClass] ?? entry.heroClass }}</td>
            <td class="public-top-table__number">{{ entry.level }}</td>
            <td class="public-top-table__number">{{ formatCount(entry.totalXp) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped lang="scss">
.public-top-table {
  display: grid;
  gap: var(--space-3);

  &__title {
    margin: 0;
    font-size: var(--font-size-lg);
  }

  &__scroller {
    overflow-x: auto;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid var(--color-border-subtle);
    background-color: var(--color-surface-raised);
    font-size: var(--font-size-sm);
  }

  th,
  td {
    padding: var(--space-2);
    border-block-end: 1px solid var(--color-border-subtle);
    text-align: start;
    vertical-align: middle;
    white-space: nowrap;
  }

  thead th {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  tbody th {
    font-weight: var(--font-weight-bold);
  }

  th.public-top-table__number,
  td.public-top-table__number {
    font-family: var(--font-family-mono);
    font-variant-numeric: tabular-nums;
    text-align: end;
  }

  &__rank {
    font-family: var(--font-family-mono);
    font-variant-numeric: tabular-nums;
  }

  th.public-top-table__text,
  td.public-top-table__text {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  &__trend {
    font-family: var(--font-family-mono);
    font-size: var(--font-size-xs);

    &--up {
      color: var(--color-success);
    }

    // RGAA 3.2: every trend text reaches 4.5:1 on the table surface; the
    // arrow and the spoken label carry the direction, not the colour.
    &--down {
      color: var(--color-text-primary);
    }

    &--stable {
      color: var(--color-text-muted);
    }

    &--new {
      color: var(--color-text-highlight);
      font-weight: var(--font-weight-bold);
    }
  }

  @include bp.from("md") {
    th,
    td {
      padding: var(--space-3) var(--space-4);
    }

    &__table {
      font-size: var(--font-size-md);
    }
  }
}
</style>
