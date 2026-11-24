<script setup lang="ts">
import AppShell from "~/components/AppShell.vue";
import { useAuth } from "~/features/auth/composables/useAuth";

/**
 * ADR-FE-015 — Landmarks and the skip link live in the layout so every public
 * page inherits them. The public site targets RGAA compliance with no expected
 * exception: nothing here is a gameplay constraint.
 */
const route = useRoute();
const { isAuthenticated } = useAuth();
const keycloakReady = useState("lantern.keycloak.ready", () => false);
const shouldHoldRootContent = computed(
  () => route.path === "/" && (!keycloakReady.value || !isAuthenticated.value),
);
</script>

<template>
  <AppShell :hold-content="shouldHoldRootContent">
    <slot />
  </AppShell>
</template>
