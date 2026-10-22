<script setup lang="ts">
/**
 * The "shaders" of the fight, as SVG filters (ADR-FE-005/006: no canvas, no WebGL). They
 * are declared once here and applied from CSS with `filter: url(#…)`:
 *
 * - `combat-heat`: animated noise displacing the pixels, the wobble of a flame;
 * - `combat-bloom`: a blurred copy added under the image, the halo of a bright light;
 * - `combat-glow-edge`: a thin bright outline, for a hero casting.
 *
 * The dissolve of a monster needs its own clock, so `CombatFighter` declares it per fighter.
 */
</script>

<template>
  <svg class="combat-filters" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <filter id="combat-heat" x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence type="fractalNoise" baseFrequency="0.03 0.09" numOctaves="2" seed="7" result="noise">
          <animate
            attributeName="baseFrequency"
            dur="1.4s"
            values="0.03 0.09;0.035 0.12;0.03 0.09"
            repeatCount="indefinite"
          />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
      </filter>

      <filter id="combat-bloom" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
        <feColorMatrix in="blur" type="saturate" values="1.6" result="saturated" />
        <feMerge>
          <feMergeNode in="saturated" />
          <feMergeNode in="saturated" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="combat-glow-edge" x="-20%" y="-20%" width="140%" height="140%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="grown" />
        <feFlood flood-color="#9fd4ff" result="color" />
        <feComposite in="color" in2="grown" operator="in" result="edge" />
        <feGaussianBlur in="edge" stdDeviation="2" result="halo" />
        <feMerge>
          <feMergeNode in="halo" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  </svg>
</template>

<style scoped>
.combat-filters {
  position: absolute;
  inline-size: 0;
  block-size: 0;
  overflow: hidden;
}
</style>
