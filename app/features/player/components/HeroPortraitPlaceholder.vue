<script setup lang="ts">
import type { HeroAppearance } from "../appearance";
import type { HeroClassCode } from "../types";
import HeroSprite from "./HeroSprite.vue";

/**
 * Framed hero portrait. Kept under its historical name so every screen picks up the sprite;
 * without an appearance it draws the default look with the class headwear.
 */
withDefaults(
  defineProps<{
    classCode: HeroClassCode;
    appearance?: Partial<HeroAppearance> | null;
    label?: string;
  }>(),
  { appearance: null, label: "Hero portrait" },
);
</script>

<template>
  <span class="hero-portrait" :class="`hero-portrait--${classCode}`">
    <HeroSprite :class-code="classCode" :appearance="appearance" />
    <span class="visually-hidden">{{ label }}</span>
  </span>
</template>

<style scoped lang="scss">
.hero-portrait {
  display: grid;
  width: 3.25rem;
  height: 3.25rem;
  place-items: center;
  border: 1px solid var(--color-border-subtle);
  background: var(--color-surface-base);
}
</style>
