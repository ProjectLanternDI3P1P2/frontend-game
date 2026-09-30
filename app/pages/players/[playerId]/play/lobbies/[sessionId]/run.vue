<script setup lang="ts">
import {
  PlayerHubClient,
  PlayerHubError,
  playerHubUrl,
} from "~/features/player/api/playerHub";
import type { GameSessionSnapshot } from "~/features/player/types";
definePageMeta({ layout: "player" });
const route = useRoute();
const config = useRuntimeConfig();
const playerId = computed(() => String(route.params.playerId));
const sessionId = computed(() => String(route.params.sessionId));
const session = ref<GameSessionSnapshot | null>(null);
const error = ref("");
let hub: PlayerHubClient | null = null;
onMounted(async () => {
  try {
    hub = new PlayerHubClient(playerHubUrl(config.public.apiGatewayUrl), (snapshot) => {
      session.value = snapshot;
    });
    session.value = await hub.getSessionSnapshot(playerId.value, sessionId.value);
  } catch (cause) {
    error.value =
      cause instanceof PlayerHubError ? cause.message : "Unable to load the run.";
  }
});
onBeforeUnmount(() => void hub?.disconnect());
</script>

<template>
  <main id="main" class="run-placeholder">
    <p class="run-placeholder__eyebrow">Dungeon run</p>
    <h1>Run started</h1>
    <p v-if="error" role="alert">{{ error }}</p>
    <template v-else-if="session"
      ><p>Your dungeon is ready. The gameplay screen is coming next.</p>
      <dl>
        <dt>Session</dt>
        <dd>{{ session.sessionId }}</dd>
        <dt>Dungeon run</dt>
        <dd>{{ session.dungeonRunId }}</dd>
      </dl>
      <NuxtLink
        :to="`/players/${encodeURIComponent(playerId)}/play/lobbies/${encodeURIComponent(sessionId)}`"
        >Back to lobby</NuxtLink
      ></template
    >
    <p v-else>Loading run…</p>
  </main>
</template>

<style scoped lang="scss">
.run-placeholder {
  width: min(100% - (var(--layout-gutter) * 2), 48rem);
  margin: auto;
  padding-block: var(--space-8);
  color: var(--color-text-primary);
}
.run-placeholder__eyebrow {
  color: var(--color-text-highlight);
  font-size: 0.625rem;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 {
  font-family: var(--font-family-display);
  text-transform: uppercase;
}
p,
dt,
dd {
  color: var(--color-text-muted);
}
dl {
  display: grid;
  grid-template-columns: 8rem 1fr;
  gap: var(--space-2);
  border: 1px solid var(--color-border-subtle);
  padding: var(--space-4);
  background: var(--color-surface-raised);
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
}
a {
  color: var(--color-text-highlight);
}
</style>
