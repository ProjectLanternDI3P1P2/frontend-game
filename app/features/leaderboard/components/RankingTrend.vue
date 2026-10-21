<script setup lang="ts">
/** Rank trend "▲ 3", "▼ 2", "— 0" or "NEW", with an accessible name (CA2). */
import { computed } from "vue";
import { formatRankDelta } from "../leaderboardRules";
import { trendAccessibleName } from "../rankingViewRules";

const props = defineProps<{ delta: number | null }>();

const trend = computed(() => formatRankDelta(props.delta));
const name = computed(() => trendAccessibleName(props.delta));
</script>

<template>
  <span
    class="ranking-trend"
    :class="'ranking-trend--' + trend.direction"
    role="img"
    :aria-label="name"
    :title="name"
    >{{ trend.label }}</span
  >
</template>

<style scoped lang="scss">
.ranking-trend {
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  &--up {
    color: var(--color-success);
  }

  &--down {
    color: var(--color-danger);
  }

  &--stable {
    color: var(--color-text-muted);
  }

  &--new {
    color: var(--color-text-highlight);
    font-weight: var(--font-weight-bold);
  }
}
</style>
