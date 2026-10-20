<script setup lang="ts">
import {
  CLASS_HEADWEAR,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  isHairless,
  type HeroAppearance,
  type HeroHairStyle,
} from "../appearance";
import type { HeroClassCode } from "../types";
import HeroSprite from "./HeroSprite.vue";

/** Skin tone, hair style (bald included) and hair color choices of the hero creation. */
const props = defineProps<{
  modelValue: HeroAppearance;
  /** When the class wears headwear, the hair is hidden under it in the preview. */
  classCode?: HeroClassCode | null;
}>();
const emit = defineEmits<{ "update:modelValue": [value: HeroAppearance] }>();

// The last color is kept while bald, so going back to a hairstyle restores it.
let lastHairColor = props.modelValue.hairColor ?? 1;

function update(patch: Partial<HeroAppearance>) {
  emit("update:modelValue", { ...props.modelValue, ...patch });
}

function chooseHairStyle(hairStyle: HeroHairStyle) {
  if (props.modelValue.hairColor !== null) lastHairColor = props.modelValue.hairColor;
  update({ hairStyle, hairColor: hairStyle === "bald" ? null : lastHairColor });
}

function chooseHairColor(hairColor: number) {
  lastHairColor = hairColor;
  update({ hairColor });
}
</script>

<template>
  <div class="hero-appearance-picker">
    <div class="hero-appearance-picker__group">
      <p id="skin-tone-label" class="hero-appearance-picker__label">Skin tone</p>
      <div
        class="hero-appearance-picker__swatches"
        role="radiogroup"
        aria-labelledby="skin-tone-label"
      >
        <input
          v-for="tone in SKIN_TONES"
          :key="tone.value"
          class="hero-appearance-picker__swatch"
          type="radio"
          name="skin-tone"
          :checked="modelValue.skinTone === tone.value"
          :aria-label="`Skin tone ${tone.label}`"
          :title="tone.label"
          :style="{ '--swatch-color': tone.color }"
          @change="update({ skinTone: tone.value })"
        />
      </div>
    </div>

    <div class="hero-appearance-picker__group">
      <p id="hair-style-label" class="hero-appearance-picker__label">Hair style</p>
      <p
        v-if="classCode && CLASS_HEADWEAR[classCode]"
        class="hero-appearance-picker__hint"
      >
        The {{ classCode }}'s headwear hides the hair; it shows bare-headed.
      </p>
      <div
        class="hero-appearance-picker__styles"
        role="radiogroup"
        aria-labelledby="hair-style-label"
      >
        <label
          v-for="style in HAIR_STYLES"
          :key="style.value"
          class="hero-appearance-picker__style"
        >
          <input
            type="radio"
            name="hair-style"
            :checked="modelValue.hairStyle === style.value"
            :value="style.value"
            @change="chooseHairStyle(style.value)"
          />
          <HeroSprite
            :appearance="{
              ...modelValue,
              hairStyle: style.value,
              hairColor: style.value === 'bald' ? null : (modelValue.hairColor ?? 1),
            }"
            :scale="2"
          />
          <span>{{ style.label }}</span>
        </label>
      </div>
    </div>

    <div class="hero-appearance-picker__group">
      <p id="hair-color-label" class="hero-appearance-picker__label">Hair color</p>
      <p v-if="isHairless(modelValue)" class="hero-appearance-picker__hint">
        A bald hero has no hair color.
      </p>
      <div
        v-else
        class="hero-appearance-picker__swatches"
        role="radiogroup"
        aria-labelledby="hair-color-label"
      >
        <input
          v-for="color in HAIR_COLORS"
          :key="color.value"
          class="hero-appearance-picker__swatch"
          type="radio"
          name="hair-color"
          :checked="modelValue.hairColor === color.value"
          :aria-label="`Hair color ${color.label}`"
          :title="color.label"
          :style="{ '--swatch-color': color.color }"
          @change="chooseHairColor(color.value)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.hero-appearance-picker {
  display: grid;
  gap: var(--space-4);

  &__group {
    display: grid;
    gap: var(--space-2);
  }

  &__label {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
  }

  &__hint {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.625rem;
  }

  &__swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  &__swatch {
    width: 1.75rem;
    height: 1.75rem;
    appearance: none;
    border-radius: 50%;
    border: 2px solid var(--color-border-subtle);
    padding: 0;
    background: var(--swatch-color);
    box-shadow: inset 0 0 0 2px var(--color-surface-base);
    cursor: pointer;

    &:checked {
      border-color: var(--color-text-highlight);
      box-shadow:
        inset 0 0 0 2px var(--color-surface-base),
        0 0 0 2px var(--color-text-highlight);
    }

    &:focus-visible {
      box-shadow:
        inset 0 0 0 2px var(--color-surface-base),
        0 0 0 2px var(--color-text-primary);
    }

    &:checked:focus-visible {
      box-shadow:
        inset 0 0 0 2px var(--color-surface-base),
        0 0 0 2px var(--color-text-highlight),
        0 0 0 4px var(--color-text-primary);
    }
  }

  &__styles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }

  &__style {
    display: grid;
    justify-items: center;
    gap: var(--space-1);
    border: 1px solid var(--color-border-subtle);
    padding: var(--space-2);
    background: var(--color-surface-base);
    color: var(--color-text-muted);
    font: inherit;
    font-size: var(--font-size-xs);
    cursor: pointer;

    &:has(input:checked) {
      border-color: var(--color-text-highlight);
      color: var(--color-text-primary);
    }

    &:focus-visible {
      outline: 2px solid var(--color-text-primary);
      outline-offset: 2px;
    }
  }

  &__style input {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    clip-path: inset(50%);
  }
}
</style>
