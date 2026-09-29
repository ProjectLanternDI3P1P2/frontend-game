<script setup lang="ts">
/**
 * ADR-FE-003 — Entry point of the hybrid-rendered public site.
 */
useHead({
  titleTemplate: (title) => (title ? `${title} · Project Lantern` : "Project Lantern"),
  link: [{ rel: "canonical", href: "https://projectlantern.example" }],
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
