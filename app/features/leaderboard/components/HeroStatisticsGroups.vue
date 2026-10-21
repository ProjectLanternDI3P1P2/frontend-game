<script setup lang="ts">
/** Every catalogue statistic as a `UiStat` card, grouped by category (CA1, CA3). */
import UiStat from "~/shared/ui/UiStat.vue";
import { formatCount } from "../statisticsRules";
import type { StatisticGroup } from "../types";

defineProps<{ groups: StatisticGroup[] }>();
</script>

<template>
  <div class="hero-statistics-groups">
    <section
      v-for="group in groups"
      :key="group.category"
      class="hero-statistics-groups__group"
      :aria-labelledby="`statistics-${group.category}`"
    >
      <h2 :id="`statistics-${group.category}`" class="hero-statistics-groups__title">
        {{ group.label }}
      </h2>
      <ul class="hero-statistics-groups__list" role="list">
        <li
          v-for="statistic in group.statistics"
          :key="statistic.key"
          class="hero-statistics-groups__item"
          :data-statistic="statistic.key"
        >
          <UiStat :label="statistic.label" :value="formatCount(statistic.value)" />
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped lang="scss">
.hero-statistics-groups {
  display: grid;
  gap: var(--space-6);

  &__title {
    margin: 0 0 var(--space-3);
    font-size: var(--font-size-lg);
  }

  &__list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__item > * {
    block-size: 100%;
  }

  @include bp.from("md") {
    &__list {
      grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
      gap: var(--space-4);
    }
  }
}
</style>
