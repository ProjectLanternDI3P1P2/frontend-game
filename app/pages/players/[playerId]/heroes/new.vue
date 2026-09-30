<script setup lang="ts">
import { ButtonType } from "~/shared/ui/UiButton.vue";
import { GatewayError } from "~/shared/utils/gateway";
import { createIdempotencyKey } from "~/shared/utils/idempotency";
import { usePlayerApi } from "~/features/player/api/playerApi";
import HeroClassSelectionCard from "~/features/player/components/HeroClassSelectionCard.vue";
import HeroCreationPreview from "~/features/player/components/HeroCreationPreview.vue";
import PlayerValidatedInput, {
  type TextValidationRule,
} from "~/features/player/components/PlayerValidatedInput.vue";
import { HERO_ROSTER_CAPACITY } from "~/features/player/types";
import type {
  HeroClassCode,
  HeroClassOption,
  HeroSummary,
} from "~/features/player/types";

definePageMeta({ layout: "player" });

const MAX_HEROES = HERO_ROSTER_CAPACITY;
const HERO_NAME_RULES: readonly TextValidationRule[] = [
  {
    message: "Enter a hero name.",
    isValid: (value) => value.trim().length > 0,
  },
  {
    message:
      "Hero name must contain 3 to 24 letters and may include spaces, hyphens, or apostrophes.",
    isValid: (value) => {
      const name = value.trim();
      return name.length >= 3 && name.length <= 24 && /^\p{L}[\p{L} '-]*$/u.test(name);
    },
  },
];

const route = useRoute();
const router = useRouter();
const playerId = computed(() => String(route.params.playerId));
const heroes = ref<HeroSummary[]>([]);
const heroClasses = ref<HeroClassOption[]>([]);
const name = ref("");
const classCode = ref<HeroClassCode | null>(null);
const nameValid = ref(false);
const nameServerError = ref("");
const error = ref("");
const loading = ref(true);
const submitting = ref(false);
const nameField = useTemplateRef<{ validate: () => boolean }>("nameField");
let idempotencyKey: string | null = null;

const selectedClass = computed(
  () =>
    heroClasses.value.find((heroClass) => heroClass.code === classCode.value) ?? null,
);
const isAtHeroLimit = computed(() => heroes.value.length >= HERO_ROSTER_CAPACITY);
const projectedHeroCount = computed(() =>
  Math.min(heroes.value.length + 1, HERO_ROSTER_CAPACITY),
);
const heroesPath = computed(
  () => `/players/${encodeURIComponent(playerId.value)}/heroes`,
);
const canSubmit = computed(
  () =>
    !loading.value &&
    !isAtHeroLimit.value &&
    nameValid.value &&
    selectedClass.value !== null,
);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [loadedHeroes, loadedClasses] = await Promise.all([
      usePlayerApi().listHeroes(playerId.value),
      usePlayerApi().listHeroClasses(),
    ]);
    heroes.value = loadedHeroes;
    heroClasses.value = loadedClasses;
    classCode.value = loadedClasses[0]?.code ?? null;
  } catch (cause) {
    error.value =
      cause instanceof GatewayError
        ? cause.message
        : "Unable to prepare hero creation.";
  } finally {
    loading.value = false;
  }
}

function updateName(value: string) {
  name.value = value;
  nameServerError.value = "";
}

function cancel() {
  router.back();
}

function validationMessage(cause: GatewayError): string | null {
  const errors = cause.details as { errors?: Record<string, string[]> } | undefined;
  return errors?.errors?.name?.[0] ?? null;
}

