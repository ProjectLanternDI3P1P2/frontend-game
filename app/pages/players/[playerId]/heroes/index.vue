<script setup lang="ts">
import { ButtonVariant } from "~/shared/ui/UiButton.vue";
import { NoticeTone } from "~/shared/ui/UiNotice.vue";
import { GatewayError } from "~/shared/utils/gateway";
import { usePlayerApi } from "~/features/player/api/playerApi";
import type { HeroSummary } from "~/features/player/types";

const route = useRoute();
const playerId = computed(() => String(route.params.playerId));
const heroes = ref<HeroSummary[]>([]);
const selectedId = ref<string | null>(null);
const loading = ref(true);
const error = ref("");

async function load() {
  loading.value = true; error.value = "";
  try { heroes.value = await usePlayerApi().listHeroes(playerId.value); }
  catch (cause) { error.value = cause instanceof GatewayError ? cause.message : "Unable to load heroes."; }
  finally { loading.value = false; }
}
onMounted(load);
</script>

<template>
  <main class="heroes-page">
    <header><div><p class="eyebrow">Heroes</p><h1>My heroes</h1></div><NuxtLink :to="`/players/${encodeURIComponent(playerId)}/heroes/new`"><UiButton :variant="ButtonVariant.PRIMARY">Create a hero</UiButton></NuxtLink></header>
    <UiNotice v-if="error" :tone="NoticeTone.DANGER">{{ error }} <UiButton :variant="ButtonVariant.GHOST" @click="load">Retry</UiButton></UiNotice>
    <UiNotice v-else-if="loading" :tone="NoticeTone.INFO">Loading heroes…</UiNotice>
    <UiNotice v-else-if="!heroes.length" :tone="NoticeTone.INFO">No hero yet. Create your first hero to enter a dungeon.</UiNotice>
    <section v-else class="heroes-page__list" aria-label="My heroes">
      <UiHeroCard v-for="hero in heroes" :key="hero.id" :hero="hero" :selected="selectedId === hero.id" interactive @select="selectedId = hero.id">
        <template #actions><NuxtLink :to="`/players/${encodeURIComponent(playerId)}/heroes/${hero.id}`"><UiButton :variant="ButtonVariant.SECONDARY">View sheet</UiButton></NuxtLink><NuxtLink v-if="!hero.isEngagedInActiveSession" :to="`/players/${encodeURIComponent(playerId)}/play?heroId=${hero.id}`"><UiButton :variant="ButtonVariant.PRIMARY">Start run</UiButton></NuxtLink></template>
      </UiHeroCard>
    </section>
  </main>
</template>

<style scoped lang="scss">
.heroes-page { max-width: var(--layout-max-width); margin: 0 auto; padding: var(--space-7) var(--layout-gutter); display: grid; gap: var(--space-5); }.heroes-page > header { display: flex; justify-content: space-between; align-items: end; gap: var(--space-4); }.eyebrow { margin: 0 0 var(--space-2); color: var(--color-text-highlight); font-size: var(--font-size-sm); text-transform: uppercase; letter-spacing: .08em; } h1 { margin: 0; color: var(--color-text-primary); font-family: var(--font-family-display); }.heroes-page__list { display: grid; gap: var(--space-3); } a { text-decoration: none; } @media (max-width: 36rem) { .heroes-page > header { align-items: start; flex-direction: column; } }
</style>
