<script setup lang="ts">
import { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import { NoticeTone } from "~/shared/ui/UiNotice.vue";
import { useToast } from "~/shared/composables/useToast";
import { GatewayError } from "~/shared/utils/gateway";
import { usePlayerApi } from "~/features/player/api/playerApi";
import HeroPortraitPlaceholder from "~/features/player/components/HeroPortraitPlaceholder.vue";
import type { HeroClassOption, HeroSheet, HeroSummary } from "~/features/player/types";

definePageMeta({ layout: "player" });

const route = useRoute();
const playerId = computed(() => String(route.params.playerId));
const heroId = computed(() => String(route.params.heroId));
const heroesPath = computed(
  () => "/players/" + encodeURIComponent(playerId.value) + "/heroes",
);
const hero = ref<HeroSheet | null>(null);
const heroSummary = ref<HeroSummary | null>(null);
const heroClass = ref<HeroClassOption | null>(null);
const loading = ref(true);
const updatingSelection = ref(false);
const error = ref("");
const { success } = useToast();

const isSelected = computed(() => heroSummary.value?.isSelected ?? false);
const isInActiveSession = computed(
  () => heroSummary.value?.isEngagedInActiveSession ?? false,
);
const heroClassLabel = computed(
  () =>
    heroClass.value?.label ??
    (hero.value
      ? hero.value.classCode.charAt(0).toUpperCase() + hero.value.classCode.slice(1)
      : ""),
);
const formattedCreatedAt = computed(() => {
  if (!hero.value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(hero.value.createdAt));
});
const identifier = computed(() =>
  hero.value ? "hero_" + hero.value.id.slice(0, 8) : "",
);
const selectionLabel = computed(() => {
  if (isInActiveSession.value) return "Hero in session";
  return isSelected.value ? "✓ Hero selected" : "Select this hero";
});
const selectionActionLabel = computed(() =>
  isSelected.value ? "Deselect this hero" : "Select this hero",
);

async function refreshHero() {
  const [loadedHero, heroes, heroClasses] = await Promise.all([
    usePlayerApi().getHeroSheet(playerId.value, heroId.value),
    usePlayerApi().listHeroes(playerId.value),
    usePlayerApi().listHeroClasses(),
  ]);
  hero.value = loadedHero;
  heroSummary.value = heroes.find((item) => item.id === loadedHero.id) ?? null;
  heroClass.value =
    heroClasses.find((item) => item.code === loadedHero.classCode) ?? null;
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    await refreshHero();
  } catch (cause) {
    error.value =
      cause instanceof GatewayError ? cause.message : "Unable to load this hero.";
  } finally {
    loading.value = false;
  }
}

