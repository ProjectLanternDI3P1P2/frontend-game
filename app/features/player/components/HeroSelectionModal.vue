<script setup lang="ts">
import { ModalSize } from "~/shared/ui/UiModal.vue";
import HeroPortraitPlaceholder from "./HeroPortraitPlaceholder.vue";
import type { HeroSummary } from "../types";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    heroes: HeroSummary[];
    selectedHeroId: string | null;
    busy?: boolean;
  }>(),
  { busy: false },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  select: [hero: HeroSummary];
}>();

function choose(hero: HeroSummary): void {
  if (props.busy || hero.isEngagedInActiveSession) return;
  emit("select", hero);
}
</script>

<template>
  <UiModal
    :model-value="modelValue"
    title="Change hero"
    :size="ModalSize.MD"
    :scroll-body="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <p class="hero-selection-modal__intro">
      Choose the hero you want to play. Your selection is applied as soon as you click a hero.
    </p>
    <div class="hero-selection-modal__list" aria-label="Available heroes">
      <button
        v-for="hero in heroes"
        :key="hero.id"
        class="hero-selection-modal__hero"
        :class="{ 'hero-selection-modal__hero--selected': hero.id === selectedHeroId }"
        type="button"
        :disabled="busy || hero.isEngagedInActiveSession"
        :aria-pressed="hero.id === selectedHeroId"
        @click="choose(hero)"
      >
        <HeroPortraitPlaceholder :class-code="hero.classCode" :label="`${hero.name} portrait`" />
        <span>
          <strong>{{ hero.name }}</strong>
          <small>{{ hero.classCode }} · level {{ hero.level }}</small>
        </span>
        <em v-if="hero.id === selectedHeroId">Current</em>
        <em v-else-if="hero.isEngagedInActiveSession">In session</em>
      </button>
    </div>
  </UiModal>
</template>

<style scoped lang="scss">
.hero-selection-modal__intro { flex: none; margin: 0 0 var(--space-4); color: var(--color-text-muted); font-size: var(--font-size-sm); }
.hero-selection-modal__list { display: grid; min-height: 0; flex: 1; gap: var(--space-2); overflow-y: auto; padding-right: var(--space-2); }
.hero-selection-modal__hero { display: flex; align-items: center; width: 100%; gap: var(--space-3); border: 1px solid var(--color-border-subtle); padding: var(--space-3); background: var(--color-surface-overlay); color: var(--color-text-primary); text-align: left; cursor: pointer; }
.hero-selection-modal__hero:hover:not(:disabled), .hero-selection-modal__hero--selected { border-color: var(--color-accent); box-shadow: var(--shadow-gold); }
.hero-selection-modal__hero:disabled { opacity: .55; cursor: not-allowed; }
.hero-selection-modal__hero :deep(.hero-portrait) { width: 3.5rem; height: 3.5rem; }
.hero-selection-modal__hero span { display: grid; min-width: 0; gap: var(--space-1); }
.hero-selection-modal__hero strong { display: -webkit-box; overflow: hidden; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.hero-selection-modal__hero small { color: var(--color-text-muted); font-size: var(--font-size-xs); text-transform: capitalize; }
.hero-selection-modal__hero em { margin-left: auto; color: var(--color-text-highlight); font-size: .625rem; font-style: normal; font-weight: var(--font-weight-bold); letter-spacing: .12em; text-transform: uppercase; }
</style>
