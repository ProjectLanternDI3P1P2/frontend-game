<script setup lang="ts">
import { ButtonVariant } from "~/shared/ui/UiButton.vue";
import { BadgeTone } from "~/shared/ui/UiBadge.vue";
import { NoticeTone } from "~/shared/ui/UiNotice.vue";
import { PanelVariant } from "~/shared/ui/UiPanel.vue";
import { GatewayError } from "~/shared/utils/gateway";
import { createIdempotencyKey } from "~/shared/utils/idempotency";
import { usePlayerApi } from "~/features/player/api/playerApi";
import type { HeroSummary, StartSoloRunResponse } from "~/features/player/types";

const route = useRoute();
const playerId = computed(() => String(route.params.playerId));
const heroes = ref<HeroSummary[]>([]);
const selectedId = ref<string | null>(
  typeof route.query.heroId === "string" ? route.query.heroId : null,
);
const result = ref<StartSoloRunResponse | null>(null);
const loading = ref(true);
const starting = ref(false);
const error = ref("");
let idempotencyKey: string | null = null;
const selectedHero = computed(
  () => heroes.value.find((hero) => hero.id === selectedId.value) ?? null,
);
async function load() {
  loading.value = true;
  error.value = "";
  try {
    heroes.value = await usePlayerApi().listHeroes(playerId.value);
    if (!selectedHero.value)
      selectedId.value =
        heroes.value.find((hero) => !hero.isEngagedInActiveSession)?.id ?? null;
  } catch (cause) {
    error.value =
      cause instanceof GatewayError ? cause.message : "Unable to load heroes.";
  } finally {
    loading.value = false;
  }
}
async function start() {
  if (!selectedHero.value || selectedHero.value.isEngagedInActiveSession) return;
  starting.value = true;
  error.value = "";
  idempotencyKey ??= createIdempotencyKey();
  try {
    result.value = await usePlayerApi().startSoloRun(
      playerId.value,
      selectedHero.value.id,
      { idempotencyKey },
    );
  } catch (cause) {
    error.value =
      cause instanceof GatewayError ? cause.message : "Unable to start a run.";
  } finally {
    starting.value = false;
  }
}
onMounted(load);
</script>

<template>
  <main class="play-page">
    <header>
      <p class="eyebrow">Play</p>
      <h1>Start a solo run</h1>
    </header>
    <UiNotice v-if="error" :tone="NoticeTone.DANGER"
      >{{ error }}
      <UiButton :variant="ButtonVariant.GHOST" @click="result ? start() : load()"
        >Retry</UiButton
      ></UiNotice
    >
    <UiNotice v-else-if="loading" :tone="NoticeTone.INFO"
      >Loading your heroes…</UiNotice
    >
    <template v-else
      ><UiNotice v-if="!heroes.length" :tone="NoticeTone.INFO"
        >Create a hero before starting a run.</UiNotice
      >
      <section v-else class="play-page__grid">
        <UiPanel title="Select a hero"
          ><div class="hero-list">
            <UiHeroCard
              v-for="hero in heroes"
              :key="hero.id"
              :hero="hero"
              :selected="selectedId === hero.id"
              interactive
              @select="selectedId = hero.id"
            /></div
        ></UiPanel>
        <UiPanel title="Create a game" :variant="PanelVariant.INSET"
          ><template v-if="selectedHero"
            ><p>
              Selected hero:
              <strong class="play-page__selected-hero-name">{{
                selectedHero.name
              }}</strong>
            </p>
            <p>{{ selectedHero.classCode }} · level {{ selectedHero.level }}</p>
            <UiNotice
              v-if="selectedHero.isEngagedInActiveSession"
              :tone="NoticeTone.DANGER"
              >This hero is already in an active session.</UiNotice
            ><UiButton
              v-else
              :variant="ButtonVariant.PRIMARY"
              :busy="starting"
              @click="start"
              >Create a game</UiButton
            ></template
          >
          <p v-else>Select a hero to continue.</p></UiPanel
        >
      </section>
      <UiPanel v-if="result" title="Dungeon generation"
        ><UiBadge
          :tone="result.state === 'Active' ? BadgeTone.SUCCESS : BadgeTone.DANGER"
          >{{ result.state }}</UiBadge
        >
        <p v-if="result.state === 'Active'">
          Session {{ result.sessionId }} is ready. Dungeon seed:
          {{ result.dungeonSeed }}.
        </p>
        <UiNotice v-else :tone="NoticeTone.DANGER">{{
          result.failureReason ?? "Dungeon generation did not complete."
        }}</UiNotice></UiPanel
      >
    </template>
  </main>
</template>

<style scoped lang="scss">
.play-page {
  display: grid;
  gap: var(--space-5);
  max-width: var(--layout-max-width);
  margin: 0 auto;
  padding: var(--space-7) var(--layout-gutter);
}
.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--color-text-highlight);
  font-size: var(--font-size-sm);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  color: var(--color-text-primary);
  font-family: var(--font-family-display);
}
.play-page__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.5fr);
  gap: var(--space-5);
}
.hero-list {
  display: grid;
  gap: var(--space-3);
}
.play-page__selected-hero-name {
  overflow-wrap: anywhere;
}
@media (max-width: 48rem) {
  .play-page__grid {
    grid-template-columns: 1fr;
  }
}
</style>
