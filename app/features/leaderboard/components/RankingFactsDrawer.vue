<script setup lang="ts">
/**
 * "Facts behind this row" (F03, CA5, CA6): where the hero's score comes from.
 * The facts are read only when the drawer opens. UiModal closes on Escape; this
 * component traps the focus inside it and gives it back to the opening button.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import { useRankingHeroFacts } from "../composables/useRankingHeroFacts";
import { formatRelativeTime } from "../leaderboardRules";
import { FACT_STATUS_LABELS, formatNumber, formatXpGain } from "../rankingDetailRules";
import { FactStatus, LoadStatus } from "../types";
import LeaderboardLoadState from "./LeaderboardLoadState.vue";
import UiBadge, { BadgeSize, BadgeTone } from "~/shared/ui/UiBadge.vue";
import UiButton, { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import UiModal, { ModalSize } from "~/shared/ui/UiModal.vue";

const props = withDefaults(defineProps<{ heroId: string; now?: () => Date }>(), {
  now: () => new Date(),
});

const TITLE = "Facts behind this row";
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const { status, facts, errorMessage, load, retry, cancel } = useRankingHeroFacts(
  () => props.heroId,
);

const open = ref(false);
const opener = ref<InstanceType<typeof UiButton> | null>(null);
const content = ref<HTMLElement | null>(null);
const operatorsNoteId = `ranking-facts-operators-${useId()}`;

const factList = computed(() => facts.value?.facts ?? []);

const STATUS_TONES: Record<FactStatus, BadgeTone> = {
  [FactStatus.APPLIED]: BadgeTone.SUCCESS,
  [FactStatus.PENDING]: BadgeTone.ARCANE,
  [FactStatus.REJECTED]: BadgeTone.DANGER,
};

function dialog(): HTMLElement | null {
  return content.value?.closest("dialog") ?? null;
}

function onKeydown(event: KeyboardEvent): void {
  const element = dialog();
  if (!open.value || event.key !== "Tab" || !element) return;
  const focusables = Array.from(element.querySelectorAll<HTMLElement>(FOCUSABLE));
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (!first || !last) {
    event.preventDefault();
    element.focus();
  } else if (event.shiftKey && (active === first || active === element)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !element.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

/** Focus that escapes the drawer (pointer, script) is brought back inside. */
function onFocusIn(event: FocusEvent): void {
  const element = dialog();
  if (!open.value || !element) return;
  if (event.target instanceof Node && !element.contains(event.target)) element.focus();
}

watch(open, async (isOpen) => {
  if (isOpen) {
    void load();
    await nextTick();
    dialog()?.focus();
  } else {
    cancel();
    await nextTick();
    (opener.value?.$el as HTMLElement | undefined)?.focus();
  }
});

onMounted(() => {
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("focusin", onFocusIn);
});
onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  document.removeEventListener("focusin", onFocusIn);
});
</script>

<template>
  <div class="ranking-facts">
    <UiButton
      ref="opener"
      :size="ButtonSize.SM"
      :variant="ButtonVariant.SECONDARY"
      aria-haspopup="dialog"
      @click="open = true"
      >{{ TITLE }}</UiButton
    >
    <UiModal v-model="open" :title="TITLE" :size="ModalSize.LG">
      <div ref="content" class="ranking-facts__content">
        <LeaderboardLoadState
          :loading="status === LoadStatus.LOADING"
          loading-label="Loading facts…"
          :failed="status === LoadStatus.ERROR"
          :error="errorMessage"
          error-title="Facts unavailable"
          @retry="retry"
        />

        <template v-if="facts">
          <dl class="ranking-facts__summary">
            <div class="ranking-facts__summary-item">
              <dt>XP from facts</dt>
              <dd>{{ formatNumber(facts.xpFromFacts) }} XP</dd>
            </div>
            <div class="ranking-facts__summary-item">
              <dt>Idempotency key</dt>
              <dd>
                <code class="ranking-facts__code">{{ facts.idempotencyKey }}</code>
              </dd>
            </div>
          </dl>

          <p v-if="factList.length === 0" class="ranking-facts__empty">No fact yet</p>
          <ul v-else class="ranking-facts__list" role="list">
            <li v-for="fact in factList" :key="fact.factId" class="ranking-facts__item">
              <div class="ranking-facts__item-head">
                <span class="ranking-facts__type">{{ fact.type }}</span>
                <UiBadge :tone="STATUS_TONES[fact.status]" :size="BadgeSize.SM">{{
                  FACT_STATUS_LABELS[fact.status] ?? fact.status
                }}</UiBadge>
              </div>
              <dl class="ranking-facts__fields">
                <div>
                  <dt>Fact</dt>
                  <dd>
                    <code class="ranking-facts__code">{{ fact.factId }}</code>
                  </dd>
                </div>
                <div>
                  <dt>Received</dt>
                  <dd>
                    <time :datetime="fact.ingestedAt">{{
                      formatRelativeTime(fact.ingestedAt, props.now())
                    }}</time>
                  </dd>
                </div>
                <div>
                  <dt>XP</dt>
                  <dd>{{ formatXpGain(fact.xp) }}</dd>
                </div>
                <div v-if="fact.reason">
                  <dt>Reason</dt>
                  <dd>{{ fact.reason }}</dd>
                </div>
              </dl>
            </li>
          </ul>
        </template>
      </div>
      <template #footer>
        <p :id="operatorsNoteId" class="ranking-facts__operators">Operators only</p>
        <UiButton
          :variant="ButtonVariant.GHOST"
          :size="ButtonSize.SM"
          disabled
          :aria-describedby="operatorsNoteId"
          >Rebuild from facts</UiButton
        >
      </template>
    </UiModal>
  </div>
</template>

<style scoped lang="scss">
.ranking-facts {
  &__content {
    display: grid;
    gap: var(--space-4);
  }

  &__summary {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin: 0;
  }

  &__summary-item,
  &__fields > div {
    display: grid;
    gap: var(--space-1);

    dt {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }

    dd {
      margin: 0;
    }
  }

  &__code {
    overflow-wrap: anywhere;
    font-size: var(--font-size-sm);
  }

  &__empty,
  &__operators {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  &__list {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__item {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface-base);
  }

  &__item-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  &__type {
    font-weight: var(--font-weight-bold);
  }

  &__fields {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin: 0;
  }
}
</style>
