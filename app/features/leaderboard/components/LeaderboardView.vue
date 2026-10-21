<script setup lang="ts">
/**
 * The hero ranking page (F02). Data comes through `useLeaderboard`, which goes
 * through `api/`; this view never knows whether it is simulated. The ranking
 * state (filters, search, sort, page) is the `query` model: the page binds it
 * to the URL, a bare view keeps it locally.
 */
import { computed, nextTick, ref, watch } from "vue";
import UiButton, { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import UiTabs, { type Tab } from "~/shared/ui/UiTabs.vue";
import { useLeaderboard } from "../composables/useLeaderboard";
import {
  DEFAULT_RANKING_STATE,
  RANKING_PAGE_SIZE,
  type RankingUrlState,
} from "../leaderboardRules";
import {
  DEMO_PLAYER_NAME,
  EmptyReason,
  clearedFilters,
  jumpTargetHeroId,
  pageCount,
  pinnedHeroes,
  progressionPath,
  rankedCountLabel,
  rankingQueryKey,
  rankingTitle,
  withChange,
} from "../rankingViewRules";
import { LoadStatus, RankingSort, type RankingQuery } from "../types";
import ConsolidationStatus from "./ConsolidationStatus.vue";
import LeaderboardLoadState from "./LeaderboardLoadState.vue";
import LeaderboardTable from "./LeaderboardTable.vue";
import RankingFilters from "./RankingFilters.vue";
import RankingHeader from "./RankingHeader.vue";
import RankingPagination from "./RankingPagination.vue";

const props = defineProps<{ currentPlayerId: string }>();

const query = defineModel<RankingUrlState>("query", {
  default: () => ({ ...DEFAULT_RANKING_STATE }),
});

const request = computed<RankingQuery>(() => ({
  ...query.value,
  pageSize: RANKING_PAGE_SIZE,
  playerId: props.currentPlayerId,
}));

const {
  status,
  ranking,
  entries,
  me,
  consolidation,
  errorMessage,
  refreshing,
  hasData,
  emptyReason,
  findPageOfRank,
  refresh,
  retry,
} = useLeaderboard(request);

/** The clock of the last reading, for "Last activity". */
const now = ref(new Date());
watch(ranking, () => (now.value = new Date()));

function change(patch: Partial<RankingUrlState>): void {
  query.value = withChange(query.value, patch);
}

function goToPage(page: number): void {
  change({ page });
}

function clearFilters(): void {
  query.value = clearedFilters(query.value);
}

// ------------------------------------------------------------------ header

const best = computed(() => me.value[0] ?? null);
const playerName = computed(() => best.value?.playerName?.trim() || DEMO_PLAYER_NAME);

const tabs = computed<Tab[]>(() => [
  { id: "ranking", label: "Ranking" },
  { id: "progression", label: "My progression", disabled: !best.value },
  { id: "history", label: "Run history (Coming soon)", disabled: true },
]);

function selectTab(id: string): void {
  if (id !== "progression" || !best.value) return;
  void navigateTo(
    progressionPath(best.value.playerId ?? props.currentPlayerId, best.value.heroId),
  );
}

// ------------------------------------------------------------------ table

const seasonLabel = computed(() => ranking.value?.season?.label ?? null);
const title = computed(() => rankingTitle(query.value, seasonLabel.value));
const totalCount = computed(() => ranking.value?.totalCount ?? 0);
const pinned = computed(() => pinnedHeroes(me.value, entries.value));
const targetHeroId = computed(() =>
  jumpTargetHeroId(me.value, entries.value, props.currentPlayerId),
);

/** One line expanded at a time; a click on it again folds it. */
const expandedHeroId = ref<string | null>(null);
function toggle(heroId: string): void {
  expandedHeroId.value = expandedHeroId.value === heroId ? null : heroId;
}

// A page past the end (a stale link) goes back to the last page.
watch(ranking, (response) => {
  if (!response || entries.value.length > 0 || response.totalCount <= 0) return;
  const last = pageCount(response.totalCount, RANKING_PAGE_SIZE);
  if (query.value.page > last) goToPage(last);
});

// ------------------------------------------------------------------ jump

const table = ref<InstanceType<typeof LeaderboardTable> | null>(null);
const pendingJump = ref<string | null>(null);
const jumping = ref(false);

async function focusPendingJump(): Promise<void> {
  const heroId = pendingJump.value;
  if (!heroId) return;
  await nextTick();
  if (table.value?.focusHero(heroId)) pendingJump.value = null;
}

async function jumpToMyRank(): Promise<void> {
  const target = best.value;
  if (!target) return;
  pendingJump.value = target.heroId;
  if (entries.value.some((entry) => entry.heroId === target.heroId)) {
    await focusPendingJump();
    return;
  }
  jumping.value = true;
  try {
    const page = await findPageOfRank(target.rank);
    const next = { ...query.value, sort: RankingSort.TOTAL_XP, page };
    const unchanged =
      rankingQueryKey({ ...request.value, ...next }) === rankingQueryKey(request.value);
    query.value = next;
    if (unchanged) await focusPendingJump();
  } catch {
    pendingJump.value = null;
  } finally {
    jumping.value = false;
  }
}

watch(entries, () => {
  if (pendingJump.value && status.value === LoadStatus.READY) void focusPendingJump();
});
</script>

<template>
  <main id="main" class="leaderboard">
    <RankingHeader :player-name="playerName" />

    <UiTabs
      model-value="ranking"
      :tabs="tabs"
      label="Leaderboard sections"
      @update:model-value="selectTab"
    >
      <div class="leaderboard__body">
        <RankingFilters :state="query" :season-label="seasonLabel" @change="change" />

        <div class="leaderboard__toolbar">
          <div class="leaderboard__heading">
            <h2 class="leaderboard__title">{{ title }}</h2>
            <p v-if="hasData" class="leaderboard__count">
              {{ rankedCountLabel(totalCount) }}
            </p>
            <ConsolidationStatus
              v-if="hasData && consolidation"
              :consolidation="consolidation"
            />
          </div>
          <div class="leaderboard__actions">
            <UiButton
              :size="ButtonSize.SM"
              :variant="ButtonVariant.SECONDARY"
              :busy="jumping"
              :disabled="!best || status !== LoadStatus.READY"
              @click="jumpToMyRank"
              >Jump to my rank</UiButton
            >
            <UiButton
              :size="ButtonSize.SM"
              :variant="ButtonVariant.SECONDARY"
              :busy="refreshing"
              :disabled="status === LoadStatus.LOADING"
              @click="refresh"
              >Refresh view</UiButton
            >
          </div>
        </div>

        <LeaderboardLoadState
          :loading="status === LoadStatus.LOADING || refreshing"
          :loading-label="
            refreshing ? 'Refreshing leaderboard…' : 'Loading leaderboard…'
          "
          :failed="status === LoadStatus.ERROR"
          :error="errorMessage"
          error-title="The leaderboard could not be loaded"
          @retry="retry"
        />

        <div
          v-if="status === LoadStatus.EMPTY && emptyReason === EmptyReason.NO_MATCH"
          class="leaderboard__empty"
        >
          <p class="leaderboard__empty-text">No hero matches your filters</p>
          <UiButton
            :size="ButtonSize.SM"
            :variant="ButtonVariant.SECONDARY"
            @click="clearFilters"
            >Clear filters</UiButton
          >
        </div>
        <div v-else-if="status === LoadStatus.EMPTY" class="leaderboard__empty">
          <p class="leaderboard__empty-text">
            No hero has been ranked yet. Finish a dungeon to enter the leaderboard.
          </p>
        </div>
        <template v-else-if="status === LoadStatus.READY">
          <LeaderboardTable
            ref="table"
            :entries="entries"
            :pinned="pinned"
            :current-player-id="currentPlayerId"
            :caption="title"
            :target-hero-id="targetHeroId"
            :expanded-hero-id="expandedHeroId"
            :now="now"
            @toggle="toggle"
          />
          <RankingPagination
            :shown="entries.length"
            :total-count="totalCount"
            :page="query.page"
            :page-size="RANKING_PAGE_SIZE"
            :disabled="refreshing"
            @page="goToPage"
          />
        </template>
      </div>
    </UiTabs>
  </main>
</template>

<style scoped lang="scss">
.leaderboard {
  display: grid;
  gap: var(--space-5);
  min-inline-size: 0;

  &__body {
    display: grid;
    gap: var(--space-4);
    min-inline-size: 0;
  }

  &__toolbar {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  &__heading {
    display: grid;
    gap: var(--space-1);
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-lg);
  }

  &__count {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  &__empty {
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    border: 1px dashed var(--color-border-strong);
    padding: var(--space-5);
    color: var(--color-text-muted);
    text-align: center;
  }

  &__empty-text {
    margin: 0;
  }

  @include bp.from("md") {
    &__toolbar {
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
    }
  }
}
</style>
