<script setup lang="ts">
/**
 * One page of the hero ranking in a semantic table (D8). The current player's
 * heroes carry a "You" badge and `aria-current`, never colour alone.
 * F00: minimal columns (Rank, Hero, Total XP); F02 brings the full table.
 */
import UiBadge, { BadgeSize, BadgeTone } from "~/shared/ui/UiBadge.vue";
import { formatCount } from "../statisticsRules";
import type { RankingEntry } from "../types";

const props = defineProps<{
  entries: RankingEntry[];
  currentPlayerId: string;
}>();

function isMine(entry: RankingEntry): boolean {
  return entry.playerId !== null && entry.playerId === props.currentPlayerId;
}
</script>

<template>
  <div class="leaderboard-table">
    <table class="leaderboard-table__table">
      <caption class="visually-hidden">
        Hero ranking, by total XP
      </caption>
      <thead>
        <tr>
          <th scope="col" class="leaderboard-table__rank">Rank</th>
          <th scope="col">Hero</th>
          <th scope="col" class="leaderboard-table__xp">Total XP</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="entry in entries"
          :key="entry.heroId"
          class="leaderboard-table__row"
          :class="{ 'leaderboard-table__row--me': isMine(entry) }"
          :aria-current="isMine(entry) ? 'true' : undefined"
          :tabindex="isMine(entry) ? -1 : undefined"
        >
          <td class="leaderboard-table__rank">{{ entry.rank }}</td>
          <th scope="row">
            <span class="leaderboard-table__hero">
              <span class="leaderboard-table__name">{{ entry.heroName }}</span>
              <UiBadge
                v-if="isMine(entry)"
                :tone="BadgeTone.SUCCESS"
                :size="BadgeSize.SM"
                >You</UiBadge
              >
            </span>
          </th>
          <td class="leaderboard-table__xp">{{ formatCount(entry.totalXp) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped lang="scss">
.leaderboard-table {
  display: grid;
  gap: var(--space-3);

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

    &.leaderboard-table__xp {
      text-align: end;
    }
  }

  thead th {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__rank {
    inline-size: 3.5rem;
    font-family: var(--font-family-mono);
    font-variant-numeric: tabular-nums;
  }

  &__xp {
    font-family: var(--font-family-mono);
    font-variant-numeric: tabular-nums;
    text-align: end;
    white-space: nowrap;
  }

  &__hero {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  tbody th {
    font-weight: inherit;
  }

  &__name {
    overflow-wrap: anywhere;
  }

  &__row--me {
    background-color: var(--color-surface-overlay);
    box-shadow: inset var(--space-1) 0 0 var(--color-accent);
    font-weight: var(--font-weight-bold);
  }

  &__row:focus {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: -2px;
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
