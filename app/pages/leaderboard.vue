<script setup lang="ts">
/** Hero ranking (D8), client-rendered (decision D2, docs/rendering-modes.md). */
import LeaderboardView from "~/features/leaderboard/components/LeaderboardView.vue";
import { useRankingQuery } from "~/features/leaderboard/composables/useRankingQuery";
import { SIMULATED_PLAYER_ID } from "~/features/leaderboard/simulatedIdentity";

definePageMeta({ layout: "default" });
useHead({ title: "Leaderboard" });
// Filters, search, sort and page live in the URL (D15): a shared link reopens
// the same ranking.
const rankingQuery = useRankingQuery();
</script>

<template>
  <LeaderboardView
    v-model:query="rankingQuery"
    :current-player-id="SIMULATED_PLAYER_ID"
  />
</template>
