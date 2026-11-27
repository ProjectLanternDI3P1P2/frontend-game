<script setup lang="ts">
import { computed } from "vue";
import { formatCount } from "../statisticsRules";
import type { RankingEntry } from "../types";

interface Props {
  entries: RankingEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const props = defineProps<Props>();
const pageCount = computed(() => Math.ceil(props.totalCount / props.pageSize));
const firstRank = computed(() => (props.page - 1) * props.pageSize + 1);
const lastRank = computed(() =>
  Math.min(props.page * props.pageSize, props.totalCount),
);
</script>

<template>
  <section class="public-ranking-page" aria-labelledby="public-ranking-page-title">
    <h2 id="public-ranking-page-title" class="public-ranking-page__title">
      Full ranking
    </h2>
    <p v-if="entries.length > 0" class="public-ranking-page__summary">
      Heroes {{ formatCount(firstRank) }}–{{ formatCount(lastRank) }} of
      {{ formatCount(totalCount) }}
    </p>
    <p v-else class="public-ranking-page__summary">No heroes on this page.</p>

    <div v-if="entries.length > 0" class="public-ranking-page__scroller">
      <table class="public-ranking-page__table">
        <caption class="visually-hidden">
          Heroes ranked by total XP, page
          {{
            page
          }}
          of
          {{
            pageCount
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Hero</th>
            <th scope="col" class="public-ranking-page__number">Total XP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.heroId">
            <td>{{ formatCount(entry.rank) }}</td>
            <th scope="row">{{ entry.heroName }}</th>
            <td class="public-ranking-page__number">
              {{ formatCount(entry.totalXp) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav class="public-ranking-page__pagination" aria-label="Ranking pages">
      <NuxtLink
        v-if="page > 1"
        :to="page === 2 ? '/rankings' : `/rankings?page=${page - 1}`"
      >
        Previous 50
      </NuxtLink>
      <span>Page {{ page }} of {{ Math.max(1, pageCount) }}</span>
      <NuxtLink v-if="page < pageCount" :to="`/rankings?page=${page + 1}`">
        Next 50
      </NuxtLink>
    </nav>
  </section>
</template>

<style scoped lang="scss">
.public-ranking-page {
  display: grid;
  gap: var(--space-3);

  &__title,
  &__summary {
    margin: 0;
  }

  &__title {
    font-size: var(--font-size-lg);
  }

  &__summary {
    color: var(--color-text-muted);
  }

  &__scroller {
    overflow-x: auto;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-raised);
  }

  th,
  td {
    padding: var(--space-2);
    border-block-end: 1px solid var(--color-border-subtle);
    text-align: start;
  }

  tbody th {
    overflow-wrap: anywhere;
  }

  &__number {
    text-align: end;
    font-family: var(--font-family-mono);
    font-variant-numeric: tabular-nums;
  }

  &__pagination {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);

    a:focus-visible {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }
  }
}
</style>