async function toggleSelection() {
  if (!hero.value || isInActiveSession.value) return;

  updatingSelection.value = true;
  error.value = "";
  try {
    if (isSelected.value) {
      await usePlayerApi().deselectHero(playerId.value, hero.value.id);
      success(hero.value.name + " is no longer selected.", {
        title: "Hero deselected",
      });
    } else {
      await usePlayerApi().selectHero(playerId.value, hero.value.id);
      success(hero.value.name + " is ready for your next game.", {
        title: "Hero selected",
      });
    }
    await refreshHero();
  } catch (cause) {
    error.value =
      cause instanceof GatewayError
        ? cause.message
        : "Unable to update hero selection.";
  } finally {
    updatingSelection.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main id="main" class="hero-detail">
    <header class="hero-detail__header">
      <div>
        <p class="hero-detail__eyebrow">
          My heroes <span aria-hidden="true">/</span> {{ hero?.name }}
        </p>
        <h1>{{ hero?.name ?? "Hero" }}</h1>
      </div>
      <NuxtLink :to="heroesPath">← Back to my heroes</NuxtLink>
    </header>

    <UiNotice v-if="error" class="hero-detail__notice" :tone="NoticeTone.DANGER">
      {{ error }}
      <UiButton :size="ButtonSize.SM" :variant="ButtonVariant.GHOST" @click="load"
        >Retry</UiButton
      >
    </UiNotice>
    <UiNotice v-else-if="loading" class="hero-detail__notice" :tone="NoticeTone.INFO">
      Loading hero…
    </UiNotice>

    <template v-else-if="hero">
      <section
        v-if="isInActiveSession"
        class="hero-detail__session-notice"
        role="status"
      >
        <div>
          <strong>{{ hero.name }} is engaged in an active session</strong>
          <span>Selection cannot be changed until the game ends.</span>
        </div>
      </section>

      <div class="hero-detail__grid">
        <aside
          class="hero-detail__identity"
          :class="{
            'hero-detail__identity--selected': isSelected,
            'hero-detail__identity--in-session': isInActiveSession,
          }"
        >
          <p v-if="isSelected" class="hero-detail__state">Selected</p>
          <p v-else-if="isInActiveSession" class="hero-detail__state">In session</p>
          <div class="hero-detail__portrait">
            <HeroPortraitPlaceholder
              :class-code="hero.classCode"
              :label="hero.name + ' placeholder portrait'"
            />
          </div>
          <h2>{{ hero.name }}</h2>
          <p class="hero-detail__class-name">{{ heroClassLabel }}</p>
          <dl>
            <div>
              <dt>Created</dt>
              <dd>{{ formattedCreatedAt }}</dd>
            </div>
            <div>
              <dt>Identifier</dt>
              <dd>{{ identifier }}</dd>
            </div>
          </dl>
          <UiButton
            :size="ButtonSize.SM"
            :variant="isSelected ? ButtonVariant.SUCCESS : ButtonVariant.PRIMARY"
            :busy="updatingSelection"
            :disabled="isInActiveSession"
            full-width
            :aria-label="selectionActionLabel"
            @click="toggleSelection"
            >{{ selectionLabel }}</UiButton
          >
        </aside>

        <div class="hero-detail__panels">
          <section class="hero-detail__panel hero-detail__panel--class">
            <p class="hero-detail__label">Class</p>
            <h2>{{ heroClassLabel }}</h2>
            <p>
              {{ heroClass?.description ?? "Class details are currently unavailable." }}
            </p>
            <div class="hero-detail__abilities">
              <span v-for="ability in hero.abilities" :key="ability.code"
                >{{ ability.label }} · {{ ability.targetingType }}</span
              >
              <span v-if="!hero.abilities.length">First ability unavailable</span>
            </div>
          </section>

          <section class="hero-detail__panel hero-detail__panel--equipment">
            <div class="hero-detail__panel-heading">
              <div>
                <h2>Equipment</h2>
                <p>Managed by the inventory squad · Preview not designed here</p>
              </div>
              <span>Read-only</span>
            </div>
            <div class="hero-detail__equipment-slots" aria-label="Equipment slots">
              <div
                v-for="slot in [
                  'Right hand',
                  'Body',
                  'Left hand',
                  'Jewellery',
                  'Quick slot',
                ]"
                :key="slot"
              >
                <span aria-hidden="true" />
                <small>{{ slot }}</small>
              </div>
            </div>
            <a href="#inventory">Manage equipment in Inventory →</a>
          </section>

          <section
            id="inventory"
            class="hero-detail__panel hero-detail__panel--progress"
          >
            <div>
              <p class="hero-detail__label">Managed by the progression squad</p>
              <span>Level, experience and game history</span>
            </div>
            <a href="#inventory">View progression →</a>
          </section>
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped lang="scss">
.hero-detail {
  width: min(100% - (var(--layout-gutter) * 2), 90rem);
  margin-inline: auto;
  padding-block: var(--space-6) var(--space-8);

  &__header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-5);
    margin-bottom: var(--space-5);
  }

  &__header a,
  &__panel a {
    color: var(--color-text-highlight);
    font-family: var(--font-family-display);
    font-size: var(--font-size-xs);
    text-decoration: none;
  }

  &__eyebrow,
  &__label {
    margin: 0 0 var(--space-1);
    color: var(--color-text-highlight);
    font-size: 0.625rem;
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    margin-top: 0;
  }

  h1,
  h2 {
    color: var(--color-text-primary);
    text-transform: uppercase;
  }

  h1 {
    margin-bottom: 0;
    font-size: var(--font-size-xl);
  }

  h2 {
    margin-bottom: var(--space-2);
    font-size: var(--font-size-md);
  }

  &__notice {
    margin-bottom: var(--space-4);
  }

  &__session-notice {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--space-4);
    border: 1px solid var(--color-border-subtle);
    border-left: var(--space-1) solid var(--color-accent);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface-raised);
  }

  &__session-notice div {
    display: grid;
    gap: var(--space-1);
  }

  &__session-notice strong {
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
  }

  &__session-notice span,
  &__panel p,
  &__panel span {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
  }

  &__grid {
    display: grid;
    grid-template-columns: minmax(14rem, 0.35fr) minmax(0, 1fr);
    align-items: start;
    gap: var(--space-4);
  }

  &__identity,
  &__panel {
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-raised);
  }

  &__identity {
    position: relative;
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  &__identity--selected {
    border-color: var(--color-success);
  }

  &__identity--in-session {
    border-color: var(--color-accent);
  }

  &__state {
    min-height: 0.75rem;
    margin: 0;
    color: var(--color-success);
    font-size: 0.5625rem;
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  &__identity--in-session &__state {
    color: var(--color-accent);
  }

  &__portrait {
    display: grid;
    min-height: 10rem;
    place-items: center;
    background: var(--color-surface-overlay);
  }

  &__portrait :deep(.hero-portrait) {
    width: 7rem;
    height: 7rem;
  }

  &__portrait :deep(.hero-portrait__sprite) {
    transform: scale(2);
  }

  &__identity h2 {
    margin: 0;
    overflow-wrap: anywhere;
  }

  &__class-name {
    margin-bottom: 0;
    color: var(--color-text-highlight);
    font-size: var(--font-size-sm);
  }

  dl {
    display: grid;
    gap: var(--space-2);
    margin: 0;
  }

  dl div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
  }

  dt,
  dd {
    font-size: var(--font-size-xs);
  }

  dt {
    color: var(--color-text-muted);
  }

  dd {
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-family-mono);
    overflow-wrap: anywhere;
    text-align: right;
  }

  &__panels {
    display: grid;
    gap: var(--space-3);
  }

  &__panel {
    padding: var(--space-4);
  }

  &__panel--class {
    min-height: 8rem;
  }

  &__panel--class > p:not(.hero-detail__label) {
    max-width: 46rem;
    margin-bottom: var(--space-3);
    line-height: var(--line-height-tight);
  }

  &__abilities {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  &__abilities span {
    color: var(--color-text-highlight);
  }

  &__panel--equipment,
  &__panel--progress {
    border-style: dashed;
  }

  &__panel-heading,
  &__panel--progress {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: var(--space-4);
  }

  &__panel-heading h2 {
    margin-bottom: var(--space-1);
  }

  &__panel-heading p {
    margin-bottom: 0;
    font-size: 0.5625rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  &__panel-heading > span {
    border: 1px solid var(--color-border-strong);
    padding: var(--space-1) var(--space-2);
    font-size: 0.5625rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  &__equipment-slots {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--space-2);
    margin-block: var(--space-4) var(--space-3);
  }

  &__equipment-slots > div {
    display: grid;
    gap: var(--space-1);
    color: var(--color-text-muted);
    font-size: 0.5625rem;
    text-align: center;
  }

  &__equipment-slots span {
    display: block;
    aspect-ratio: 1;
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-overlay);
  }

  &__equipment-slots small {
    font-size: 0.5625rem;
  }

  &__panel--progress {
    align-items: center;
  }

  &__panel--progress p,
  &__panel--progress span {
    margin-bottom: 0;
  }
}

@media (max-width: 48rem) {
  .hero-detail {
    &__header,
    &__panel-heading,
    &__panel--progress {
      align-items: start;
      flex-direction: column;
    }

    &__grid {
      grid-template-columns: 1fr;
    }

    &__identity {
      grid-template-columns: 1fr 1fr;
    }

    &__identity > :is(.hero-detail__state, .hero-detail__portrait, h2) {
      grid-column: 1 / -1;
    }
  }
}

@media (max-width: 30rem) {
  .hero-detail {
    &__header {
      flex-direction: column;
    }

    &__identity {
      grid-template-columns: 1fr;
    }

    &__equipment-slots {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
}
</style>
