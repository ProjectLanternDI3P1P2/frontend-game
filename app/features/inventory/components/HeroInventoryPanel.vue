<script setup lang="ts">
import { computed } from "vue";
import type { HeroInventory, InventoryItem } from "../types";
import { ButtonSize, ButtonVariant } from "~/shared/ui/UiButton.vue";
import { NoticeTone } from "~/shared/ui/UiNotice.vue";

const props = defineProps<{
  inventory: HeroInventory | null;
  loading: boolean;
  unavailable: boolean;
}>();
defineEmits<{ retry: [] }>();

const groups = computed(() => [
  { label: "Items", list: props.inventory?.items ?? [] },
  { label: "Consumables", list: props.inventory?.consumables ?? [] },
]);

function badge(item: InventoryItem): string {
  if (item.isEquipped) return "Equipped";
  if (item.isReserved) return "Reserved";
  return "";
}
</script>

<template>
  <section class="hero-inventory" aria-labelledby="hero-inventory-title">
    <h2 id="hero-inventory-title">Inventory</h2>

    <UiNotice v-if="unavailable" :tone="NoticeTone.WARNING">
      The inventory is temporarily unavailable. Your hero details are still up to date.
      <UiButton
        :size="ButtonSize.SM"
        :variant="ButtonVariant.GHOST"
        :busy="loading"
        @click="$emit('retry')"
        >Retry</UiButton
      >
    </UiNotice>
    <output v-else-if="loading && !inventory" aria-label="Loading inventory"
      >Loading inventory…</output
    >
    <template v-else-if="inventory">
      <p v-if="!inventory.items.length && !inventory.consumables.length">
        This hero owns nothing yet.
      </p>
      <template v-for="group in groups" :key="group.label">
        <div v-if="group.list.length">
          <h3>{{ group.label }}</h3>
          <ul>
            <li v-for="item in group.list" :key="item.id">
              <span>{{ item.name }}</span>
              <small>{{ item.rarity }} · {{ item.type }}</small>
              <small v-if="item.quantity > 1">× {{ item.quantity }}</small>
              <small v-if="badge(item)">{{ badge(item) }}</small>
            </li>
          </ul>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped lang="scss">
.hero-inventory {
  display: grid;
  gap: var(--space-3);

  ul {
    display: grid;
    gap: var(--space-2);
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-3);
  }

  small {
    color: var(--color-text-muted);
  }
}
</style>
