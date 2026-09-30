<script setup lang="ts">
import { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import {
  PlayerHubClient,
  PlayerHubError,
  playerHubUrl,
} from "~/features/player/api/playerHub";
import HeroPortraitPlaceholder from "~/features/player/components/HeroPortraitPlaceholder.vue";
import HeroSelectionModal from "~/features/player/components/HeroSelectionModal.vue";
import { usePlayerApi } from "~/features/player/api/playerApi";
import type { GameSessionSnapshot, HeroSummary } from "~/features/player/types";
import { createIdempotencyKey } from "~/shared/utils/idempotency";

definePageMeta({ layout: "player" });
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const playerId = computed(() => String(route.params.playerId));
const sessionId = computed(() => String(route.params.sessionId));
const session = ref<GameSessionSnapshot | null>(null);
const loading = ref(true);
const starting = ref(false);
const selectingHero = ref(false);
const heroPickerOpen = ref(false);
const error = ref("");
const heroes = ref<HeroSummary[]>([]);
const isCreator = computed(() => session.value?.creatorPlayerId === playerId.value);
const lobbyCode = computed(() => sessionId.value.slice(0, 8).toUpperCase());
let hub: PlayerHubClient | null = null;

async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    hub ??= new PlayerHubClient(
      playerHubUrl(config.public.apiGatewayUrl),
      (snapshot) => {
        session.value = snapshot;
      },
    );
    const [snapshot, playerHeroes] = await Promise.all([
      hub.getSessionSnapshot(playerId.value, sessionId.value),
      usePlayerApi().listHeroes(playerId.value),
    ]);
    session.value = snapshot;
    heroes.value = playerHeroes;
  } catch (cause) {
    error.value =
      cause instanceof PlayerHubError ? cause.message : "Unable to load the lobby.";
  } finally {
    loading.value = false;
  }
}
async function changeHero(hero: HeroSummary): Promise<void> {
  if (!session.value || !isCreator.value || session.value.state !== "Lobby") return;
  selectingHero.value = true;
  error.value = "";
  try {
    const changed = await hub!.changeSessionHero({
      commandId: createIdempotencyKey(),
      playerId: playerId.value,
      sessionId: session.value.sessionId,
      heroId: hero.id,
    });
    await usePlayerApi().selectHero(playerId.value, hero.id);
    session.value = changed;
    heroes.value = heroes.value.map((candidate) => ({
      ...candidate,
      isSelected: candidate.id === hero.id,
    }));
    heroPickerOpen.value = false;
  } catch (cause) {
    error.value = cause instanceof PlayerHubError ? cause.message : "Unable to change the lobby hero.";
    await load();
  } finally {
    selectingHero.value = false;
  }
}
async function start(): Promise<void> {
  if (!session.value || !isCreator.value || session.value.state !== "Lobby") return;
  starting.value = true;
  error.value = "";
  try {
    const started = await hub!.startSession({
      commandId: createIdempotencyKey(),
      playerId: playerId.value,
      sessionId: session.value.sessionId,
    });
    session.value = started;
    await router.push(
      `/players/${encodeURIComponent(playerId.value)}/play/lobbies/${started.sessionId}/run`,
    );
  } catch (cause) {
    error.value =
      cause instanceof PlayerHubError ? cause.message : "Unable to start the run.";
    await load();
  } finally {
    starting.value = false;
  }
}
onMounted(load);
onBeforeUnmount(() => void hub?.disconnect());
</script>

