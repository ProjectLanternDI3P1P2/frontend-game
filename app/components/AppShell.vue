<script setup lang="ts">
import { useAuth } from "~/features/auth/composables/useAuth";
import { keycloakRedirectUrl } from "~/features/auth/keycloakRedirectUrl";
import { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";

const props = withDefaults(
  defineProps<{
    fullBleed?: boolean;
    holdContent?: boolean;
  }>(),
  {
    fullBleed: false,
    holdContent: false,
  },
);

const config = useRuntimeConfig();
const { isAuthenticated, user, login, logout } = useAuth();
const route = useRoute();

const loginFromNavigation = async () => {
  await login(keycloakRedirectUrl(window.location, config.app.baseURL, route.fullPath));
};

const authenticatedNavigationItems = [
  { label: "Home", to: "/home" },
  { label: "Heroes", to: "/players/me/heroes" },
  { label: "Lobby", to: "/players/play" },
  { label: "Dungeon", to: "/dungeon" },
];
const publicNavigationItems = [{ label: "Demo", to: "/demo" }];
const navigationItems = computed(() =>
  isAuthenticated.value
    ? [...authenticatedNavigationItems, ...publicNavigationItems]
    : publicNavigationItems,
);
const brandTo = computed(() => (isAuthenticated.value ? "/home" : "/auth"));
</script>

<template>
  <div class="site-shell">
    <a class="skip-link" href="#main">Skip to main content</a>

    <UiTopNavigation
      brand="Project Lantern"
      :brand-to="brandTo"
      :items="navigationItems"
    >
      <template #actions>
        <span v-if="isAuthenticated" class="site-shell__identity">
          {{ user?.username }}
        </span>
        <UiButton
          :variant="isAuthenticated ? ButtonVariant.GHOST : ButtonVariant.PRIMARY"
          :size="ButtonSize.SM"
          @click="isAuthenticated ? logout() : loginFromNavigation()"
        >
          {{ isAuthenticated ? "Sign out" : "Sign in" }}
        </UiButton>
      </template>
    </UiTopNavigation>

    <main
      id="main"
      class="site-shell__main"
      :class="{
        'site-shell__main--full-bleed': props.fullBleed,
        'layout-container': !props.fullBleed,
      }"
    >
      <div v-show="!props.holdContent" class="site-shell__page">
        <slot />
      </div>
      <p
        v-show="props.holdContent"
        data-testid="auth-loading"
        class="site-shell__auth-loading"
        aria-live="polite"
      >
        Checking session…
      </p>
    </main>

    <footer class="site-shell__footer">
      <div class="layout-container">
        <p>Redwood Games — Project Lantern</p>
        <p class="site-shell__build">
          Build {{ config.public.appVersion }} ({{ config.public.commitSha }})
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.site-shell {
  display: flex;
  flex-direction: column;
  min-block-size: 100vh;

  &__main {
    display: flex;
    flex: 1;
    min-block-size: 0;
    padding-block: var(--space-7);

    &--full-bleed {
      padding-block: 0;
    }
  }

  &__footer {
    border-block-start: 1px solid var(--color-border-subtle);
    padding-block: var(--space-5);
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  &__build {
    font-family: var(--font-family-mono);
  }

  &__identity {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  &__auth-loading {
    margin: var(--space-8) auto;
    color: var(--color-text-muted);
    text-align: center;
  }

  &__page {
    display: contents;
  }
}
</style>
