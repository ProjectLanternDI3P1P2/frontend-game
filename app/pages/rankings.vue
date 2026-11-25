<script setup lang="ts">
/**
 * Public rankings (F04, decision D11): server-rendered with `swr: 60`
 * (docs/rendering-modes.md), so the podium and the top 10 are in the HTML.
 * No current player here: the page is the same for everyone.
 */
import { computed } from "vue";
import PublicRankingView from "~/features/leaderboard/components/PublicRankingView.vue";
import { usePublicRanking } from "~/features/leaderboard/composables/usePublicRanking";

definePageMeta({ layout: "default" });

const { state, refreshing, retry } = usePublicRanking();

const season = computed(() => state.value.ranking?.season?.label?.trim() || "");
const title = computed(() =>
  season.value ? `Rankings · ${season.value}` : "Rankings",
);
const description = computed(
  () =>
    `${season.value || "Current season"} hero rankings of Project Lantern: the podium, ` +
    "the leaders of each class and the top 10 heroes by total XP.",
);

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogType: "website",
});
</script>

<template>
  <PublicRankingView :state="state" :refreshing="refreshing" @retry="retry" />
</template>