<template>
  <div>
    <main id="main" class="lobby-page">
    <NuxtLink
      :to="`/players/${encodeURIComponent(playerId)}/play`"
      class="lobby-page__back"
      >← Join a game</NuxtLink
    >
    <p v-if="loading" class="lobby-page__notice">Loading lobby…</p>
    <p v-else-if="error" class="lobby-page__notice" role="alert">{{ error }}</p>
    <template v-else-if="session">
      <header class="lobby-page__header">
        <div>
          <p class="lobby-page__eyebrow">Lobby · you are the creator</p>
          <h1>{{ session.members[0]?.name }}’s game</h1>
        </div>
        <div class="lobby-page__connection">
          <span
            >Lobby code <strong>{{ lobbyCode }}</strong></span
          >
          <span class="lobby-page__connected">● Real-time · connected</span>
        </div>
      </header>
      <section class="lobby-page__layout">
        <div class="lobby-page__roster">
          <p class="lobby-page__eyebrow">Team</p>
          <h2>{{ session.members.length }} / 1 player</h2>
          <article
            v-for="member in session.members"
            :key="member.id"
            class="lobby-page__member"
          >
            <HeroPortraitPlaceholder
              :class-code="member.classCode"
              :label="`${member.name} portrait`"
            />
            <div>
              <strong>{{ member.name }}</strong>
              <p>{{ member.classCode }} · level {{ member.level }}</p>
              <span v-if="member.id === session.members[0]?.id">Lobby creator</span>
            </div>
          </article>
          <article v-for="slot in 3" :key="slot" class="lobby-page__slot">
            <span aria-hidden="true">○</span>
            <div>
              <strong>Open slot</strong>
              <p>Waiting for a player…</p>
            </div>
          </article>
        </div>
        <div class="lobby-page__side">
          <aside class="lobby-page__hero">
            <p class="lobby-page__eyebrow">Your hero</p>
            <HeroPortraitPlaceholder
              :class-code="session.members[0]?.classCode ?? 'mage'"
              :label="`${session.members[0]?.name} portrait`"
            />
            <h2>{{ session.members[0]?.name }}</h2>
            <p>
              {{ session.members[0]?.classCode }} · level
              {{ session.members[0]?.level }}
            </p>
            <UiButton
              :size="ButtonSize.SM"
              :variant="ButtonVariant.GHOST"
              :disabled="!isCreator || session.state !== 'Lobby'"
              @click="heroPickerOpen = true"
              >Change hero</UiButton
            >
          </aside>
          <aside class="lobby-page__actions">
            <p class="lobby-page__eyebrow">Start</p>
            <h2>
              {{ session.state === "Lobby" ? "Ready for a solo run" : "Run launched" }}
            </h2>
            <p v-if="session.state === 'Lobby'">
              ✓ Your hero is ready<br />✓ Solo roster is complete
            </p>
            <p v-else>The dungeon run is being prepared.</p>
            <UiButton
              :size="ButtonSize.SM"
              :variant="ButtonVariant.PRIMARY"
              :busy="starting"
              :disabled="!isCreator || session.state !== 'Lobby'"
              @click="start"
              >{{ starting ? "Starting…" : "Start game" }}</UiButton
            >
            <p v-if="!isCreator" class="lobby-page__hint">
              Only the creator can launch this run.
            </p>
          </aside>
        </div>
      </section>
    </template>
    </main>
    <HeroSelectionModal
      v-model="heroPickerOpen"
      :heroes="heroes"
      :selected-hero-id="session?.members[0]?.id ?? null"
      :busy="selectingHero"
      @select="changeHero"
    />
  </div>
</template>

<style scoped lang="scss">
.lobby-page {
  width: min(100% - (var(--layout-gutter) * 2), 72rem);
  margin: auto;
  padding-block: var(--space-6);
  color: var(--color-text-primary);
}
.lobby-page__back {
  color: var(--color-text-highlight);
  font-size: var(--font-size-xs);
  text-decoration: none;
}
.lobby-page header {
  margin-top: var(--space-5);
}
.lobby-page__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-4);
}
.lobby-page__connection {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text-muted);
  font-size: 0.625rem;
  text-transform: uppercase;
}
.lobby-page__connection > span:first-child {
  border: 1px solid var(--color-border-subtle);
  padding: var(--space-2);
}
.lobby-page__connection strong {
  color: var(--color-text-highlight);
}
.lobby-page__connected {
  border: 1px solid var(--color-success);
  padding: var(--space-2);
  color: var(--color-success);
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
.lobby-page__member strong,
.lobby-page__hero h2 {
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.lobby-page header > p:not(.lobby-page__eyebrow),
.lobby-page__actions p,
.lobby-page__member p {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
.lobby-page__eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--color-text-highlight);
  font-size: 0.625rem;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.lobby-page__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 18rem;
  gap: var(--space-5);
  margin-top: var(--space-5);
}
.lobby-page__roster,
.lobby-page__actions,
.lobby-page__hero {
  border: 1px solid var(--color-border-subtle);
  padding: var(--space-4);
  background: var(--color-surface-raised);
}
.lobby-page__member {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-4);
  border: 1px solid var(--color-border-subtle);
  padding: var(--space-3);
}
.lobby-page__slot {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-2);
  border: 1px dashed var(--color-border-strong);
  padding: var(--space-3);
  color: var(--color-text-muted);
}
.lobby-page__slot > span {
  font-size: 1.75rem;
}
.lobby-page__slot p {
  margin: var(--space-1) 0 0;
  font-size: var(--font-size-xs);
}
.lobby-page__side {
  display: grid;
  align-content: start;
  gap: var(--space-3);
}
.lobby-page__hero {
  display: grid;
  gap: var(--space-2);
}
.lobby-page__hero :deep(.hero-portrait) {
  width: 4rem;
  height: 4rem;
}
.lobby-page__hero p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
.lobby-page__member p {
  margin: var(--space-1) 0;
}
.lobby-page__member span,
.lobby-page__hint {
  color: var(--color-text-highlight) !important;
  font-size: 0.625rem !important;
}
.lobby-page__actions {
  display: grid;
  align-content: start;
  gap: var(--space-3);
}
.lobby-page__actions p {
  margin: 0;
}
.lobby-page__notice {
  color: var(--color-text-muted);
}
@media (max-width: 44rem) {
  .lobby-page__layout {
    grid-template-columns: 1fr;
  }
  .lobby-page__header {
    align-items: start;
    flex-direction: column;
  }
}
</style>
