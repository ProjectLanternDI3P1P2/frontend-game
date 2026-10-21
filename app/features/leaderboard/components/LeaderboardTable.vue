<script setup lang="ts">
/**
 * One page of the hero ranking in a semantic table (CA2, CA6, CA8), then my
 * heroes absent from the page, pinned in the table foot after a separator.
 * Only the table scrolls horizontally on a narrow screen.
 */
import { computed, ref } from "vue";
import { positionsBetween } from "../leaderboardRules";
import { isMine } from "../rankingViewRules";
import type { RankingEntry } from "../types";
import RankingRow from "./RankingRow.vue";

const COLUMNS = [
  "Rank",
  "Trend",
  "Player",
  "Hero",
  "Class",
  "Level",
  "Total XP",
  "Runs",
  "Win rate",
  "Last activity",
] as const;

const NUMERIC = new Set<string>(["Level", "Total XP", "Runs", "Win rate"]);

const props = withDefaults(
  defineProps<{
    entries: RankingEntry[];
    currentPlayerId: string;
    caption: string;
    /** My heroes that are not on the page. */
    pinned?: RankingEntry[];
    /** The line "Jump to my rank" targets: the only one with `aria-current`. */
    targetHeroId?: string | null;
    expandedHeroId?: string | null;
    now?: Date;
  }>(),
  { pinned: () => [], targetHeroId: null, expandedHeroId: null, now: () => new Date() },
);

defineEmits<{ toggle: [heroId: string] }>();

const root = ref<HTMLElement | null>(null);

const separator = computed(() => {
  const last = props.entries.at(-1);
  // The first of my heroes below the page (one above it needs no gap).
  const first = last && props.pinned.find((entry) => entry.rank > last.rank);
  if (!first || !last) return "";
  const between = positionsBetween(last.rank, first.rank);
  if (between === 0) return "";
  return `${between} ${between === 1 ? "position" : "positions"} between rank ${last.rank} and yours`;
});

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Scrolls to a hero's line and focuses its toggle; false when it is not shown. */
function focusHero(heroId: string): boolean {
  const buttons = root.value?.querySelectorAll<HTMLElement>("[data-hero-id]") ?? [];
  const button = [...buttons].find((element) => element.dataset.heroId === heroId);
  if (!button) return false;
  button.scrollIntoView?.({
    block: "center",
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
  button.focus({ preventScroll: true });
  return true;
}

defineExpose({ focusHero });
</script>

<template>
  <div
    ref="root"
    class="leaderboard-table"
    role="region"
    :aria-label="caption"
    tabindex="0"
  >
    <table class="leaderboard-table__table">
      <caption class="visually-hidden">
        {{
          caption
        }}
      </caption>
      <thead>
        <tr>
          <th
            v-for="column in COLUMNS"
            :key="column"
            scope="col"
            :class="{ 'leaderboard-table__numeric': NUMERIC.has(column) }"
          >
            {{ column }}
          </th>
        </tr>
      </thead>
      <tbody>
        <RankingRow
          v-for="entry in entries"
          :key="entry.heroId"
          :entry="entry"
          :current-player-id="currentPlayerId"
          :mine="isMine(entry, currentPlayerId)"
          :current="entry.heroId === targetHeroId"
          :expanded="entry.heroId === expandedHeroId"
          :columns="COLUMNS.length"
          :now="now"
          @toggle="$emit('toggle', $event)"
        />
      </tbody>
      <tfoot v-if="pinned.length" class="leaderboard-table__pinned">
        <tr v-if="separator" class="leaderboard-table__separator">
          <td :colspan="COLUMNS.length">{{ separator }}</td>
        </tr>
        <RankingRow
          v-for="entry in pinned"
          :key="entry.heroId"
          :entry="entry"
          :current-player-id="currentPlayerId"
          :mine="true"
          :current="entry.heroId === targetHeroId"
          :expanded="entry.heroId === expandedHeroId"
          :columns="COLUMNS.length"
          :now="now"
          @toggle="$emit('toggle', $event)"
        />
      </tfoot>
    </table>
  </div>
</template>

<style scoped lang="scss">
.leaderboard-table {
  max-inline-size: 100%;
  overflow-x: auto;
  border: 1px solid var(--color-border-subtle);

  &:focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: 2px;
  }

  &__table {
    inline-size: 100%;
    min-inline-size: 56rem;
    border-collapse: collapse;
    background-color: var(--color-surface-raised);
    font-size: var(--font-size-sm);
  }

  :deep(th),
  :deep(td) {
    padding: var(--space-2);
    border-block-end: 1px solid var(--color-border-subtle);
    vertical-align: middle;
  }

  thead th {
    text-align: start;
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  thead th.leaderboard-table__numeric {
    text-align: end;
  }

  &__separator td {
    color: var(--color-text-muted);
    font-style: italic;
    text-align: center;
    border-block-start: 1px dashed var(--color-border-strong);
  }

  @include bp.from("md") {
    :deep(th),
    :deep(td) {
      padding: var(--space-3) var(--space-4);
    }
  }
}
</style>
