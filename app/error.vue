<script setup lang="ts">
/**
 * Global error page: Nuxt renders it instead of app.vue, without a layout,
 * for every fatal error of the application.
 *
 * - 404 whose status text is PLAYER_NOT_FOUND_MESSAGE (raised by
 *   /profiles/:ref, US-PLAYER-06) → « Player not found »;
 * - any other 404 (unknown route: "Page not found: /…") → « Page not found »;
 * - anything else → a generic message.
 *
 * Never indexed. The way back is the public rankings: `/` and `/home` send an
 * anonymous visitor to the sign-in page.
 */
import { computed } from "vue";
import { PLAYER_NOT_FOUND_MESSAGE } from "~/features/player/publicProfileRules";
import UiButton, { ButtonVariant } from "~/shared/ui/UiButton.vue";

/** The fields Nuxt hands over, under their Nuxt 4 and legacy names. */
interface AppError {
  status?: number;
  statusCode?: number;
  statusText?: string;
  statusMessage?: string;
}

const props = defineProps<{ error: AppError }>();

const RETURN_PATH = "/rankings";

const COPY = {
  playerNotFound: {
    title: PLAYER_NOT_FOUND_MESSAGE,
    message: "This player does not exist, or their profile is no longer public.",
  },
  pageNotFound: {
    title: "Page not found",
    message: "The page you are looking for does not exist or has moved.",
  },
  generic: {
    title: "Something went wrong",
    message: "An unexpected error occurred. Please try again in a moment.",
  },
} as const;

const status = computed(() =>
  Number(props.error.status ?? props.error.statusCode ?? 500),
);
const statusText = computed(
  () => props.error.statusText ?? props.error.statusMessage ?? "",
);
const copy = computed(() => {
  if (status.value === 404 && statusText.value === PLAYER_NOT_FOUND_MESSAGE) {
    return COPY.playerNotFound;
  }
  if (status.value === 404) return COPY.pageNotFound;
  return COPY.generic;
});
// app.vue (and its title template) is not rendered with the error page.
const pageTitle = computed(() => `${copy.value.title} · Project Lantern`);

useSeoMeta({ title: pageTitle, robots: "noindex" });

function goToRankings(): void {
  void clearError({ redirect: RETURN_PATH });
}
</script>

<template>
  <main id="main" class="error-page layout-container">
    <p class="error-page__code">Error {{ status }}</p>
    <h1 class="error-page__title">{{ copy.title }}</h1>
    <p class="error-page__message">{{ copy.message }}</p>
    <UiButton :variant="ButtonVariant.PRIMARY" @click="goToRankings"
      >See the rankings</UiButton
    >
  </main>
</template>

<style scoped lang="scss">
.error-page {
  display: grid;
  align-content: center;
  justify-items: start;
  gap: var(--space-4);
  min-block-size: 100vh;
  padding-block: var(--space-7);

  &__code {
    margin: 0;
    color: var(--color-text-highlight);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-2xl);
  }

  &__message {
    margin: 0;
    max-inline-size: 60ch;
    color: var(--color-text-muted);
  }
}
</style>
