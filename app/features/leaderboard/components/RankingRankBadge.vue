<script setup lang="ts">
/**
 * A rank, with a gold, silver or bronze medal for the podium (CA2). The medal
 * carries its name ("Gold medal") as an accessible name and a tooltip; the rank
 * number stays the cell's text.
 */
import { computed } from "vue";
import { podiumMedal } from "../leaderboardRules";
import { medalLabel } from "../rankingViewRules";

const props = defineProps<{ rank: number }>();

const medal = computed(() => podiumMedal(props.rank));
const label = computed(() => medalLabel(props.rank));
</script>

<template>
  <span class="ranking-rank"
    ><span
      v-if="medal"
      class="ranking-rank__medal"
      :class="'ranking-rank__medal--' + medal"
      role="img"
      :aria-label="label ?? undefined"
      :title="label ?? undefined"
    />{{ rank }}</span
  >
</template>

<style scoped lang="scss">
.ranking-rank {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;

  &__medal {
    display: inline-block;
    inline-size: 1em;
    block-size: 1em;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-pill);

    &--gold {
      background-color: var(--color-rarity-legendary);
    }

    &--silver {
      background-color: var(--color-rarity-common);
    }

    &--bronze {
      background-color: var(--color-accent-strong);
    }
  }
}
</style>
