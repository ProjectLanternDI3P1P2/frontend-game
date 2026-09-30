<script setup lang="ts">
import { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import { NoticeTone } from "~/shared/ui/UiNotice.vue";
import { useToast } from "~/shared/composables/useToast";
import { GatewayError } from "~/shared/utils/gateway";
import { createIdempotencyKey } from "~/shared/utils/idempotency";
import { usePlayerApi } from "~/features/player/api/playerApi";
import HeroPortraitPlaceholder from "~/features/player/components/HeroPortraitPlaceholder.vue";
import type { HeroSummary, StartSoloRunResponse } from "~/features/player/types";
import { findSelectedHeroId } from "~/features/player/utils/selectedHero";

definePageMeta({ layout: "player" });

const route = useRoute();
const playerId = computed(() => String(route.params.playerId));
const heroes = ref<HeroSummary[]>([]);
const selectedId = ref<string | null>(null);
const result = ref<StartSoloRunResponse | null>(null);
const loading = ref(true);
const starting = ref(false);
const error = ref("");
const { success } = useToast();
let idempotencyKey: string | null = null;

const selectedHero = computed(
  () => heroes.value.find((hero) => hero.id === selectedId.value) ?? null,
);
const activeSessionHero = computed(
  () => heroes.value.find((hero) => hero.isEngagedInActiveSession) ?? null,
);
const displayedHero = computed(() => selectedHero.value ?? activeSessionHero.value);
const canCreateGame = computed(
  () => Boolean(selectedHero.value) && !selectedHero.value?.isEngagedInActiveSession,
);
const heroesPath = computed(
  () => `/players/${encodeURIComponent(playerId.value)}/heroes`,
);
const createHeroPath = computed(() => `${heroesPath.value}/new`);

function heroClassLabel(classCode: HeroSummary["classCode"]): string {
  return `${classCode.charAt(0).toUpperCase()}${classCode.slice(1)}`;
}

async function load() {
  loading.value = true;
  error.value = "";

  try {
    heroes.value = await usePlayerApi().listHeroes(playerId.value);
    selectedId.value = findSelectedHeroId(heroes.value);
  } catch (cause) {
    error.value =
      cause instanceof GatewayError ? cause.message : "Unable to load heroes.";
  } finally {
    loading.value = false;
  }
}

async function start() {
  const hero = selectedHero.value;
  if (!hero || hero.isEngagedInActiveSession) return;

  starting.value = true;
  error.value = "";
  idempotencyKey ??= createIdempotencyKey();

  try {
    result.value = await usePlayerApi().startSoloRun(playerId.value, hero.id, {
      idempotencyKey,
    });
    success(`${hero.name} is ready for the run.`, { title: "Game created" });
    await load();
  } catch (cause) {
    error.value =
      cause instanceof GatewayError ? cause.message : "Unable to create a game.";
  } finally {
    starting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main id="main" class="play-page">
    <header class="play-page__header">
      <div>
        <p class="play-page__eyebrow">Play</p>
        <h1>Welcome, adventurer</h1>
      </div>
    </header>

    <UiNotice v-if="error" :tone="NoticeTone.DANGER" class="play-page__notice">
      {{ error }}
      <UiButton :size="ButtonSize.SM" :variant="ButtonVariant.GHOST" @click="load"
        >Retry</UiButton
      >
    </UiNotice>
    <UiNotice v-else-if="loading" :tone="NoticeTone.INFO" class="play-page__notice"
      >Loading your heroes…</UiNotice
    >

    <section v-else class="play-page__layout">
      <aside class="play-page__hero-card" aria-labelledby="selected-hero-title">
        <p id="selected-hero-title" class="play-page__eyebrow">Hero selected</p>

        <template v-if="displayedHero">
          <p
            v-if="displayedHero.isEngagedInActiveSession"
            class="play-page__hero-state play-page__hero-state--session"
          >
            In session
          </p>
          <p v-else-if="selectedHero" class="play-page__hero-state">Selected</p>
          <div class="play-page__hero-portrait">
            <HeroPortraitPlaceholder
              :class-code="displayedHero.classCode"
              :label="`${displayedHero.name} placeholder portrait`"
            />
          </div>
          <h2>{{ displayedHero.name }}</h2>
          <p class="play-page__hero-class">
            {{ heroClassLabel(displayedHero.classCode) }}
          </p>
          <NuxtLink
            :to="heroesPath"
            class="play-page__button play-page__button--secondary"
            >Change hero</NuxtLink
          >
        </template>

        <template v-else>
          <div
            class="play-page__hero-portrait play-page__hero-portrait--empty"
            aria-hidden="true"
          >
            ?
          </div>
          <h2>No hero selected</h2>
          <p class="play-page__hero-empty-copy">
            Select a hero before creating or joining a game.
          </p>
          <NuxtLink :to="createHeroPath" class="play-page__button"
            >Create a hero</NuxtLink
          >
          <NuxtLink
            :to="heroesPath"
            class="play-page__button play-page__button--secondary"
            >Choose from my heroes</NuxtLink
          >
        </template>
      </aside>

      <div class="play-page__content">
        <section
          v-if="activeSessionHero"
          class="play-page__session"
          aria-labelledby="session-title"
        >
          <div class="play-page__session-portraits" aria-hidden="true">
            <HeroPortraitPlaceholder :class-code="activeSessionHero.classCode" />
          </div>
          <div>
            <p class="play-page__eyebrow">Session in progress</p>
            <h2 id="session-title">Resume my ongoing session</h2>
            <p>{{ activeSessionHero.name }} is already engaged in an active game.</p>
          </div>
          <UiButton :size="ButtonSize.SM" :variant="ButtonVariant.PRIMARY" disabled
            >Resume</UiButton
          >
        </section>

        <section class="play-page__actions" aria-label="Game actions">
          <article class="play-page__action-card">
            <h2>Create a game</h2>
            <p>
              Open a lobby with your hero. You will be its creator and decide who
              starts.
            </p>
            <UiButton
              :size="ButtonSize.SM"
              :variant="ButtonVariant.PRIMARY"
              :busy="starting"
              :disabled="!canCreateGame"
              @click="start"
              >{{ starting ? "Creating…" : "Create a game" }}</UiButton
            >
            <p v-if="!selectedHero" class="play-page__action-hint">
              A selected hero is required to create a game.
            </p>
          </article>

          <article class="play-page__action-card">
            <h2>Join a game</h2>
            <p>Enter a friend’s code or pick an open lobby.</p>
            <UiButton :size="ButtonSize.SM" :variant="ButtonVariant.GHOST" disabled
              >Join a game</UiButton
            >
          </article>
        </section>

        <p v-if="result" class="play-page__created" role="status">
          Game created. Session {{ result.sessionId }} is ready.
        </p>

        <section class="play-page__services" aria-label="Player services">
          <article class="play-page__service-card">
            <p class="play-page__eyebrow">Managed by the inventory squad</p>
            <h2>Inventory</h2>
            <p>Prepare your hero’s equipment before heading out.</p>
            <a href="#inventory">Open inventory →</a>
          </article>
          <article class="play-page__service-card">
            <p class="play-page__eyebrow">Managed by the progression squad</p>
            <h2>Leaderboard</h2>
            <p>Compare your feats with other parties.</p>
            <a href="#leaderboard">View leaderboard →</a>
          </article>
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
.play-page {
  width: min(100% - (var(--layout-gutter) * 2), 90rem);
  margin-inline: auto;
  padding-block: var(--space-6) var(--space-8);

  &__header {
    margin-bottom: var(--space-5);
  }

  &__header h1,
  h2 {
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-family-display);
    text-transform: uppercase;
  }

  &__header h1 {
    font-size: var(--font-size-xl);
  }

  &__eyebrow {
    margin: 0 0 var(--space-1);
    color: var(--color-text-highlight);
    font-size: 0.625rem;
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  &__notice {
    margin-bottom: var(--space-4);
  }

  &__layout {
    display: grid;
    grid-template-columns: minmax(12rem, 14rem) minmax(0, 1fr);
    gap: var(--space-5);
    align-items: start;
  }

  &__hero-card,
  &__action-card,
  &__service-card,
  &__session {
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-raised);
  }

  &__hero-card {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  &__hero-state {
    min-height: 0.75rem;
    margin: calc(var(--space-2) * -1) 0 0;
    color: var(--color-text-highlight);
    font-size: 0.5625rem;
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.1em;
    text-transform: uppercase;

    &--session {
      color: var(--color-accent);
    }
  }

  &__hero-portrait {
    display: grid;
    min-height: 8rem;
    place-items: center;
    background: var(--color-surface-overlay);

    :deep(.hero-portrait) {
      width: 5.5rem;
      height: 5.5rem;
    }

    :deep(.hero-portrait__sprite) {
      transform: scale(1.45);
    }

    &--empty {
      color: var(--color-text-muted);
      font-family: var(--font-family-display);
      font-size: var(--font-size-2xl);
    }
  }

  &__hero-card h2,
  &__action-card h2,
  &__service-card h2,
  &__session h2 {
    font-size: var(--font-size-md);
  }

  &__hero-class,
  &__hero-empty-copy,
  &__action-card p,
  &__service-card p,
  &__session p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
  }

  &__hero-class {
    margin-top: calc(var(--space-2) * -1);
    color: var(--color-text-highlight);
  }

  &__button {
    display: inline-flex;
    min-height: 2.25rem;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-accent-strong);
    padding: var(--space-1) var(--space-3);
    background: var(--color-accent);
    color: var(--color-text-inverse);
    font-family: var(--font-family-display);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    text-decoration: none;

    &:hover {
      background: var(--color-accent-strong);
    }

    &--secondary {
      border-color: var(--color-border-strong);
      background: var(--color-surface-overlay);
      color: var(--color-text-primary);

      &:hover {
        border-color: var(--color-accent);
        background: var(--color-surface-raised);
      }
    }
  }

  &__content {
    display: grid;
    gap: var(--space-4);
  }

  &__session {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-3);
    border-color: var(--color-accent-strong);
    padding: var(--space-3);
  }

  &__session-portraits {
    display: flex;
    padding: var(--space-2);
    background: var(--color-surface-overlay);

    :deep(.hero-portrait) {
      width: 2.25rem;
      height: 2.25rem;
    }
  }

  &__actions,
  &__services {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }

  &__action-card,
  &__service-card {
    display: grid;
    align-content: start;
    gap: var(--space-3);
    min-height: 9rem;
    padding: var(--space-4);
  }

  &__action-card p {
    min-height: 2.5rem;
  }

  &__action-hint {
    min-height: auto !important;
    color: var(--color-text-muted) !important;
  }

  &__created {
    margin: 0;
    border-left: var(--space-1) solid var(--color-success);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
  }

  &__service-card {
    min-height: 7rem;
    border-style: dashed;
  }

  &__service-card p {
    min-height: 0;
  }

  &__service-card a {
    color: var(--color-text-highlight);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    text-decoration: none;
  }

  &__service-card a:hover {
    text-decoration: underline;
  }
}

@media (max-width: 48rem) {
  .play-page {
    &__layout {
      grid-template-columns: 1fr;
    }

    &__hero-card {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: center;
    }

    &__hero-card > .play-page__eyebrow,
    &__hero-card > .play-page__hero-state {
      grid-column: 1 / -1;
    }
  }
}

@media (max-width: 36rem) {
  .play-page {
    &__actions,
    &__services,
    &__session {
      grid-template-columns: 1fr;
    }

    &__hero-card {
      grid-template-columns: 1fr;
    }

    &__hero-card > .play-page__eyebrow,
    &__hero-card > .play-page__hero-state {
      grid-column: auto;
    }
  }
}
</style>
