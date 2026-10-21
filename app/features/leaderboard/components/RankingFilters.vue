<script setup lang="ts">
/**
 * Class and period filters, display-name search and sort (CA4). Emits each
 * change; the search waits for the user to pause (about 300 ms).
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import UiInput, { InputType } from "~/shared/ui/UiInput.vue";
import UiSelect, { type SelectOption } from "~/shared/ui/UiSelect.vue";
import {
  HERO_CLASS_LABELS,
  RANKING_SORT_LABELS,
  type RankingUrlState,
} from "../leaderboardRules";
import { SEARCH_DEBOUNCE_MS, periodLabel } from "../rankingViewRules";
import { HeroClass, RankingPeriod, RankingSort } from "../types";

const props = defineProps<{ state: RankingUrlState; seasonLabel?: string | null }>();

const emit = defineEmits<{ change: [change: Partial<RankingUrlState>] }>();

const ALL_CLASSES = "all";

const classOptions: SelectOption[] = [
  { value: ALL_CLASSES, label: "All classes" },
  ...Object.values(HeroClass).map((value) => ({
    value,
    label: HERO_CLASS_LABELS[value],
  })),
];
const periodOptions = computed<SelectOption[]>(() =>
  Object.values(RankingPeriod).map((value) => ({
    value,
    label: periodLabel(value, props.seasonLabel),
  })),
);
const sortOptions: SelectOption[] = Object.values(RankingSort).map((value) => ({
  value,
  label: RANKING_SORT_LABELS[value],
}));

function asEnum<T extends string>(values: readonly T[], raw: string): T | null {
  return values.find((value) => value === raw) ?? null;
}

function changeClass(raw: string): void {
  emit("change", { heroClass: asEnum(Object.values(HeroClass), raw) });
}

function changePeriod(raw: string): void {
  const period = asEnum(Object.values(RankingPeriod), raw);
  if (period) emit("change", { period });
}

function changeSort(raw: string): void {
  const sort = asEnum(Object.values(RankingSort), raw);
  if (sort) emit("change", { sort });
}

// ------------------------------------------------------------------ search

const search = ref(props.state.search);
let timer: ReturnType<typeof setTimeout> | null = null;

function cancelSearch(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

function typeSearch(value: string | number): void {
  search.value = String(value);
  cancelSearch();
  timer = setTimeout(() => {
    timer = null;
    const next = search.value.trim();
    if (next !== props.state.search) emit("change", { search: next });
  }, SEARCH_DEBOUNCE_MS);
}

// The URL (shared link, "Clear filters") wins over what is being typed.
watch(
  () => props.state.search,
  (value) => {
    if (value !== search.value.trim()) {
      cancelSearch();
      search.value = value;
    }
  },
);

onBeforeUnmount(cancelSearch);
</script>

<template>
  <form
    class="ranking-filters"
    role="search"
    aria-label="Ranking filters"
    @submit.prevent
  >
    <UiSelect
      id="ranking-class"
      label="Class"
      :model-value="state.heroClass ?? ALL_CLASSES"
      :options="classOptions"
      @update:model-value="changeClass"
    />
    <UiSelect
      id="ranking-period"
      label="Period"
      :model-value="state.period"
      :options="periodOptions"
      @update:model-value="changePeriod"
    />
    <UiInput
      id="ranking-search"
      class="ranking-filters__search"
      label="Search a display name"
      :type="InputType.SEARCH"
      :model-value="search"
      :max-length="64"
      autocomplete="off"
      @update:model-value="typeSearch"
    />
    <UiSelect
      id="ranking-sort"
      label="Sort by"
      :model-value="state.sort"
      :options="sortOptions"
      @update:model-value="changeSort"
    />
  </form>
</template>

<style scoped lang="scss">
.ranking-filters {
  display: grid;
  gap: var(--space-3);

  @include bp.from("md") {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @include bp.from("lg") {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
