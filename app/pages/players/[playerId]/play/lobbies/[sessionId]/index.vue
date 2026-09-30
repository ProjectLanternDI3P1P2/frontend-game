<script setup lang="ts">
import { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import {
  PlayerHubClient,
  PlayerHubError,
  playerHubUrl,
} from "~/features/player/api/playerHub";
import HeroPortraitPlaceholder from "~/features/player/components/HeroPortraitPlaceholder.vue";
import type { GameSessionSnapshot } from "~/features/player/types";
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
const error = ref("");
const isCreator = computed(() => session.value?.creatorPlayerId === playerId.value);
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
    session.value = await hub.getSessionSnapshot(playerId.value, sessionId.value);
  } catch (cause) {
    error.value =
      cause instanceof PlayerHubError ? cause.message : "Unable to load the lobby.";
  } finally {
    loading.value = false;
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
  <main id="main" class="lobby-page">
    <NuxtLink
      :to="`/players/${encodeURIComponent(playerId)}/play`"
      class="lobby-page__back"
      >← Join a game</NuxtLink
    >
    <p v-if="loading" class="lobby-page__notice">Loading lobby…</p>
    <p v-else-if="error" class="lobby-page__notice" role="alert">{{ error }}</p>
    <template v-else-if="session">
      <header>
        <p class="lobby-page__eyebrow">{{ session.mode }} lobby</p>
        <h1>Your party is ready</h1>
        <p>The roster locks when the run starts.</p>
      </header>
      <section class="lobby-page__layout">
        <div class="lobby-page__roster">
          <h2>Party</h2>
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
        </div>
        <aside class="lobby-page__actions">
          <p class="lobby-page__eyebrow">
            {{ session.state === "Lobby" ? "Ready to start" : "Roster locked" }}
          </p>
          <h2>{{ session.state === "Lobby" ? "Launch the run" : "Run launched" }}</h2>
          <p v-if="session.state === 'Lobby'">
            Only the lobby creator can start the dungeon.
          </p>
          <p v-else>The dungeon run is being prepared.</p>
          <UiButton
            :size="ButtonSize.SM"
            :variant="ButtonVariant.PRIMARY"
            :busy="starting"
            :disabled="!isCreator || session.state !== 'Lobby'"
            @click="start"
            >{{ starting ? "Starting…" : "Start run" }}</UiButton
          >
          <p v-if="!isCreator" class="lobby-page__hint">
            Only the creator can launch this run.
          </p>
        </aside>
      </section>
    </template>
  </main>
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
h1,
h2 {
  margin: 0;
  font-family: var(--font-family-display);
  text-transform: uppercase;
}
h1 {
  font-size: var(--font-size-xl);
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
.lobby-page__actions {
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
}
</style>
