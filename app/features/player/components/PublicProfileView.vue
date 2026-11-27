<script setup lang="ts">
/**
 * US-PLAYER-06 — public profile of a player: display name, New Game+ level,
 * public counters and heroes. Presentational: the page reads the state
 * (`usePublicProfile`) and hands it over, so the view renders the same on the
 * server and the client. Only the contract fields are ever shown.
 */
import { computed } from "vue";
import {
  PublicProfileStatus,
  type PublicProfileState,
} from "../composables/usePublicProfile";
import UiButton, { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import UiNotice, { NoticeTone } from "~/shared/ui/UiNotice.vue";
import UiPanel, { PanelHeadingLevel } from "~/shared/ui/UiPanel.vue";
import UiStat, { StatTone } from "~/shared/ui/UiStat.vue";

const props = withDefaults(
  defineProps<{ state: PublicProfileState; refreshing?: boolean }>(),
  { refreshing: false },
);

defineEmits<{ retry: [] }>();

const profile = computed(() =>
  props.state.status === PublicProfileStatus.READY ? props.state.profile : null,
);
const title = computed(() => profile.value?.displayName || "Player profile");
const loading = computed(
  () => props.state.status === PublicProfileStatus.LOADING || props.refreshing,
);
const loadingLabel = computed(() =>
  props.refreshing ? "Refreshing profile…" : "Loading profile…",
);
</script>

<template>
  <article class="public-profile" aria-labelledby="public-profile-title">
    <header class="public-profile__header">
      <p class="public-profile__eyebrow">Player profile</p>
      <h1 id="public-profile-title" class="public-profile__title">{{ title }}</h1>
      <p v-if="profile" class="public-profile__handle">@{{ profile.publicHandle }}</p>
    </header>

    <!-- Always in the accessibility tree, so that changes are announced. -->
    <p
      class="public-profile__live"
      :class="{ 'visually-hidden': !loading }"
      aria-live="polite"
    >
      <template v-if="loading">{{ loadingLabel }}</template>
    </p>

    <UiNotice
      v-if="state.status === PublicProfileStatus.ERROR"
      :tone="NoticeTone.DANGER"
      title="The profile could not be loaded"
    >
      <p class="public-profile__error">{{ state.errorMessage }}</p>
      <UiButton
        :size="ButtonSize.SM"
        :variant="ButtonVariant.SECONDARY"
        @click="$emit('retry')"
        >Retry</UiButton
      >
    </UiNotice>

    <template v-if="profile">
      <section
        class="public-profile__summary"
        aria-labelledby="public-profile-summary-title"
      >
        <h2 id="public-profile-summary-title" class="visually-hidden">Summary</h2>
        <ul class="public-profile__stats" role="list">
          <li>
            <UiStat
              label="New Game+ level"
              :value="profile.newGamePlusLevel"
              :tone="StatTone.ARCANE"
            />
          </li>
          <li><UiStat label="Heroes" :value="profile.counters.heroCount" /></li>
          <li>
            <UiStat
              label="Highest hero level"
              :value="profile.counters.highestHeroLevel"
            />
          </li>
          <li>
            <UiStat
              label="Completed sessions"
              :value="profile.counters.completedSessionCount"
            />
          </li>
        </ul>
      </section>

      <UiPanel title="Heroes" :heading-level="PanelHeadingLevel.TWO">
        <ul v-if="profile.heroes.length > 0" class="public-profile__heroes" role="list">
          <li
            v-for="(hero, index) in profile.heroes"
            :key="`${index}-${hero.name}`"
            class="public-profile__hero"
          >
            <h3 class="public-profile__hero-name">{{ hero.name }}</h3>
            <p class="public-profile__hero-meta">
              <span>{{ hero.className }}</span>
              <span aria-hidden="true"> · </span>
              <span>Level {{ hero.level }}</span>
            </p>
          </li>
        </ul>
        <p v-else class="public-profile__empty">This player has no hero yet.</p>
      </UiPanel>
    </template>
  </article>
</template>

<style scoped lang="scss">
.public-profile {
  display: grid;
  gap: var(--space-6);
  width: 100%;

  &__header {
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
    overflow-wrap: anywhere;
  }

  &__handle {
    margin: 0;
    color: var(--color-text-muted);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-sm);
  }

  &__live {
    margin: 0;
    color: var(--color-text-muted);
  }

  &__error {
    margin: 0 0 var(--space-3);
  }

  &__stats,
  &__heroes {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__hero {
    display: grid;
    gap: var(--space-1);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
    padding: var(--space-3) var(--space-4);
    background-color: var(--color-surface-raised);
  }

  &__hero-name {
    margin: 0;
    font-size: var(--font-size-lg);
    overflow-wrap: anywhere;
  }

  &__hero-meta,
  &__empty {
    margin: 0;
    color: var(--color-text-muted);
  }

  &__hero-meta {
    font-size: var(--font-size-sm);
  }

  @include bp.from("md") {
    &__title {
      font-size: var(--font-size-2xl);
    }

    &__stats {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    &__heroes {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}
</style>
