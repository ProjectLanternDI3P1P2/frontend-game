<script setup lang="ts">
/**
 * Leaderboard screen (CA7–CA10). Data comes through `useLeaderboard`, which
 * goes through `api/`; this view never knows whether it is simulated.
 */
import UiButton, { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import { useLeaderboard } from "../composables/useLeaderboard";
import { LoadStatus } from "../types";
import ConsolidationStatus from "./ConsolidationStatus.vue";
import LeaderboardLoadState from "./LeaderboardLoadState.vue";
import LeaderboardTable from "./LeaderboardTable.vue";

const props = defineProps<{ currentPlayerId: string }>();

const {
  status,
  view,
  consolidation,
  errorMessage,
  refreshing,
  hasData,
  refresh,
  retry,
} = useLeaderboard(() => props.currentPlayerId);
</script>

<template>
  <main id="main" class="leaderboard">
    <header class="leaderboard__header">
      <div class="leaderboard__heading">
        <p class="leaderboard__eyebrow">Top 50 players</p>
        <h1 class="leaderboard__title">Leaderboard</h1>
        <ConsolidationStatus
          v-if="hasData && consolidation"
          :consolidation="consolidation"
        />
      </div>
      <UiButton
        :size="ButtonSize.SM"
        :variant="ButtonVariant.SECONDARY"
        :busy="refreshing"
        :disabled="status === LoadStatus.LOADING"
        @click="refresh"
        >Refresh</UiButton
      >
    </header>

    <LeaderboardLoadState
      :loading="status === LoadStatus.LOADING || refreshing"
      :loading-label="refreshing ? 'Refreshing leaderboard…' : 'Loading leaderboard…'"
      :failed="status === LoadStatus.ERROR"
      :error="errorMessage"
      error-title="The leaderboard could not be loaded"
      @retry="retry"
    />

    <p v-if="status === LoadStatus.EMPTY" class="leaderboard__empty">
      No player has been ranked yet. Finish a dungeon to enter the leaderboard.
    </p>
    <LeaderboardTable
      v-else-if="status === LoadStatus.READY"
      :rows="view.rows"
      :pinned-me="view.pinnedMe"
    />
  </main>
</template>

<style scoped lang="scss">
.leaderboard {
  display: grid;
  gap: var(--space-5);

  &__header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  &__heading {
    display: grid;
    gap: var(--space-2);
  }

  &__eyebrow {
    margin: 0;
    color: var(--color-text-highlight);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-xl);
  }

  &__empty {
    margin: 0;
    border: 1px dashed var(--color-border-strong);
    padding: var(--space-5);
    color: var(--color-text-muted);
    text-align: center;
  }

  @include bp.from("md") {
    &__header {
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
    }

    &__title {
      font-size: var(--font-size-2xl);
    }
  }
}
</style>
