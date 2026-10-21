<script setup lang="ts">
/**
 * Nobody ranked yet, typically a new season (CA10): "No ranked run in
 * <season> yet", a link to the dungeon and, when there is a previous season,
 * an action that switches to its final board. The contract cannot ask for a
 * past season, so the action shows All time (which holds past seasons); when
 * All time is already shown, the button stays visible but disabled.
 */
import UiButton, { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import { noRankedRunLabel, previousSeasonLabel } from "../rankingViewRules";
import type { RankingSeason } from "../types";

const props = defineProps<{
  season: RankingSeason | null;
  /** True when All time, which holds the previous season, is already shown. */
  alreadyAllTime: boolean;
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
        v-if="season?.previousSeasonId"
        :disabled="alreadyAllTime"
        :aria-describedby="alreadyAllTime ? 'ranking-empty-previous-hint' : undefined"
        :size="ButtonSize.SM"
        :variant="ButtonVariant.SECONDARY"
        @click="$emit('previous')"
        >{{ previousSeasonLabel(season.previousSeasonId) }} final board</UiButton
      >
      <p
        v-if="season?.previousSeasonId && alreadyAllTime"
        id="ranking-empty-previous-hint"
        class="ranking-empty__hint"
      >
        Already showing the all-time board
      </p>
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

  &__hint {
    margin: 0;
    font-size: var(--font-size-sm);
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
