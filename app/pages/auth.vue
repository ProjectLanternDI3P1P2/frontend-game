<script setup lang="ts">
import { useAuth } from "~/features/auth/composables/useAuth";
import { keycloakRedirectUrl } from "~/features/auth/keycloakRedirectUrl";
import { ButtonSize, ButtonVariant } from "~/shared/ui/ui.types";

definePageMeta({
  title: "Access the game",
  layout: "auth",
});

const route = useRoute();
const config = useRuntimeConfig();
const { login, register } = useAuth();

const redirectPath = () => {
  const redirect = route.query.redirect;

  return typeof redirect === "string" &&
    redirect.startsWith("/") &&
    !redirect.startsWith("//")
    ? redirect
    : "/home";
};

const redirectUri = () =>
  keycloakRedirectUrl(window.location, config.app.baseURL, redirectPath());
</script>

<template>
  <div class="auth-screen">
    <video
      class="auth-screen__dungeon-background"
      autoplay
      muted
      loop
      playsinline
      poster="/media/dungeon-party-loop-poster.webp"
      aria-hidden="true"
      tabindex="-1"
    >
      <source src="/media/dungeon-party-loop.webm" type="video/webm" />
    </video>

    <section class="auth-page" aria-labelledby="auth-title">
      <p class="auth-page__eyebrow">Project Lantern</p>
      <h1 id="auth-title">Sign in to access the game</h1>
      <p class="auth-page__intro">
        Return to your heroes, explorations, and games by signing in to your account.
      </p>

      <div class="auth-page__actions">
        <UiButton
          :size="ButtonSize.LG"
          :variant="ButtonVariant.PRIMARY"
          full-width
          @click="login(redirectUri())"
        >
          Sign in
        </UiButton>
        <UiButton
          :size="ButtonSize.LG"
          :variant="ButtonVariant.SECONDARY"
          full-width
          @click="register(redirectUri())"
        >
          Create an account
        </UiButton>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.auth-screen {
  position: relative;
  display: grid;
  flex: 1;
  min-block-size: 100%;
  place-items: center;
  overflow: hidden;

  &::before {
    position: absolute;
    z-index: 1;
    inset: 0;
    background:
      linear-gradient(90deg, rgb(11 11 16 / 52%), rgb(11 11 16 / 36%)),
      linear-gradient(180deg, rgb(11 11 16 / 18%), rgb(11 11 16 / 46%));
    content: "";
  }

  &__dungeon-background {
    position: absolute;
    z-index: 0;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    opacity: 0.9;
    pointer-events: none;
  }
}

.auth-page {
  position: relative;
  z-index: 2;
  max-inline-size: 42rem;
  margin: var(--space-8);
  padding: var(--space-8);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-gold);
  text-align: center;

  h1 {
    margin: 0;
    font-size: var(--font-size-2xl);
  }

  &__eyebrow {
    margin: 0 0 var(--space-3);
    color: var(--color-accent);
    font-family: var(--font-family-display);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__intro {
    max-inline-size: 34rem;
    margin: var(--space-4) auto 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-lg);
  }

  &__actions {
    display: grid;
    gap: var(--space-3);
    max-inline-size: 24rem;
    margin: var(--space-7) auto 0;
  }
}
</style>
