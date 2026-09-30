<script setup lang="ts">
import { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import type { HeroClassOption } from "../types";
import HeroPortraitPlaceholder from "./HeroPortraitPlaceholder.vue";

defineProps<{
  name: string;
  heroClass: HeroClassOption | null;
  canConfirm: boolean;
  busy: boolean;
}>();

defineEmits<{ cancel: []; confirm: [] }>();
</script>

<template>
  <aside class="hero-creation-preview" aria-label="Hero preview">
    <p class="hero-creation-preview__eyebrow">Preview</p>
    <div class="hero-creation-preview__portrait">
      <HeroPortraitPlaceholder
        v-if="heroClass"
        :class-code="heroClass.code"
        :label="`${heroClass.label} placeholder`"
      />
      <span v-else aria-hidden="true">?</span>
    </div>
    <h2>{{ name.trim() || "Choose a name" }}</h2>
    <p class="hero-creation-preview__class">
      {{ heroClass?.label ?? "Choose a class" }}
    </p>
    <p class="hero-creation-preview__description">
      {{ heroClass?.description ?? "Choose a name and a class to preview your hero." }}
    </p>
    <p class="hero-creation-preview__ability">
      First ability · {{ heroClass?.label ?? "—" }}
    </p>
    <div class="hero-creation-preview__actions">
      <UiButton
        :size="ButtonSize.SM"
        :variant="ButtonVariant.GHOST"
        @click="$emit('cancel')"
        >Cancel</UiButton
      >
      <UiButton
        :size="ButtonSize.SM"
        :variant="ButtonVariant.PRIMARY"
        :disabled="!canConfirm"
        :busy="busy"
        @click="$emit('confirm')"
        >Confirm</UiButton
      >
    </div>
  </aside>
</template>

<style scoped lang="scss">
.hero-creation-preview {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: var(--space-3);
  min-height: 22rem;
  border: 1px solid var(--color-border-subtle);
  padding: var(--space-4);
  background: var(--color-surface-raised);

  &__eyebrow {
    margin: 0;
    color: var(--color-text-highlight);
    font-size: 0.625rem;
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  &__portrait {
    display: grid;
    min-height: 8rem;
    place-items: center;
    background: var(--color-surface-overlay);
    color: var(--color-text-muted);
    font-size: var(--font-size-xl);
  }

  h2,
  &__class,
  &__description,
  &__ability {
    margin: 0;
  }

  h2 {
    min-width: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-lg);
    overflow-wrap: anywhere;
    text-transform: uppercase;
  }

  &__class {
    color: var(--color-text-highlight);
    font-size: var(--font-size-sm);
  }

  &__description {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
  }

  &__ability {
    color: var(--color-text-muted);
    font-size: 0.625rem;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: auto;
  }
}
</style>
