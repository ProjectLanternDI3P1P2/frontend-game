<script setup lang="ts">
/**
 * When the figures were last consolidated (CA2), and a discreet, non-blocking
 * mention while a new consolidation runs (CA4). Never an error state.
 */
import { computed } from "vue";
import { parseConsolidationDate } from "../statisticsRules";
import type { ConsolidationInfo } from "../types";

const props = defineProps<{ consolidation: ConsolidationInfo }>();

/** Null for an absent or invalid date: then no `<time>` is rendered. */
const consolidationDate = computed(() =>
  parseConsolidationDate(props.consolidation.consolidatedAt),
);
const absoluteDate = computed(() =>
  consolidationDate.value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(consolidationDate.value)
    : "",
);
</script>

<template>
  <p class="consolidation-status">
    <time
      v-if="consolidationDate"
      class="consolidation-status__age"
      :datetime="consolidation.consolidatedAt ?? undefined"
      :title="absoluteDate"
      >{{ consolidation.label }}</time
    >
    <span v-else class="consolidation-status__age">{{ consolidation.label }}</span>
    <span
      v-if="consolidation.isConsolidating"
      class="consolidation-status__pending"
      role="status"
    >
      New figures are being consolidated and will appear shortly.
    </span>
  </p>
</template>

<style scoped lang="scss">
.consolidation-status {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);

  &__pending {
    font-style: italic;
  }
}
</style>
