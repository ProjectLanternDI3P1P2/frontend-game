<script setup lang="ts">
import { GatewayError } from "~/shared/utils/gateway";
import { useToast } from "~/shared/composables/useToast";
import HeroCreatedConfirmation from "~/features/player/components/HeroCreatedConfirmation.vue";
import { usePlayerApi } from "~/features/player/api/playerApi";
import type { HeroSheet } from "~/features/player/types";

definePageMeta({ layout: "player" });

const route = useRoute();
const router = useRouter();
const playerId = computed(() => String(route.params.playerId));
const heroId = computed(() => String(route.params.heroId));
const hero = ref<HeroSheet | null>(null);
const heroCount = ref(0);
const loading = ref(true);
const selecting = ref(false);
const error = ref("");
const selectionError = ref("");
const { success } = useToast();
const heroesPath = computed(
  () => `/players/${encodeURIComponent(playerId.value)}/heroes`,
);
const createHeroPath = computed(() => `${heroesPath.value}/new`);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [loadedHero, heroes] = await Promise.all([
      usePlayerApi().getHeroSheet(playerId.value, heroId.value),
      usePlayerApi().listHeroes(playerId.value),
    ]);
    hero.value = loadedHero;
    heroCount.value = heroes.length;
    success(
      `${loadedHero.name} · ${
        loadedHero.classCode.charAt(0).toUpperCase() + loadedHero.classCode.slice(1)
      } — hero_${loadedHero.id.slice(0, 8)}`,
      { title: "Hero created" },
    );
  } catch (cause) {
    error.value =
      cause instanceof GatewayError
        ? cause.message
        : "Unable to load the new hero confirmation.";
  } finally {
    loading.value = false;
  }
}

async function selectHero() {
  selecting.value = true;
  selectionError.value = "";
  try {
    await usePlayerApi().selectHero(playerId.value, heroId.value);
    await router.push(heroesPath.value);
  } catch (cause) {
    selectionError.value =
      cause instanceof GatewayError ? cause.message : "Unable to select this hero.";
  } finally {
    selecting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main v-if="loading" id="main" class="hero-created-loading" aria-live="polite">
    Preparing your new hero…
  </main>
  <main v-else-if="error" id="main" class="hero-created-loading" role="alert">
    <p>{{ error }}</p>
    <UiButton @click="load">Retry</UiButton>
  </main>
  <HeroCreatedConfirmation
    v-else-if="hero"
    :hero="hero"
    :hero-count="heroCount"
    :selecting="selecting"
    :selection-error="selectionError"
    :heroes-path="heroesPath"
    :create-hero-path="createHeroPath"
    @select="selectHero"
  />
</template>

<style scoped lang="scss">
.hero-created-loading {
  display: grid;
  min-height: calc(100vh - 4rem);
  padding: var(--space-7) var(--layout-gutter);
  place-items: center;
  color: var(--color-text-muted);
}
</style>
