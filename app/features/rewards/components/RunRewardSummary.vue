<script setup lang="ts">
import { describeRecipient, normalizeRarity } from "../rewardRules";
import type { RunRewardSummary } from "../types";
import UiBadge, { BadgeTone } from "~/shared/ui/UiBadge.vue";
import UiPanel from "~/shared/ui/UiPanel.vue";

const props = defineProps<{
  summary: RunRewardSummary;
  /** Hero id → display name, from the session members already loaded. */
  heroNames: ReadonlyMap<string, string>;
  currentPlayerId: string;
}>();

const groups = computed(() =>
  props.summary.distributions.map((distribution) => ({
    ...distribution,
    rewards: distribution.rewards.map((reward) => ({
      ...reward,
      rarityKey: normalizeRarity(reward.rarity),
      recipientViews: reward.recipients.map((recipient) =>
        describeRecipient(recipient, props.heroNames, props.currentPlayerId),
      ),
    })),
  })),
);
</script>

<template>
  <div class="reward-summary">
    <UiPanel
      v-for="group in groups"
      :key="group.causeId"
      :title="group.sourceType"
      :heading-level="3"
    >
      <ul class="reward-summary__list">
        <li
          v-for="(reward, index) in group.rewards"
          :key="`${reward.itemId}-${index}`"
          class="reward"
        >
          <p class="reward__title">
            <strong>{{ reward.name }}</strong> ×{{ reward.quantity }}
            <span :class="`reward__rarity reward__rarity--${reward.rarityKey}`">{{
              reward.rarity
            }}</span>
          </p>
          <UiBadge
            v-if="reward.kind === 'SHARED_PER_PARTICIPANT'"
            :tone="BadgeTone.ARCANE"
          >
            Received by each eligible participant
          </UiBadge>
          <ul class="reward__recipients">
            <li v-for="recipient in reward.recipientViews" :key="recipient.heroId">
              {{ recipient.heroName }}
              <UiBadge v-if="recipient.isYou" :tone="BadgeTone.SUCCESS">You</UiBadge>
            </li>
          </ul>
        </li>
      </ul>
    </UiPanel>
  </div>
</template>

<style scoped lang="scss">
.reward-summary {
  display: grid;
  gap: var(--space-4);
}
.reward-summary__list,
.reward__recipients {
  margin: 0;
  padding: 0;
  list-style: none;
}
.reward-summary__list {
  display: grid;
  gap: var(--space-4);
}
.reward__title {
  margin: 0 0 var(--space-2);
  color: var(--color-text-primary);
}
.reward__rarity {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.reward__recipients {
  display: grid;
  gap: var(--space-1);
  margin-top: var(--space-2);
  color: var(--color-text-muted);
}
</style>
