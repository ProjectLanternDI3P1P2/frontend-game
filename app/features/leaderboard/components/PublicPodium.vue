<script setup lang="ts">
/**
 * The three best heroes in cards (F04 CA3). Each medal is a text badge
 * ("1st · Gold"), so the rank never depends on colour alone (RGAA).
 */
import UiBadge, { BadgeSize } from "~/shared/ui/UiBadge.vue";
import { HERO_CLASS_LABELS, displayPlayerName, podiumMedal } from "../leaderboardRules";
import { formatCount } from "../statisticsRules";
import type { RankingEntry } from "../types";

defineProps<{ entries: RankingEntry[] }>();

const MEDAL_LABELS = { gold: "Gold", silver: "Silver", bronze: "Bronze" } as const;
const ORDINALS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };

function medalLabel(rank: number): string {
  const medal = podiumMedal(rank);
  const ordinal = ORDINALS[rank] ?? `#${rank}`;
  return medal ? `${ordinal} · ${MEDAL_LABELS[medal]}` : ordinal;
}
</script>

<template>
  <section class="public-podium" aria-labelledby="public-podium-title">
    <h2 id="public-podium-title" class="public-podium__title">Podium</h2>
    <ol role="list" class="public-podium__list">
      <li
        v-for="entry in entries"
        :key="entry.heroId"
        class="public-podium__card"
        :class="`public-podium__card--${podiumMedal(entry.rank) ?? 'none'}`"
      >
        <UiBadge :size="BadgeSize.SM" outlined class="public-podium__medal">
          {{ medalLabel(entry.rank) }}
        </UiBadge>
        <h3 class="public-podium__hero">{{ entry.heroName }}</h3>
        <p class="public-podium__player">{{ displayPlayerName(entry) }}</p>
        <dl class="public-podium__facts">
          <div>
            <dt>Class</dt>
            <dd>{{ HERO_CLASS_LABELS[entry.heroClass] ?? entry.heroClass }}</dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{{ entry.level }}</dd>
          </div>
          <div>
            <dt>Total XP</dt>
            <dd class="public-podium__number">{{ formatCount(entry.totalXp) }}</dd>
          </div>
        </dl>
      </li>
    </ol>
  </section>
</template>

<style scoped lang="scss">
.public-podium {
  display: grid;
  gap: var(--space-3);

  &__title {
    margin: 0;
    font-size: var(--font-size-lg);
  }

  &__list {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__card {
    display: grid;
    align-content: start;
    gap: var(--space-2);
    border: 1px solid var(--color-border-subtle);
    border-block-start-width: var(--space-1);
    border-radius: var(--radius-sm);
    padding: var(--space-4);
    background-color: var(--color-surface-raised);

    &--gold {
      border-color: var(--color-accent);
    }

    &--silver {
      border-color: var(--color-rarity-common);
    }

    &--bronze {
      border-color: var(--color-rarity-legendary);
    }
  }

  &__hero {
    margin: 0;
    font-family: var(--font-family-display);
    font-size: var(--font-size-lg);
    overflow-wrap: anywhere;
  }

  &__player {
    margin: 0;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  &__facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
    margin: 0;

    dt {
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    dd {
      margin: 0;
      font-weight: var(--font-weight-bold);
    }
  }

  &__number {
    font-family: var(--font-family-mono);
    font-variant-numeric: tabular-nums;
  }

  @include bp.from("md") {
    &__list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
}
</style>
