<script setup lang="ts">
import { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import { usePlayerApi } from "~/features/player/api/playerApi";
import {
  PlayerHubClient,
  PlayerHubError,
  playerHubUrl,
} from "~/features/player/api/playerHub";
import HeroPortraitPlaceholder from "~/features/player/components/HeroPortraitPlaceholder.vue";
import HeroSelectionModal from "~/features/player/components/HeroSelectionModal.vue";
import type { HeroSummary } from "~/features/player/types";
import { createIdempotencyKey } from "~/shared/utils/idempotency";
import { findSelectedHeroId } from "~/features/player/utils/selectedHero";

definePageMeta({ layout: "player" });

const route = useRoute();
const router = useRouter();
const playerId = computed(() => String(route.params.playerId));
const heroes = ref<HeroSummary[]>([]);
const selectedId = ref<string | null>(null);
const loading = ref(true);
const creating = ref(false);
const selectingHero = ref(false);
const heroPickerOpen = ref(false);
const error = ref("");
let hub: PlayerHubClient | null = null;
const selectedHero = computed(
  () => heroes.value.find((hero) => hero.id === selectedId.value) ?? null,
);
const isJoinScreen = computed(
  () => route.path === `/players/${encodeURIComponent(playerId.value)}/play`,
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    heroes.value = await usePlayerApi().listHeroes(playerId.value);
    selectedId.value = findSelectedHeroId(heroes.value);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Unable to load heroes.";
  } finally {
    loading.value = false;
  }
}

async function createLobby(): Promise<void> {
  if (!selectedHero.value || selectedHero.value.isEngagedInActiveSession) return;
  creating.value = true;
  error.value = "";
  try {
    const config = useRuntimeConfig();
    hub ??= new PlayerHubClient(
      playerHubUrl(config.public.apiGatewayUrl),
      () => undefined,
    );
    const session = await hub.createSoloLobby({
      commandId: createIdempotencyKey(),
      playerId: playerId.value,
      heroId: selectedHero.value.id,
    });
    await router.push(
      `/players/${encodeURIComponent(playerId.value)}/play/lobbies/${session.sessionId}`,
    );
  } catch (cause) {
    error.value =
      cause instanceof PlayerHubError ? cause.message : "Unable to create the lobby.";
  } finally {
    creating.value = false;
  }
}

async function selectHero(hero: HeroSummary): Promise<void> {
  if (hero.isEngagedInActiveSession) return;
  selectingHero.value = true;
  error.value = "";
  try {
    await usePlayerApi().selectHero(playerId.value, hero.id);
    selectedId.value = hero.id;
    heroPickerOpen.value = false;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Unable to select this hero.";
  } finally {
    selectingHero.value = false;
  }
}

onMounted(load);
onBeforeUnmount(() => void hub?.disconnect());
</script>

<template>
  <div>
    <NuxtPage v-if="!isJoinScreen" />
    <main v-else id="main" class="join-game">
    <header>
      <p class="join-game__eyebrow">Play a game</p>
      <h1>Join a game</h1>
    </header>
    <p v-if="error" class="join-game__notice" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="join-game__notice">Loading your heroes…</p>
    <div v-else class="join-game__layout">
      <aside class="join-game__hero">
        <p class="join-game__eyebrow">Selected hero</p>
        <template v-if="selectedHero">
          <HeroPortraitPlaceholder
            :class-code="selectedHero.classCode"
            :label="`${selectedHero.name} portrait`"
          />
          <h2>{{ selectedHero.name }}</h2>
          <p>{{ selectedHero.classCode }} · level {{ selectedHero.level }}</p>
          <UiButton :size="ButtonSize.SM" :variant="ButtonVariant.GHOST" @click="heroPickerOpen = true">Change hero</UiButton>
        </template>
        <template v-else
          ><h2>No hero selected</h2>
          <p>Select a hero before creating a lobby.</p>
          <UiButton :size="ButtonSize.SM" :variant="ButtonVariant.GHOST" @click="heroPickerOpen = true">Choose a hero</UiButton></template
        >
      </aside>
      <section class="join-game__content" aria-label="Lobby actions">
        <article class="join-game__card">
          <p class="join-game__eyebrow">Solo</p>
          <h2>Create a lobby</h2>
          <p>Prepare your hero, then start the run when you are ready.</p>
          <UiButton
            :size="ButtonSize.SM"
            :variant="ButtonVariant.PRIMARY"
            :busy="creating"
            :disabled="!selectedHero || selectedHero.isEngagedInActiveSession"
            @click="createLobby"
            >{{ creating ? "Creating…" : "Create lobby" }}</UiButton
          >
        </article>
        <article class="join-game__card join-game__card--empty">
          <p class="join-game__eyebrow">Open lobbies</p>
          <h2>No games to join yet</h2>
          <p>Joining another player’s lobby arrives with the multiplayer release.</p>
        </article>
      </section>
    </div>
    </main>
    <HeroSelectionModal
      v-model="heroPickerOpen"
      :heroes="heroes"
      :selected-hero-id="selectedId"
      :busy="selectingHero"
      @select="selectHero"
    />
  </div>
</template>

<style scoped lang="scss">
.join-game {
  width: min(100% - (var(--layout-gutter) * 2), 72rem);
  margin: auto;
  padding-block: var(--space-6);
  color: var(--color-text-primary);
}
h1,
h2 {
  margin: 0;
  font-family: var(--font-family-display);
  text-transform: uppercase;
}
h1 {
  font-size: var(--font-size-xl);
}
.join-game__eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--color-text-highlight);
  font-size: 0.625rem;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.join-game__layout {
  display: grid;
  grid-template-columns: 14rem 1fr;
  gap: var(--space-5);
  margin-top: var(--space-5);
}
.join-game__hero,
.join-game__card {
  display: grid;
  align-content: start;
  gap: var(--space-3);
  border: 1px solid var(--color-border-subtle);
  padding: var(--space-4);
  background: var(--color-surface-raised);
}
.join-game__hero p,
.join-game__card p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
.join-game__hero h2 {
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.join-game__hero a {
  color: var(--color-text-highlight);
  font-size: var(--font-size-xs);
}
.join-game__content {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.join-game__card {
  min-height: 13rem;
}
.join-game__card--empty {
  border-style: dashed;
}
.join-game__notice {
  margin-top: var(--space-4);
  color: var(--color-text-muted);
}
@media (max-width: 44rem) {
  .join-game__layout,
  .join-game__content {
    grid-template-columns: 1fr;
  }
}
</style>
