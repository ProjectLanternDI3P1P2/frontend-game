<script setup lang="ts">
/**
 * Top 50 in a semantic table (CA7). The current player's line carries a "You"
 * badge and `aria-current` (CA8); outside the top 50 it is pinned under the
 * table with its real rank (CA9). "Show my position" scrolls to it and focuses it.
 */
import { computed, ref } from "vue";
import UiBadge, { BadgeSize, BadgeTone } from "~/shared/ui/UiBadge.vue";
import UiButton, { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import { formatCount } from "../statisticsRules";
import type { LeaderboardRow } from "../types";

const props = defineProps<{
  rows: LeaderboardRow[];
  pinnedMe: LeaderboardRow | null;
}>();

const root = ref<HTMLElement | null>(null);
const hasMyPosition = computed(
  () => props.pinnedMe !== null || props.rows.some((row) => row.isMe),
);

function showMyPosition(): void {
  const myLine = root.value?.querySelector<HTMLElement>('[aria-current="true"]');
  if (!myLine) return;
  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  myLine.scrollIntoView?.({
    block: "center",
    behavior: reduceMotion ? "auto" : "smooth",
  });
  myLine.focus({ preventScroll: true });
}

defineExpose({ showMyPosition });
</script>

<template>
  <div ref="root" class="leaderboard-table">
    <div v-if="hasMyPosition" class="leaderboard-table__toolbar">
      <UiButton
        :size="ButtonSize.SM"
        :variant="ButtonVariant.GHOST"
        @click="showMyPosition"
        >Show my position</UiButton
      >
    </div>

    <table class="leaderboard-table__table">
      <caption class="visually-hidden">
        Top
        {{
          rows.length
        }}
        players, by ascending rank
      </caption>
      <thead>
        <tr>
          <th scope="col" class="leaderboard-table__rank">Rank</th>
          <th scope="col">Player</th>
          <th scope="col" class="leaderboard-table__score">Score</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.playerId"
          class="leaderboard-table__row"
          :class="{ 'leaderboard-table__row--me': row.isMe }"
          :aria-current="row.isMe ? 'true' : undefined"
          :tabindex="row.isMe ? -1 : undefined"
        >
          <td class="leaderboard-table__rank">{{ row.rank }}</td>
          <th scope="row">
            <span class="leaderboard-table__player">
              <span class="leaderboard-table__name">{{ row.playerName }}</span>
              <UiBadge v-if="row.isMe" :tone="BadgeTone.SUCCESS" :size="BadgeSize.SM"
                >You</UiBadge
              >
            </span>
          </th>
          <td class="leaderboard-table__score">{{ formatCount(row.score) }}</td>
        </tr>
      </tbody>
    </table>

    <section
      v-if="pinnedMe"
      class="leaderboard-table__pinned"
      aria-label="Your position"
      aria-current="true"
      tabindex="-1"
    >
      <dl class="leaderboard-table__pinned-list">
        <div class="leaderboard-table__pinned-item">
          <dt>Rank</dt>
          <dd class="leaderboard-table__rank">{{ pinnedMe.rank }}</dd>
        </div>
        <div
          class="leaderboard-table__pinned-item leaderboard-table__pinned-item--grow"
        >
          <dt>Player</dt>
          <dd class="leaderboard-table__player">
            <span class="leaderboard-table__name">{{ pinnedMe.playerName }}</span>
            <UiBadge :tone="BadgeTone.SUCCESS" :size="BadgeSize.SM">You</UiBadge>
          </dd>
        </div>
        <div class="leaderboard-table__pinned-item">
          <dt>Score</dt>
          <dd class="leaderboard-table__score">{{ formatCount(pinnedMe.score) }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<style scoped lang="scss">
.leaderboard-table {
  display: grid;
  gap: var(--space-3);

  &__toolbar {
    display: flex;
    justify-content: flex-end;
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

    &.leaderboard-table__score {
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

  &__score {
    font-family: var(--font-family-mono);
    font-variant-numeric: tabular-nums;
    text-align: end;
    white-space: nowrap;
  }

  &__player {
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

  &__row--me,
  &__pinned {
    background-color: var(--color-surface-overlay);
    box-shadow: inset var(--space-1) 0 0 var(--color-accent);
    font-weight: var(--font-weight-bold);
  }

  &__row:focus,
  &__pinned:focus {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: -2px;
  }

  &__pinned {
    border: 1px solid var(--color-border-strong);
    border-block-start-style: dashed;
    padding: var(--space-2) var(--space-3);
  }

  &__pinned-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-5);
    margin: 0;
  }

  &__pinned-item {
    display: grid;
    gap: var(--space-1);

    &--grow {
      flex: 1;
    }

    dt {
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-regular);
      text-transform: uppercase;
    }

    dd {
      margin: 0;
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

    &__pinned {
      padding: var(--space-3) var(--space-4);
    }
  }
}
</style>
