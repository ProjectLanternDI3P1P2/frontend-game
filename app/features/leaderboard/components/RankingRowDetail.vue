<script setup lang="ts">
/**
 * The expanded ranking row (F03, CA1 to CA6): hero detail, last runs, records,
 * public profile and the facts behind the row. Its own loading and error states
 * never affect the rest of the ranking. Contract (F00): these props, no emit.
 */
import { computed } from "vue";
import { useRankingHeroDetail } from "../composables/useRankingHeroDetail";
import { formatRelativeTime, HERO_CLASS_LABELS } from "../leaderboardRules";
import {
  formatDate,
  formatNumber,
  formatRoom,
  formatXpGain,
  formatXpProgress,
  NO_RUN_YET,
  publicProfilePath,
  RUN_OUTCOME_LABELS,
  xpPercent,
} from "../rankingDetailRules";
import { LoadStatus, RunOutcome } from "../types";
import LeaderboardLoadState from "./LeaderboardLoadState.vue";
import RankingFactsDrawer from "./RankingFactsDrawer.vue";
import UiBadge, { BadgeSize, BadgeTone } from "~/shared/ui/UiBadge.vue";
import UiProgressBar from "~/shared/ui/UiProgressBar.vue";
import UiStat from "~/shared/ui/UiStat.vue";

const props = defineProps<{ heroId: string; currentPlayerId: string }>();

const { status, detail, errorMessage, retry } = useRankingHeroDetail(
  () => props.heroId,
);

const now = () => new Date();

const OUTCOME_TONES: Record<RunOutcome, BadgeTone> = {
  [RunOutcome.VICTORY]: BadgeTone.SUCCESS,
  [RunOutcome.DEFEAT]: BadgeTone.DANGER,
  [RunOutcome.ABANDONED]: BadgeTone.NEUTRAL,
};

const profilePath = computed(() => publicProfilePath(detail.value?.playerId));
const isMine = computed(
  () => !!detail.value?.playerId && detail.value.playerId === props.currentPlayerId,
);
const percent = computed(() =>
  detail.value ? xpPercent(detail.value.xpIntoLevel, detail.value.xpForNextLevel) : 0,
);
const runs = computed(() => (detail.value?.lastRuns ?? []).slice(0, 4));
</script>

<template>
  <section class="ranking-row-detail" :aria-busy="status === LoadStatus.LOADING">
    <LeaderboardLoadState
      :loading="status === LoadStatus.LOADING"
      loading-label="Loading hero detail…"
      :failed="status === LoadStatus.ERROR"
      :error="errorMessage"
      error-title="Hero detail unavailable"
      @retry="retry"
    />

    <template v-if="status === LoadStatus.READY && detail">
      <header class="ranking-row-detail__header">
        <h3 class="ranking-row-detail__title">Hero · {{ detail.heroName }}</h3>
        <UiBadge v-if="isMine" :size="BadgeSize.SM" outlined>You</UiBadge>
      </header>

      <dl class="ranking-row-detail__facts">
        <div class="ranking-row-detail__fact">
          <dt>Class</dt>
          <dd>{{ HERO_CLASS_LABELS[detail.heroClass] ?? detail.heroClass }}</dd>
        </div>
        <div class="ranking-row-detail__fact">
          <dt>Level</dt>
          <dd>{{ detail.level }}</dd>
        </div>
        <div class="ranking-row-detail__fact">
          <dt>NG+ tier</dt>
          <dd>NG+{{ detail.ngTier }}</dd>
        </div>
        <div class="ranking-row-detail__fact">
          <dt>Created</dt>
          <dd>
            <time :datetime="detail.createdAt">{{ formatDate(detail.createdAt) }}</time>
          </dd>
        </div>
      </dl>

      <div class="ranking-row-detail__progress">
        <UiProgressBar
          :value="percent"
          :max="100"
          :label="formatXpProgress(detail.xpIntoLevel, detail.xpForNextLevel)"
        />
        <p class="ranking-row-detail__percent">
          {{ percent }}% to level {{ detail.level + 1 }}
        </p>
      </div>

      <div class="ranking-row-detail__body">
        <section class="ranking-row-detail__runs" :aria-labelledby="`runs-${heroId}`">
          <h4 :id="`runs-${heroId}`" class="ranking-row-detail__subtitle">
            Last 4 runs
          </h4>
          <p v-if="runs.length === 0" class="ranking-row-detail__empty">
            {{ NO_RUN_YET }}
          </p>
          <ul v-else class="ranking-row-detail__run-list" role="list">
            <li
              v-for="(run, index) in runs"
              :key="`${run.endedAt}-${index}`"
              class="ranking-row-detail__run"
            >
              <UiBadge :tone="OUTCOME_TONES[run.outcome]" :size="BadgeSize.SM">{{
                RUN_OUTCOME_LABELS[run.outcome] ?? run.outcome
              }}</UiBadge>
              <span>Room {{ formatRoom(run.room, run.maxRoom) }}</span>
              <span>{{ run.boss ?? "No boss" }}</span>
              <span>{{ formatXpGain(run.xp) }}</span>
              <time class="ranking-row-detail__muted" :datetime="run.endedAt">{{
                formatRelativeTime(run.endedAt, now())
              }}</time>
            </li>
          </ul>
        </section>

        <div class="ranking-row-detail__stats">
          <UiStat
            label="Bosses defeated"
            :value="formatNumber(detail.bossesDefeated)"
          />
          <UiStat label="Deepest room" :value="formatNumber(detail.deepestRoom)" />
        </div>
      </div>

      <div class="ranking-row-detail__actions">
        <NuxtLink v-if="profilePath" :to="profilePath" class="ranking-row-detail__link"
          >View public profile</NuxtLink
        >
        <RankingFactsDrawer :hero-id="heroId" :now="now" />
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss">
.ranking-row-detail {
  display: grid;
  gap: var(--space-4);

  &__header,
  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  &__actions {
    justify-content: space-between;
  }

  &__title,
  &__subtitle {
    margin: 0;
    color: var(--color-text-highlight);
    font-family: var(--font-family-display);
  }

  &__title {
    font-size: var(--font-size-lg);
  }

  &__subtitle {
    font-size: var(--font-size-md);
  }

  &__facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
    margin: 0;
  }

  &__fact {
    display: grid;
    gap: var(--space-1);

    dt {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }

    dd {
      margin: 0;
      font-weight: var(--font-weight-bold);
    }
  }

  &__progress {
    display: grid;
    gap: var(--space-1);
  }

  &__percent,
  &__empty {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  &__body {
    display: grid;
    gap: var(--space-4);

    @include bp.from("md") {
      grid-template-columns: 2fr 1fr;
    }
  }

  &__runs {
    display: grid;
    gap: var(--space-2);
    align-content: start;
  }

  &__run-list {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__run {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-left: var(--space-1) solid var(--color-border-strong);
    background-color: var(--color-surface-base);
  }

  &__muted {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  &__stats {
    display: grid;
    gap: var(--space-3);
    align-content: start;
  }

  &__link {
    color: var(--color-accent);

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: var(--space-1);
    }
  }
}
</style>
