<script setup lang="ts">
/**
 * ADR-FE-003 — Entry point of the hybrid-rendered public site.
 */
const config = useRuntimeConfig();

useHead({
  titleTemplate: (title) => (title ? `${title} · Project Lantern` : "Project Lantern"),
  link: [{ rel: "canonical", href: config.public.siteUrl }],
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <UiToastContainer />
</template>
