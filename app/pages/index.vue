<script setup lang="ts">
/**
 * Placeholder route, statically generated (ADR-FE-003 default).
 *
 * `app/pages/` is intentionally almost empty: pages belong to the squads that
 * own the corresponding feature. This file exists so the router has an entry
 * point and so the prerendering path is exercised by the build.
 *
 * Every route added here must also declare its rendering mode in
 * `nuxt.config.ts` → `routeRules` and justify it in `docs/rendering-modes.md`.
 */
import { useAuth } from "~/features/auth/composables/useAuth";

useHead({ title: "Public site" });

const { isAuthenticated, user, login, logout } = useAuth();
</script>

<template>
  <div class="home">
    <h1>Project Lantern — public site</h1>

    <template v-if="!isAuthenticated">
      <p>You are not logged</p>

      <button type="button" @click="login">
        Login
      </button>
    </template>
  
    <template v-else>
      <p>
        You are logged in as
        <strong>{{ user?.username }}</strong>
      </p>

      <p v-if="user?.email">
        {{ user.email }}
      </p>

      <button type="button" @click="logout">
        Sign out
      </button>
    </template>

    <p>
      Architecture skeleton. Routes are added by the squad that owns the
      corresponding feature, with their rendering mode declared and justified.
    </p>
  </div>
</template>

<style scoped lang="scss">
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  p {
    max-inline-size: 60ch;
    color: var(--color-text-muted);
  }
}
</style>
