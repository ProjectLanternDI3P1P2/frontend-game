<script setup lang="ts">
/**
 * PLACEHOLDER (F00): the expanded ranking row. F03 replaces it with the hero
 * detail and facts; F02 shows it in the expanded row without changing it.
 * Contract: these props, no emit.
 */
defineProps<{ heroId: string; currentPlayerId: string }>();
</script>

<template>
  <p class="ranking-row-detail">Loading hero detail…</p>
</template>

<style scoped lang="scss">
.ranking-row-detail {
  margin: 0;
  color: var(--color-text-muted);
}
</style>
