<script setup lang="ts">
/**
 * ADR-FE-003 — Entry point of the hybrid-rendered public site.
 */
const config = useRuntimeConfig();

useHead({
  titleTemplate: (title) => (title ? `${title} · Project Lantern` : "Project Lantern"),
  // A portable static build has no environment-specific canonical URL. SSR
  // and development receive it at runtime through NUXT_PUBLIC_SITE_URL.
  link: config.public.siteUrl
    ? [{ rel: "canonical", href: config.public.siteUrl }]
    : [],
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <UiToastContainer />
</template>
