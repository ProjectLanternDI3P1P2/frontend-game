<script setup lang="ts">
/** Hero ranking (D8), client-rendered (decision D2, docs/rendering-modes.md). */
import LeaderboardView from "~/features/leaderboard/components/LeaderboardView.vue";
import { computed, onMounted, ref } from "vue";
import { useRankingQuery } from "~/features/leaderboard/composables/useRankingQuery";
import { usePlayerApi } from "~/features/player/api/playerApi";

const CURRENT_PLAYER_ALIAS = "me";

definePageMeta({ layout: "default" });
useHead({ title: "Leaderboard" });
// Filters, search, sort and page live in the URL (D15): a shared link reopens
// the same ranking.
const rankingQuery = useRankingQuery();
const progressionHeroId = ref<string | null>(null);
onMounted(async () => {
  try {
    const heroes = await usePlayerApi().listHeroes();
    progressionHeroId.value =
      heroes.find((hero) => hero.isSelected)?.id ?? heroes[0]?.id ?? null;
  } catch {
    // Without a verified Player hero, do not navigate to a seeded ranking identity.
    progressionHeroId.value = null;
  }
});
// The ranking owner name comes from demo rows in Development; only Keycloak
// identifies the person currently signed in.
const signedInName = computed(() =>
  import.meta.client
    ? (useNuxtApp().$keycloak.tokenParsed?.preferred_username?.trim() ?? "")
    : "",
);
</script>

<template>
  <LeaderboardView
    v-model:query="rankingQuery"
    :current-player-id="CURRENT_PLAYER_ALIAS"
    :current-player-name="signedInName"
    :progression-hero-id="progressionHeroId"
  />
</template>
