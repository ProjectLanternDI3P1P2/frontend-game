<script setup lang="ts">
/**
 * When the figures were last consolidated (CA2), and a discreet, non-blocking
 * mention while a new consolidation runs (CA4). Never an error state.
 */
import { computed } from "vue";
import type { ConsolidationInfo } from "../types";

const props = defineProps<{ consolidation: ConsolidationInfo }>();

const absoluteDate = computed(() =>
  props.consolidation.consolidatedAt
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(props.consolidation.consolidatedAt))
    : "",
);
</script>

<template>
  <p class="consolidation-status">
    <time
      v-if="consolidation.consolidatedAt"
      class="consolidation-status__age"
      :datetime="consolidation.consolidatedAt"
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