async function submit() {
  error.value = "";
  if (!nameField.value?.validate() || !canSubmit.value || !classCode.value) return;

  submitting.value = true;
  idempotencyKey ??= createIdempotencyKey();
  try {
    const hero = await usePlayerApi().createHero(playerId.value, {
      name: name.value.trim(),
      classCode: classCode.value,
      idempotencyKey,
    });
    await router.push(
      `/players/${encodeURIComponent(playerId.value)}/heroes/${hero.id}/created`,
    );
  } catch (cause) {
    if (cause instanceof GatewayError) {
      nameServerError.value = validationMessage(cause) ?? "";
      error.value = nameServerError.value
        ? "Correct the highlighted field."
        : cause.message;
    } else {
      error.value = "Unable to create this hero.";
    }
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main id="main" class="hero-creation">
    <header class="hero-creation__header">
      <div>
        <p class="hero-creation__eyebrow">Heroes · New</p>
        <h1>Create a hero</h1>
      </div>
      <p class="hero-creation__capacity">
        <strong
          >{{ heroes.length }}/{{ MAX_HEROES }} → {{ projectedHeroCount }}/{{
            MAX_HEROES
          }}</strong
        >
        <span>heroes</span>
      </p>
    </header>

    <p v-if="error" class="hero-creation__error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="hero-creation__loading" aria-live="polite">
      Preparing your hero…
    </p>
    <section v-else-if="isAtHeroLimit" class="hero-creation__limit" role="status">
      <p>Your roster already contains {{ MAX_HEROES }} heroes.</p>
      <NuxtLink :to="heroesPath">
        <UiButton>Back to my heroes</UiButton>
      </NuxtLink>
    </section>

    <div v-else class="hero-creation__grid">
      <form class="hero-creation__form" @submit.prevent="submit">
        <fieldset>
          <legend>1 · Name</legend>
          <PlayerValidatedInput
            id="hero-name"
            ref="nameField"
            :model-value="name"
            label="Hero name"
            :rules="HERO_NAME_RULES"
            hint="3 to 24 letters, spaces and hyphens allowed."
            :server-error="nameServerError"
            placeholder="Maëlle"
            :max-length="24"
            required
            @update:model-value="updateName"
            @validity-change="nameValid = $event"
          />
        </fieldset>

        <fieldset>
          <legend>2 · Class</legend>
          <div class="hero-creation__classes" role="radiogroup" aria-label="Hero class">
            <HeroClassSelectionCard
              v-for="heroClass in heroClasses"
              :key="heroClass.code"
              :hero-class="heroClass"
              :selected="classCode === heroClass.code"
              @select="classCode = heroClass.code"
            />
          </div>
        </fieldset>

        <button class="visually-hidden" :type="ButtonType.SUBMIT">Confirm</button>
      </form>

      <HeroCreationPreview
        :name="name"
        :hero-class="selectedClass"
        :can-confirm="canSubmit"
        :busy="submitting"
        @cancel="cancel"
        @confirm="submit"
      />
    </div>
  </main>
</template>

<style scoped lang="scss">
.hero-creation {
  width: min(100% - (var(--layout-gutter) * 2), 90rem);
  margin-inline: auto;
  padding-block: var(--space-6) var(--space-8);

  &__header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-5);
    border-bottom: 1px solid var(--color-border-subtle);
    padding-bottom: var(--space-4);
  }

  &__eyebrow {
    margin: 0 0 var(--space-1);
    color: var(--color-text-highlight);
    font-size: 0.625rem;
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-xl);
    text-transform: uppercase;
  }

  &__capacity {
    display: grid;
    justify-items: end;
    margin: 0;
    color: var(--color-text-highlight);
    font-size: var(--font-size-xs);
    line-height: 1;
  }

  &__capacity span {
    color: var(--color-text-muted);
    font-size: 0.625rem;
    text-transform: uppercase;
  }

  &__error,
  &__loading {
    margin: var(--space-4) 0 0;
    border: 1px solid var(--color-border-subtle);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface-raised);
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  &__error {
    border-left: var(--space-1) solid var(--color-danger);
    color: var(--color-text-primary);
  }

  &__limit {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin-top: var(--space-4);
    border: 1px solid var(--color-border-subtle);
    border-left: var(--space-1) solid var(--color-danger);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
  }

  &__limit p {
    margin: 0;
  }

  &__limit a {
    text-decoration: none;
  }

  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.42fr);
    gap: var(--space-4);
    margin-top: var(--space-4);
  }

  &__form,
  fieldset {
    display: grid;
    gap: var(--space-4);
  }

  &__form {
    border: 1px solid var(--color-border-subtle);
    padding: var(--space-4);
    background: var(--color-surface-raised);
  }

  fieldset {
    border: 0;
    padding: 0;
  }

  legend {
    margin-bottom: var(--space-3);
    color: var(--color-text-highlight);
    font-size: 0.625rem;
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  &__classes {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
}

@media (max-width: 48rem) {
  .hero-creation {
    &__header {
      align-items: start;
      flex-direction: column;
    }

    &__capacity {
      justify-items: start;
    }

    &__limit {
      align-items: start;
      flex-direction: column;
    }

    &__grid {
      grid-template-columns: 1fr;
    }
  }
}

@media (max-width: 30rem) {
  .hero-creation__classes {
    grid-template-columns: 1fr;
  }
}
</style>
