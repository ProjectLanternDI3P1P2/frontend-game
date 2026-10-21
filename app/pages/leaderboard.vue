<script setup lang="ts">
/** Hero ranking (D8), client-rendered (decision D2, docs/rendering-modes.md). */
import LeaderboardView from "~/features/leaderboard/components/LeaderboardView.vue";
import { SEEDED_PLAYER_ID } from "~/features/player/seededPlayer";

definePageMeta({ layout: "default" });
useHead({ title: "Leaderboard" });
// Decision D5: until Keycloak lands, "me" is the seeded demo player.
</script>

<template>
  <LeaderboardView :current-player-id="SEEDED_PLAYER_ID" />
</template>
