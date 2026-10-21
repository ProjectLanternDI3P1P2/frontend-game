<script setup lang="ts">
/**
 * One hero of the ranking (CA2, CA6, CA8). A click on the line, or Enter /
 * Space on its toggle button, expands it in place with `RankingRowDetail`;
 * it never opens a profile. My heroes carry a "You" badge; `aria-current`
 * is kept for the line "Jump to my rank" targets.
 */
import { computed } from "vue";
import UiBadge, { BadgeSize, BadgeTone } from "~/shared/ui/UiBadge.vue";
import {
  HERO_CLASS_LABELS,
  displayPlayerName,
  formatRelativeTime,
  formatWinRate,
} from "../leaderboardRules";
import { formatCount } from "../statisticsRules";
import type { RankingEntry } from "../types";
import RankingRankBadge from "./RankingRankBadge.vue";
import RankingRowDetail from "./RankingRowDetail.vue";
import RankingTrend from "./RankingTrend.vue";

const props = defineProps<{
  entry: RankingEntry;
  currentPlayerId: string;
  mine: boolean;
  current: boolean;
  expanded: boolean;
  columns: number;
  now: Date;
}>();

const emit = defineEmits<{ toggle: [heroId: string] }>();

const playerName = computed(() => displayPlayerName(props.entry));
const detailId = computed(() => `ranking-detail-${props.entry.heroId}`);
const toggleLabel = computed(
  () => `${playerName.value}, ${props.entry.heroName}: show details`,
);

function toggle(): void {
  emit("toggle", props.entry.heroId);
}
</script>

<template>
  <tr
    class="ranking-row"
    :class="{
      'ranking-row--me': mine,
      'ranking-row--expanded': expanded,
    }"
    :aria-current="current ? 'true' : undefined"
    @click="toggle"
  >
    <td class="ranking-row__rank"><RankingRankBadge :rank="entry.rank" /></td>
    <td><RankingTrend :delta="entry.rankDelta" /></td>
    <td>
      <span class="ranking-row__player">
        <button
          type="button"
          class="ranking-row__toggle"
          :data-hero-id="entry.heroId"
          :aria-expanded="expanded ? 'true' : 'false'"
          :aria-controls="expanded ? detailId : undefined"
          :aria-label="toggleLabel"
          @click.stop="toggle"
        >
          {{ playerName }}
        </button>
        <UiBadge v-if="mine" :tone="BadgeTone.SUCCESS" :size="BadgeSize.SM"
          >You</UiBadge
        >
      </span>
    </td>
    <th scope="row" class="ranking-row__hero">{{ entry.heroName }}</th>
    <td>{{ HERO_CLASS_LABELS[entry.heroClass] ?? entry.heroClass }}</td>
    <td class="ranking-row__number">{{ entry.level }}</td>
    <td class="ranking-row__number">{{ formatCount(entry.totalXp) }}</td>
    <td class="ranking-row__number">{{ formatCount(entry.runs) }}</td>
    <td class="ranking-row__number">{{ formatWinRate(entry.winRate) }}</td>
    <td class="ranking-row__activity">
      <time v-if="entry.lastActivityAt" :datetime="entry.lastActivityAt">{{
        formatRelativeTime(entry.lastActivityAt, now)
      }}</time>
      <template v-else>Never</template>
    </td>
  </tr>
  <tr v-if="expanded" :id="detailId" class="ranking-row__detail">
    <td :colspan="columns">
      <RankingRowDetail :hero-id="entry.heroId" :current-player-id="currentPlayerId" />
    </td>
  </tr>
</template>

<style scoped lang="scss">
.ranking-row {
  cursor: pointer;

  &:hover {
    background-color: var(--color-surface-overlay);
  }

  &--me {
    background-color: var(--color-surface-overlay);
    box-shadow: inset var(--space-1) 0 0 var(--color-accent);
    font-weight: var(--font-weight-bold);
  }

  &--expanded {
    background-color: var(--color-surface-overlay);
  }

  &__rank {
    white-space: nowrap;
  }

  &__player {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  &__toggle {
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    text-decoration: underline dotted;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }
  }

  &__hero {
    font-weight: inherit;
    text-align: start;
    overflow-wrap: anywhere;
  }

  &__number {
    font-family: var(--font-family-mono);
    font-variant-numeric: tabular-nums;
    text-align: end;
    white-space: nowrap;
  }

  &__activity {
    white-space: nowrap;
  }

  &__detail td {
    background-color: var(--color-surface-base);
  }
}
</style>
