<script setup lang="ts">
import { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import { HERO_ROSTER_CAPACITY, type HeroSheet } from "../types";
import HeroPortraitPlaceholder from "./HeroPortraitPlaceholder.vue";

const props = defineProps<{
  hero: HeroSheet;
  heroCount: number;
  selecting: boolean;
  selectionError?: string;
  heroesPath: string;
  createHeroPath: string;
}>();

defineEmits<{ select: [] }>();

const formattedCreatedAt = computed(() =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(props.hero.createdAt)),
);
const heroClassLabel = computed(
  () => props.hero.classCode.charAt(0).toUpperCase() + props.hero.classCode.slice(1),
);
const canCreateAnotherHero = computed(() => props.heroCount < HERO_ROSTER_CAPACITY);
</script>

<template>
  <main id="main" class="hero-created-confirmation">
    <section class="hero-created-confirmation__content" aria-labelledby="created-title">
      <div class="hero-created-confirmation__portrait">
        <HeroPortraitPlaceholder
          :class-code="hero.classCode"
          :label="`${hero.name} placeholder portrait`"
        />
      </div>
      <p class="hero-created-confirmation__status">New hero</p>
      <h1 id="created-title">{{ hero.name }} has joined your heroes</h1>
      <p class="hero-created-confirmation__metadata">
        {{ heroClassLabel }} · created {{ formattedCreatedAt }} · {{ heroCount }} of
        {{ HERO_ROSTER_CAPACITY }} heroes
      </p>

      <p v-if="selectionError" class="hero-created-confirmation__error" role="alert">
        {{ selectionError }}
      </p>
      <div class="hero-created-confirmation__actions">
        <UiButton
          :size="ButtonSize.MD"
          :variant="ButtonVariant.PRIMARY"
          :busy="selecting"
          @click="$emit('select')"
          >Select this hero</UiButton
        >
        <NuxtLink :to="heroesPath">
          <UiButton :size="ButtonSize.MD" :variant="ButtonVariant.SECONDARY"
            >View my heroes</UiButton
          >
        </NuxtLink>
      </div>
      <NuxtLink
        v-if="canCreateAnotherHero"
        class="hero-created-confirmation__create-another"
        :to="createHeroPath"
        >Create another hero</NuxtLink
      >
      <UiButton
        v-else
        class="hero-created-confirmation__create-another"
        :size="ButtonSize.SM"
        :variant="ButtonVariant.GHOST"
        disabled
        >Create another hero</UiButton
      >
    </section>
  </main>
</template>

<style scoped lang="scss">
.hero-created-confirmation {
  display: grid;
  min-height: calc(100vh - 4rem);
  padding: var(--space-7) var(--layout-gutter);
  place-items: center;

  &__content {
    display: grid;
    width: min(100%, 42rem);
    justify-items: center;
    text-align: center;
  }

  &__portrait {
    display: grid;
    width: 12rem;
    height: 12rem;
    margin-bottom: var(--space-4);
    place-items: center;
    border: 2px solid var(--color-success);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
  }

  &__portrait :deep(.hero-portrait) {
    width: 10rem;
    height: 10rem;
  }

  &__portrait :deep(.hero-portrait__sprite) {
    transform: scale(2.25);
  }

  &__status {
    margin: 0 0 var(--space-5);
    border: 1px solid var(--color-success);
    padding: var(--space-1) var(--space-2);
    color: var(--color-success);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  &__status::before {
    content: "● ";
  }

  h1 {
    max-width: 100%;
    margin: 0;
    color: var(--color-text-primary);
    font-size: clamp(var(--font-size-xl), 4vw, 2.5rem);
    overflow-wrap: anywhere;
    text-transform: uppercase;
  }

  &__metadata {
    margin: var(--space-4) 0 var(--space-5);
    color: var(--color-text-muted);
    font-family: var(--font-family-display);
    font-size: var(--font-size-md);
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-3);
  }

  &__actions a,
  &__create-another {
    text-decoration: none;
  }

  &__create-another {
    margin-top: var(--space-5);
    color: var(--color-text-highlight);
    font-family: var(--font-family-display);
  }

  &__error {
    margin: 0 0 var(--space-4);
    color: var(--color-danger);
    font-size: var(--font-size-sm);
  }
}

@media (max-width: 36rem) {
  .hero-created-confirmation {
    &__portrait {
      width: 10rem;
      height: 10rem;
    }

    &__portrait :deep(.hero-portrait) {
      width: 8rem;
      height: 8rem;
    }
  }
}
</style>
