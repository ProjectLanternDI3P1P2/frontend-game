<script setup lang="ts">
/** "10 of 220 · page 1 of 22", Previous / Next page, disabled at the ends (CA5). */
import { computed } from "vue";
import UiButton, { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import { pageCount, paginationSummary } from "../rankingViewRules";

const props = defineProps<{
  shown: number;
  totalCount: number;
  page: number;
  pageSize: number;
  disabled?: boolean;
}>();

defineEmits<{ page: [page: number] }>();

const pages = computed(() => pageCount(props.totalCount, props.pageSize));
const summary = computed(() =>
  paginationSummary(props.shown, props.totalCount, props.page, props.pageSize),
);
</script>

<template>
  <nav class="ranking-pagination" aria-label="Ranking pages">
    <p class="ranking-pagination__summary">{{ summary }}</p>
    <div class="ranking-pagination__buttons">
      <UiButton
        :size="ButtonSize.SM"
        :variant="ButtonVariant.GHOST"
        :disabled="disabled || page <= 1"
        @click="$emit('page', page - 1)"
        >Previous page</UiButton
      >
      <UiButton
        :size="ButtonSize.SM"
        :variant="ButtonVariant.GHOST"
        :disabled="disabled || page >= pages"
        @click="$emit('page', page + 1)"
        >Next page</UiButton
      >
    </div>
  </nav>
</template>

<style scoped lang="scss">
.ranking-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);

  &__summary {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  &__buttons {
    display: flex;
    gap: var(--space-2);
  }
}
</style>
