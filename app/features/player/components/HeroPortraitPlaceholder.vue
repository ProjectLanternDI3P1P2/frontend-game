<script setup lang="ts">
import type { HeroClassCode } from "../types";

withDefaults(
  defineProps<{
    classCode: HeroClassCode;
    label?: string;
  }>(),
  { label: "Hero portrait placeholder" },
);
</script>

<template>
  <span class="hero-portrait" :class="`hero-portrait--${classCode}`" aria-hidden="true">
    <span class="hero-portrait__sprite">
      <span class="hero-portrait__head" />
      <span class="hero-portrait__body" />
    </span>
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

  &__sprite {
    position: relative;
    display: grid;
    width: 1.5rem;
    height: 2rem;
    place-items: center;
    filter: drop-shadow(0 2px 0 var(--color-surface-base));
  }

  &__head,
  &__body {
    display: block;
    border: 2px solid var(--color-surface-base);
  }

  &__head {
    position: absolute;
    top: 0;
    width: 0.85rem;
    height: 0.85rem;
    background: var(--color-text-muted);
  }

  &__body {
    position: absolute;
    bottom: 0;
    width: 1.35rem;
    height: 1.15rem;
    background: var(--color-arcane);
    box-shadow:
      -0.2rem 0.8rem 0 -0.05rem var(--color-arcane),
      0.2rem 0.8rem 0 -0.05rem var(--color-arcane);
  }

  &--warrior &__body {
    background: var(--color-accent);
    box-shadow:
      -0.2rem 0.8rem 0 -0.05rem var(--color-accent),
      0.2rem 0.8rem 0 -0.05rem var(--color-accent);
  }

  &--shaman &__body {
    background: var(--color-success);
    box-shadow:
      -0.2rem 0.8rem 0 -0.05rem var(--color-success),
      0.2rem 0.8rem 0 -0.05rem var(--color-success);
  }
}
</style>
