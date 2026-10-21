<script setup lang="ts">
import { useAuth } from "~/features/auth/composables/useAuth";
import { ButtonSize, ButtonVariant } from "~/shared/ui/ui.types";

definePageMeta({
  title: "Access the game",
});

const route = useRoute();
const { login, register } = useAuth();

const redirectPath = () => {
  const redirect = route.query.redirect;

  return typeof redirect === "string" &&
    redirect.startsWith("/") &&
    !redirect.startsWith("//")
    ? redirect
    : "/home";
};

const redirectUri = () => `${window.location.origin}${redirectPath()}`;
</script>

<template>
  <section class="auth-page" aria-labelledby="auth-title">
    <p class="auth-page__eyebrow">Project Lantern</p>
    <h1 id="auth-title">Connectez-vous pour accéder au jeu</h1>
    <p class="auth-page__intro">
      Retrouvez vos héros, vos explorations et vos parties en vous connectant à votre
      compte.
    </p>

    <div class="auth-page__actions">
      <UiButton
        :size="ButtonSize.LG"
        :variant="ButtonVariant.PRIMARY"
        full-width
        @click="login(redirectUri())"
      >
        Se connecter
      </UiButton>
      <UiButton
        :size="ButtonSize.LG"
        :variant="ButtonVariant.SECONDARY"
        full-width
        @click="register(redirectUri())"
      >
        Créer un compte
      </UiButton>
    </div>
  </section>
</template>

<style scoped lang="scss">
.auth-page {
  max-inline-size: 42rem;
  margin: var(--space-8) auto;
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
