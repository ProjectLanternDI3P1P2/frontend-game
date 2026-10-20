<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ButtonType, ButtonVariant } from "~/shared/ui/UiButton.vue";
import { InputType } from "~/shared/ui/UiInput.vue";
import { ModalSize } from "~/shared/ui/UiModal.vue";
import { NoticeTone } from "~/shared/ui/UiNotice.vue";
import { BadgeTone } from "~/shared/ui/UiBadge.vue";
import { HERO_ROSTER_CAPACITY, HeroDeletionStep } from "../types";

/**
 * US-PLAYER-10 — Figma "Player / Heroes / Deletion – *" states.
 * Presentational: the page owns the API call and passes the resulting state.
 */

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    step: HeroDeletionStep;
    heroName: string;
    heroClassLabel: string;
    heroCount: number;
    /** The hero waits in a lobby that will be closed for every member. */
    closesLobby?: boolean;
    sessionId?: string | null;
    deleting?: boolean;
    error?: string;
  }>(),
  {
    closesLobby: false,
    sessionId: null,
    deleting: false,
    error: "",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  confirm: [];
  "view-session": [];
}>();

const typedName = ref("");
const nameMatches = computed(() => typedName.value === props.heroName);
const sessionReference = computed(() =>
  props.sessionId ? "session_" + props.sessionId.slice(0, 4).toUpperCase() : "",
);
const hint = computed(() =>
  props.deleting
    ? "Deleting…"
    : "The button activates when the typed name matches exactly.",
);

watch(
  () => props.modelValue,
  (open) => {
    if (open) typedName.value = "";
  },
);

function close() {
  if (!props.deleting) emit("update:modelValue", false);
}

function confirm() {
  if (nameMatches.value && !props.deleting) emit("confirm");
}
</script>

<template>
  <UiModal
    :model-value="modelValue"
    :label="
      step === HeroDeletionStep.BLOCKED
        ? heroName + ' is in session'
        : 'Delete ' + heroName + '?'
    "
    :size="ModalSize.MD"
    :show-close-button="false"
    :close-on-backdrop="!deleting"
    :close-on-escape="!deleting"
    dialog-class="hero-deletion"
    @update:model-value="close"
  >
    <form
      v-if="step === HeroDeletionStep.CONFIRM"
      class="hero-deletion__content"
      @submit.prevent="confirm"
    >
      <header>
        <p class="hero-deletion__eyebrow hero-deletion__eyebrow--danger">
          Irreversible action
        </p>
        <h2 class="hero-deletion__title">Delete {{ heroName }}?</h2>
      </header>

      <p class="hero-deletion__text">
        {{ heroName }} ({{ heroClassLabel }}) will be permanently deleted from your
        account. This cannot be undone and frees up a slot ({{ heroCount }}/{{
          HERO_ROSTER_CAPACITY
        }}).
      </p>

      <UiNotice v-if="closesLobby" :tone="NoticeTone.WARNING">
        {{ heroName }} is waiting in a lobby. Deleting it will close that lobby for
        every member.
      </UiNotice>

      <UiInput
        id="hero-deletion-name"
        v-model="typedName"
        class="hero-deletion__field"
        label="To confirm, type the hero’s name"
        :type="InputType.TEXT"
        :placeholder="heroName"
        :max-length="heroName.length"
        :hint="hint"
        :error="error"
        :disabled="deleting"
        autocomplete="off"
      >
        <template #suffix
          ><span class="hero-deletion__counter"
            >{{ typedName.length }}/{{ heroName.length }}</span
          ></template
        >
      </UiInput>

      <footer class="hero-deletion__actions">
        <UiButton :variant="ButtonVariant.GHOST" :disabled="deleting" @click="close"
          >Cancel</UiButton
        >
        <UiButton
          :variant="ButtonVariant.DANGER"
          :type="ButtonType.SUBMIT"
          :disabled="!nameMatches"
          :busy="deleting"
          >{{ deleting ? "Deleting…" : "Delete permanently" }}</UiButton
        >
      </footer>
    </form>

    <div v-else class="hero-deletion__content">
      <header class="hero-deletion__blocked-header">
        <span class="hero-deletion__glyph" aria-hidden="true">
          <span class="hero-deletion__padlock" />
        </span>
        <div>
          <p class="hero-deletion__eyebrow hero-deletion__eyebrow--accent">
            Cannot delete
          </p>
          <h2 class="hero-deletion__title">{{ heroName }} is in session</h2>
        </div>
      </header>

      <p class="hero-deletion__text">
        {{ heroName }} is engaged in an active session. A hero cannot be deleted until
        the game is over or abandoned.
      </p>

      <section class="hero-deletion__session" aria-label="Session in progress">
        <div>
          <p class="hero-deletion__eyebrow hero-deletion__eyebrow--accent">
            Session in progress
          </p>
          <strong>Dungeon run</strong>
          <small v-if="sessionReference">{{ sessionReference }}</small>
        </div>
        <UiBadge :tone="BadgeTone.NEUTRAL" outlined class="hero-deletion__badge"
          >● In session</UiBadge
        >
      </section>

      <footer class="hero-deletion__actions">
        <UiButton :variant="ButtonVariant.SECONDARY" @click="close">Close</UiButton>
        <UiButton
          v-if="sessionId"
          :variant="ButtonVariant.PRIMARY"
          @click="emit('view-session')"
          >View session →</UiButton
        >
      </footer>
    </div>
  </UiModal>
</template>

<style scoped lang="scss">
.hero-deletion {
  &__content {
    display: grid;
    gap: var(--space-5);
  }

  &__eyebrow {
    margin: 0 0 var(--space-1);
    font-size: 0.625rem;
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  &__eyebrow--danger {
    color: var(--color-danger);
  }

  &__eyebrow--accent {
    color: var(--color-accent);
  }

  &__title {
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-family-display);
    font-size: var(--font-size-xl);
    overflow-wrap: anywhere;
    text-transform: uppercase;
  }

  &__text {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-tight);
  }

  &__field :deep(.ui-input__label) {
    font-size: 0.625rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  &__counter {
    font-family: var(--font-family-mono);
    font-size: var(--font-size-xs);
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
  }

  &__blocked-header {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  &__glyph {
    display: grid;
    flex: none;
    width: 6rem;
    height: 6rem;
    place-items: center;
    border: 1px solid var(--color-border-strong);
    background: var(--color-surface-overlay);
  }

  // Padlock drawn with tokens rather than an asset, as in the mockup.
  &__padlock {
    position: relative;
    width: 2.25rem;
    height: 1.75rem;
    margin-top: 1.25rem;
    border-radius: 2px;
    background: var(--color-accent);

    &::before {
      position: absolute;
      bottom: 100%;
      left: 50%;
      width: 1.5rem;
      height: 1.25rem;
      border: 0.25rem solid var(--color-accent);
      border-bottom: 0;
      border-radius: 0.75rem 0.75rem 0 0;
      content: "";
      transform: translateX(-50%);
    }
  }

  &__session {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--color-surface-overlay);
  }

  &__session > div {
    display: grid;
    gap: var(--space-1);
  }

  &__session strong {
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
  }

  &__session small {
    color: var(--color-text-muted);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-xs);
  }

  &__badge {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
}

@media (max-width: 30rem) {
  .hero-deletion {
    &__blocked-header,
    &__session {
      align-items: start;
      flex-direction: column;
    }

    &__actions {
      justify-content: stretch;
    }
  }
}
</style>
