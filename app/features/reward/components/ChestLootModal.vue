<script setup lang="ts">
import { computed } from "vue";
import type { ChestLootInteraction } from "../types";
import UiButton from "~/shared/ui/UiButton.vue";
import UiModal from "~/shared/ui/UiModal.vue";
import { ButtonVariant } from "~/shared/ui/ui.types";

const props = defineProps<{ interaction: ChestLootInteraction }>();

defineEmits<{
  retry: [];
  close: [];
}>();

const title = computed(() =>
  props.interaction.status === "success" ? "Chest loot" : "Opening chest",
);
</script>

<template>
  <UiModal :model-value="true" :title="title" @close="$emit('close')">
    <p
      v-if="interaction.status === 'loading'"
      class="chest-loot__status"
      role="status"
      aria-live="polite"
    >
      Generating loot…
    </p>

    <div
      v-else-if="interaction.status === 'error'"
      class="chest-loot__error"
      role="alert"
    >
      <p>The chest could not be opened.</p>
      <p>{{ interaction.errorMessage }}</p>
    </div>

    <div v-else class="chest-loot__result">
      <p v-if="interaction.result?.alreadyGenerated" class="chest-loot__recalled">
        This chest was already opened. Here is its saved loot.
      </p>
      <ul class="chest-loot__items" aria-label="Chest items">
        <li
          v-for="item in interaction.result?.items ?? []"
          :key="item.itemId"
          class="chest-loot__item"
        >
          <span>
            <strong>{{ item.name }}</strong>
            <small>{{ item.rarity }}</small>
          </span>
          <span aria-label="Quantity">×{{ item.quantity }}</span>
        </li>
      </ul>
      <p v-if="interaction.result?.items.length === 0" class="chest-loot__status">
        The chest is empty.
      </p>
    </div>

    <template v-if="interaction.status !== 'loading'" #footer>
      <UiButton
        v-if="interaction.status === 'error'"
        :variant="ButtonVariant.SECONDARY"
        @click="$emit('retry')"
        >Retry</UiButton
      >
      <UiButton @click="$emit('close')">Close</UiButton>
    </template>
  </UiModal>
</template>

<style scoped lang="scss">
.chest-loot__status,
.chest-loot__error p,
.chest-loot__recalled {
  margin: 0;
}

.chest-loot__status,
.chest-loot__recalled {
  color: var(--color-text-muted);
}

.chest-loot__error {
  display: grid;
  gap: var(--space-2);
  color: var(--color-danger);
}

.chest-loot__result {
  display: grid;
  gap: var(--space-4);
}

.chest-loot__items {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.chest-loot__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface-overlay);
}

.chest-loot__item > span:first-child {
  display: grid;
  gap: var(--space-1);
}

.chest-loot__item small {
  color: var(--color-text-muted);
}
</style>
