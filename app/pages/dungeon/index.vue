<script setup lang="ts">
/**
 * Starts an exploration: a new dungeon, or the replay of a shared seed.
 * Client-rendered (ADR-FE-004): declared in nuxt.config.ts → routeRules and
 * justified in docs/rendering-modes.md.
 */
import { useDungeonLauncher } from "~/features/dungeon/composables/useDungeonLauncher";
import { formatSeed, missingSeedCharacters, seedError } from "~/features/dungeon/seed";
import { ButtonType, ButtonVariant } from "~/shared/ui/ui.types";
import { NoticeTone } from "~/shared/ui/UiNotice.vue";

useHead({ title: "Dungeon" });

const route = useRoute();
const seed = ref(
  formatSeed(typeof route.query.seed === "string" ? route.query.seed : ""),
);
const { isStarting, errorMessage, start } = useDungeonLauncher();

const seedInvalid = computed(() => seedError(seed.value));
const missing = computed(() => missingSeedCharacters(seed.value));
const canReplay = computed(() => !seedInvalid.value && missing.value === 0);
const seedHint = computed(
  () =>
    seedInvalid.value ??
    (missing.value === 0
      ? "Ready to replay."
      : `${missing.value} more character${missing.value === 1 ? "" : "s"}, for example 0KX4-M2T9-QZ7PA.`),
);

/** Formats as the player types; set on the element too, since a rejected key leaves the ref unchanged. */
function typeSeed(event: Event) {
  const input = event.target as HTMLInputElement;
  input.value = seed.value = formatSeed(input.value);
}

/**
 * Starts a run and opens it. The heroes will come from the Player service: each player's
 * character as they made it (look, colours, hair, class, items…), to be drawn in the
 * dungeon. Until then, the hero of a run is drawn at random from its id
 * (`heroAppearanceOf` in `tiles/hero.ts`).
 *
 * TODO(player): the hero is chosen in the Player service; draw it from what the run
 * receives (its appearance codes, read through `features/player/appearance.ts`) instead of
 * `heroAppearanceOf`.
 */
async function explore(replayedSeed?: string) {
  const runId = await start(replayedSeed);
  if (runId) await navigateTo(`/dungeon/${runId}`);
}
</script>

<template>
  <div class="dungeon-start">
    <h1>Dungeon</h1>
    <p class="dungeon-start__intro">
      Forty rooms, one boss at the end of the longest branch. Every exploration draws a
      new seed; share it to let someone else play the same dungeon.
    </p>

    <UiButton :busy="isStarting" @click="explore()">New exploration</UiButton>

    <form class="dungeon-start__replay" @submit.prevent="canReplay && explore(seed)">
      <label for="dungeon-seed">Replay a seed</label>
      <div class="dungeon-start__row">
        <input
          id="dungeon-seed"
          :value="seed"
          class="dungeon-start__input"
          :class="{ 'dungeon-start__input--invalid': seedInvalid }"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          placeholder="0KX4-M2T9-QZ7PA"
          :aria-invalid="Boolean(seedInvalid)"
          :aria-describedby="seed ? 'dungeon-seed-hint' : undefined"
          @input="typeSeed"
        />
        <UiButton
          :type="ButtonType.SUBMIT"
          :variant="ButtonVariant.GHOST"
          :disabled="!canReplay"
          :busy="isStarting"
        >
          Replay
        </UiButton>
      </div>
      <p
        v-if="seed"
        id="dungeon-seed-hint"
        class="dungeon-start__hint"
        :class="{ 'dungeon-start__hint--error': seedInvalid }"
      >
        {{ seedHint }}
      </p>
    </form>

    <UiNotice
      v-if="errorMessage"
      class="dungeon-start__error"
      :tone="NoticeTone.DANGER"
      title="The dungeon could not be opened"
      dismissible
      @dismiss="errorMessage = null"
    >
      {{ errorMessage }}
    </UiNotice>
  </div>
</template>

<style scoped lang="scss">
.dungeon-start {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-5);

  &__intro {
    max-inline-size: 60ch;
    color: var(--color-text-muted);
  }

  &__replay {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  &__row {
    display: flex;
    gap: var(--space-3);
  }

  &__input {
    min-block-size: 2.75rem;
    padding-inline: var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-raised);
    color: var(--color-text-primary);
    font-family: var(--font-family-mono);
    letter-spacing: 0.08em;
    inline-size: 21ch;

    &--invalid {
      border-color: var(--color-danger);
    }
  }

  &__hint {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);

    &--error {
      color: var(--color-danger);
    }
  }

  &__error {
    align-self: stretch;
    max-inline-size: 60ch;
  }
}
</style>
