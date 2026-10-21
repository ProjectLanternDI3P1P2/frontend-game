<script setup lang="ts">
/**
 * The ranking status when it is not LIVE (CA11): behind (LAGGING), being
 * rebuilt (REBUILDING) or frozen (FROZEN). Each state has a text title, never
 * only a colour; the table under it stays readable.
 */
import { computed } from "vue";
import UiNotice, { NoticeTone } from "~/shared/ui/UiNotice.vue";
import UiProgressBar, { ProgressTone } from "~/shared/ui/UiProgressBar.vue";
import { formatDateTime, formatLag } from "../rankingViewRules";
import { RankingStatus, type RankingStatusDetail } from "../types";

const props = defineProps<{
  status: RankingStatus;
  detail: RankingStatusDetail | null;
}>();

const detail = computed<Partial<RankingStatusDetail>>(() => props.detail ?? {});
const progress = computed(() =>
  Math.min(100, Math.max(0, Math.round((detail.value.rebuildProgress ?? 0) * 100))),
);
</script>

<template>
  <UiNotice
    v-if="status === RankingStatus.LAGGING"
    :tone="NoticeTone.WARNING"
    title="Ranking is behind"
    class="ranking-status"
    data-status="lagging"
  >
    <dl class="ranking-status__columns">
      <div class="ranking-status__column">
        <dt class="ranking-status__term">Certain</dt>
        <dd class="ranking-status__value">
          Ranks are correct up to
          <time :datetime="detail.correctUpTo ?? undefined">{{
            formatDateTime(detail.correctUpTo)
          }}</time
          >.
        </dd>
      </div>
      <div class="ranking-status__column">
        <dt class="ranking-status__term">Still uncertain</dt>
        <dd class="ranking-status__value">
          About {{ formatLag(detail.lagSeconds) }} behind<template
            v-if="typeof detail.pendingCount === 'number'"
            >, {{ detail.pendingCount }} results pending</template
          >. Lines marked « XP pending » may still move.
          <template v-if="detail.reason">{{ detail.reason }}</template>
        </dd>
      </div>
      <div class="ranking-status__column">
        <dt class="ranking-status__term">What you can do</dt>
        <dd class="ranking-status__value">
          Your runs are safe. Use « Refresh view » in a few minutes.
        </dd>
      </div>
    </dl>
  </UiNotice>

  <UiNotice
    v-else-if="status === RankingStatus.REBUILDING"
    :tone="NoticeTone.INFO"
    title="Ranking is being rebuilt from facts"
    class="ranking-status"
    data-status="rebuilding"
  >
    <div class="ranking-status__rebuild">
      <UiProgressBar
        :value="progress"
        :max="100"
        label="Rebuild progress"
        :tone="ProgressTone.ARCANE"
        show-value
      />
      <p class="ranking-status__value">
        Showing the ranking as of
        <time :datetime="detail.snapshotAt ?? undefined">{{
          formatDateTime(detail.snapshotAt)
        }}</time
        >.
      </p>
    </div>
  </UiNotice>

  <UiNotice
    v-else-if="status === RankingStatus.FROZEN"
    :tone="NoticeTone.INFO"
    title="Ranking is frozen"
    class="ranking-status"
    data-status="frozen"
  >
    <p class="ranking-status__value">
      Frozen since
      <time :datetime="detail.frozenAt ?? undefined">{{
        formatDateTime(detail.frozenAt)
      }}</time
      >.
      <template v-if="detail.reason">{{ detail.reason }}</template>
    </p>
  </UiNotice>
</template>

<style scoped lang="scss">
.ranking-status {
  &__columns {
    display: grid;
    gap: var(--space-3);
    margin: 0;
  }

  &__column {
    display: grid;
    gap: var(--space-1);
  }

  &__term {
    font-weight: var(--font-weight-bold);
  }

  &__value {
    margin: 0;
    color: var(--color-text-muted);
  }

  &__rebuild {
    display: grid;
    gap: var(--space-2);
  }

  @include bp.from("md") {
    &__columns {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
}
</style>
