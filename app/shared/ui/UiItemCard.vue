<script lang="ts">
import { BadgeSize, BadgeTone } from "./UiBadge.vue";

export enum ItemRarity {
  COMMON = "common",
  MAGIC = "magic",
  RARE = "rare",
  LEGENDARY = "legendary",
  MYTHIC = "mythic",
}
</script>

<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string;
    rarity?: ItemRarity;
    description?: string;
    image?: string;
    selected?: boolean;
    disabled?: boolean;
  }>(),
  {
    rarity: ItemRarity.COMMON,
    description: "",
    image: "",
    selected: false,
    disabled: false,
  },
);

defineEmits<{ select: [] }>();
</script>

<template>
  <article
    class="ui-item-card"
    :class="['ui-item-card--' + rarity, { 'ui-item-card--selected': selected }]"
  >
    <button
      class="ui-item-card__button"
      type="button"
      :disabled="disabled"
      @click="$emit('select')"
    >
      <span class="ui-item-card__image"
        ><img v-if="image" :src="image" alt="" /><slot v-else name="image"
          >✦</slot
        ></span
      >
      <span class="ui-item-card__copy"
        ><strong>{{ name }}</strong
        ><span v-if="description">{{ description }}</span
        ><UiBadge :tone="BadgeTone.RARITY" :size="BadgeSize.SM">{{
          rarity
        }}</UiBadge></span
      >
    </button>
  </article>
</template>

<style scoped lang="scss">
.ui-item-card {
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-raised);
  box-shadow: var(--shadow-sm);
}
.ui-item-card__button {
  display: flex;
  width: 100%;
  align-items: center;
  gap: var(--space-3);
  border: 0;
  padding: var(--space-3);
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.ui-item-card__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ui-item-card__image {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  flex: none;
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-overlay);
  color: var(--color-accent);
}
.ui-item-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
}
.ui-item-card__copy {
  display: grid;
  gap: var(--space-1);
}
.ui-item-card__copy > span {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.ui-item-card--magic {
  border-color: var(--color-rarity-magic);
}
.ui-item-card--rare {
  border-color: var(--color-rarity-rare);
}
.ui-item-card--legendary {
  border-color: var(--color-rarity-legendary);
}
.ui-item-card--mythic {
  border-color: var(--color-rarity-mythic);
}
.ui-item-card--selected {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
</style>
