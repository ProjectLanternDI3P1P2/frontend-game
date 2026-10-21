<script setup lang="ts">
/** CA1–CA5 — client-rendered (decision D2, docs/rendering-modes.md). */
import HeroStatisticsView from "~/features/leaderboard/components/HeroStatisticsView.vue";

definePageMeta({ layout: "default" });
useHead({ title: "Hero statistics" });

// The view is keyed so that moving to another hero re-reads its statistics (D3).
const route = useRoute();
const playerId = computed(() => String(route.params.playerId));
const heroId = computed(() => String(route.params.heroId));
</script>

<template>
  <HeroStatisticsView
    :key="`${playerId}/${heroId}`"
    :player-id="playerId"
    :hero-id="heroId"
  />
</template>
