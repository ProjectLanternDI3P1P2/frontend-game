<script setup lang="ts">
import { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import { GatewayError } from "~/shared/utils/gateway";
import HeroCollectionCard from "~/features/player/components/HeroCollectionCard.vue";
import HeroCreateTile from "~/features/player/components/HeroCreateTile.vue";
import HeroPortraitPlaceholder from "~/features/player/components/HeroPortraitPlaceholder.vue";
import { usePlayerApi } from "~/features/player/api/playerApi";
import { findSelectedHeroId } from "~/features/player/utils/selectedHero";
import { HERO_ROSTER_CAPACITY, type HeroSummary } from "~/features/player/types";

definePageMeta({ layout: "player" });

const MAX_HEROES = HERO_ROSTER_CAPACITY;
const EMPTY_STATE_PORTRAITS = [
  { id: "warrior", classCode: "warrior" },
  { id: "mage", classCode: "mage" },
  { id: "shaman", classCode: "shaman" },
  { id: "mage-second", classCode: "mage" },
] as const;

const route = useRoute();
const playerId = computed(() => String(route.params.playerId));
const heroes = ref<HeroSummary[]>([]);
const selectedId = ref<string | null>(null);
const loading = ref(true);
const error = ref("");

const availableSlots = computed(() => Math.max(MAX_HEROES - heroes.value.length, 0));
const isAtHeroLimit = computed(() => heroes.value.length >= MAX_HEROES);
const createHeroPath = computed(
  () => `/players/${encodeURIComponent(playerId.value)}/heroes/new`,
);

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

onMounted(load);
</script>

<template>
  <main id="main" class="hero-roster">
    <header class="hero-roster__header">
      <div>
        <p class="hero-roster__eyebrow">Heroes</p>
        <h1>My heroes</h1>
      </div>
      <div class="hero-roster__header-actions">
        <p class="hero-roster__capacity">
          <strong>{{ heroes.length }}/{{ MAX_HEROES }}</strong>
          <span>heroes</span>
        </p>
        <NuxtLink v-if="!isAtHeroLimit" :to="createHeroPath">
          <UiButton :size="ButtonSize.SM" :variant="ButtonVariant.PRIMARY"
            >Create a hero</UiButton
          >
        </NuxtLink>
        <UiButton v-else disabled :size="ButtonSize.SM" :variant="ButtonVariant.PRIMARY"
          >Create a hero</UiButton
        >
      </div>
    </header>

    <div
      class="hero-roster__progress"
      :style="{ '--hero-roster-progress': `${(heroes.length / MAX_HEROES) * 100}%` }"
      aria-hidden="true"
    />

    <section
      v-if="error"
      class="hero-roster__message hero-roster__message--error"
      role="alert"
    >
      <p>{{ error }}</p>
      <UiButton :size="ButtonSize.SM" :variant="ButtonVariant.GHOST" @click="load"
        >Retry</UiButton
      >
    </section>

    <section v-else-if="loading" class="hero-roster__message" aria-live="polite">
      Loading heroes…
    </section>

    <section
      v-else-if="!heroes.length"
      class="hero-roster__empty"
      aria-labelledby="empty-title"
    >
      <div class="hero-roster__empty-portraits" aria-hidden="true">
        <HeroPortraitPlaceholder
          v-for="portrait in EMPTY_STATE_PORTRAITS"
          :key="portrait.id"
          :class-code="portrait.classCode"
        />
      </div>
      <p class="hero-roster__eyebrow">First visit</p>
      <h2 id="empty-title">No heroes yet</h2>
      <p>
        Create your first hero: choose a name and a class among Warrior, Shaman or Mage.
      </p>
      <NuxtLink :to="createHeroPath">
        <UiButton :size="ButtonSize.SM" :variant="ButtonVariant.PRIMARY"
          >Create my first hero</UiButton
        >
      </NuxtLink>
    </section>

    <template v-else>
      <section v-if="isAtHeroLimit" class="hero-roster__limit" role="status">
        <strong>Limit reached: {{ MAX_HEROES }} of {{ MAX_HEROES }} heroes</strong>
        <span>Your roster is full.</span>
      </section>

      <section class="hero-roster__cards" aria-label="My heroes">
        <HeroCollectionCard
          v-for="hero in heroes"
          :key="hero.id"
          :hero="hero"
          :selected="hero.id === selectedId"
          :to="`/players/${encodeURIComponent(playerId)}/heroes/${hero.id}`"
        />
        <HeroCreateTile
          v-if="availableSlots > 0"
          :available-slots="availableSlots"
          :to="createHeroPath"
        />
      </section>

      <p class="hero-roster__hint">
        The selected hero is the one used to create or join a game. A hero in session is
        engaged in an ongoing game.
      </p>
    </template>
  </main>
</template>

<style scoped lang="scss">
.hero-roster {
  width: min(100% - (var(--layout-gutter) * 2), 90rem);
  margin-inline: auto;
  padding-block: var(--space-6) var(--space-8);

  &__header,
  &__header-actions,
  &__empty,
  &__message,
  &__limit {
    display: flex;
  }

  &__header {
    align-items: end;
    justify-content: space-between;
    gap: var(--space-5);
  }

  &__header-actions {
    align-items: center;
    gap: var(--space-3);
  }

  &__eyebrow {
    margin: 0 0 var(--space-1);
    color: var(--color-text-highlight);
    font-size: 0.625rem;
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1,
  h2 {
    margin: 0;
    color: var(--color-text-primary);
    text-transform: uppercase;
  }

  h1 {
    font-size: var(--font-size-xl);
  }

  h2 {
    font-size: var(--font-size-lg);
  }

  &__capacity {
    display: grid;
    justify-items: end;
    margin: 0;
    color: var(--color-text-highlight);
    font-size: var(--font-size-xs);
    line-height: 1;
    text-transform: uppercase;
  }

  &__capacity span {
    color: var(--color-text-muted);
    font-size: 0.625rem;
  }

  &__progress {
    height: var(--space-1);
    margin-block: var(--space-5) var(--space-4);
    background: linear-gradient(
      to right,
      var(--color-accent) var(--hero-roster-progress),
      var(--color-border-subtle) var(--hero-roster-progress)
    );
  }

  &__message,
  &__limit {
    align-items: center;
    gap: var(--space-3);
    border: 1px solid var(--color-border-subtle);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface-raised);
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  &__message--error {
    justify-content: space-between;
    border-left: var(--space-1) solid var(--color-danger);
  }

  &__message p,
  &__limit strong,
  &__limit span {
    margin: 0;
  }

  &__limit {
    display: grid;
    gap: var(--space-1);
    border-left: var(--space-1) solid var(--color-arcane);
    margin-bottom: var(--space-4);
    font-size: var(--font-size-xs);
  }

  &__limit strong {
    color: var(--color-text-primary);
  }

  &__cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9.25rem, 1fr));
    gap: var(--space-3);
  }

  &__hint {
    margin: var(--space-4) 0 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
  }

  &__empty {
    min-height: 22rem;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    border: 1px solid var(--color-border-subtle);
    padding: var(--space-6);
    background: var(--color-surface-raised);
    text-align: center;
  }

  &__empty-portraits {
    display: flex;
    margin-bottom: var(--space-4);
    gap: var(--space-3);
  }

  &__empty > p:not(.hero-roster__eyebrow) {
    max-width: 30rem;
    margin: var(--space-3) 0 var(--space-5);
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }
}

@media (max-width: 36rem) {
  .hero-roster {
    &__header {
      align-items: start;
      flex-direction: column;
    }

    &__header-actions {
      width: 100%;
      justify-content: space-between;
    }

    &__cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    &__empty-portraits {
      gap: var(--space-2);
    }
  }
}
</style>
