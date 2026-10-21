<script setup lang="ts">
/**
 * Nobody ranked yet, typically a new season (CA10): "No ranked run in
 * <season> yet", a link to the dungeon and, when there is a previous season,
 * an action that switches to its final board.
 */
import UiButton, { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import { noRankedRunLabel, previousSeasonLabel } from "../rankingViewRules";
import type { RankingSeason } from "../types";

const props = defineProps<{
  season: RankingSeason | null;
  /** False when the previous season's board cannot be shown from here. */
  canShowPrevious: boolean;
}>();

defineEmits<{ previous: [] }>();
</script>

<template>
  <section class="ranking-empty" aria-labelledby="ranking-empty-title">
    <h3 id="ranking-empty-title" class="ranking-empty__title">
      {{ noRankedRunLabel(props.season?.label) }}
    </h3>
    <p class="ranking-empty__text">
      No hero has been ranked yet. Finish a dungeon to enter the leaderboard.
    </p>
    <div class="ranking-empty__actions">
      <NuxtLink to="/dungeon" class="ranking-empty__link">Enter a dungeon</NuxtLink>
      <UiButton
        v-if="canShowPrevious && season?.previousSeasonId"
        :size="ButtonSize.SM"
        :variant="ButtonVariant.SECONDARY"
        @click="$emit('previous')"
        >{{ previousSeasonLabel(season.previousSeasonId) }} final board</UiButton
      >
    </div>
  </section>
</template>

<style scoped lang="scss">
.ranking-empty {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  border: 1px dashed var(--color-border-strong);
  padding: var(--space-5);
  color: var(--color-text-muted);
  text-align: center;

  &__title {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-md);
  }

  &__text {
    margin: 0;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-3);
  }

  &__link {
    color: var(--color-accent);
    text-decoration: underline;

    &:focus-visible {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }
  }
}
</style>
