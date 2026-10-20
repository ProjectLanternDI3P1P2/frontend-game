<script setup lang="ts">
import PlayerHomeView from "~/features/player/components/PlayerHomeView.vue";

definePageMeta({ alias: "/" });
useHead({ title: "Home" });
</script>

<template>
  <PlayerHomeView />
</template>
