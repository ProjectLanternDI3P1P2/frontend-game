<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { ButtonVariant } from "~/shared/ui/UiButton.vue";
import { ModalSize } from "~/shared/ui/UiModal.vue";
import type { ActiveMarketplaceListing } from "../types";

defineProps<{
  listings: ActiveMarketplaceListing[];
  status: "idle" | "loading" | "ready" | "error";
}>();

const emit = defineEmits<{
  close: [];
  refresh: [];
}>();

const content = ref<HTMLElement | null>(null);
const priceFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

function onKeydown(event: KeyboardEvent) {
  if (
    event.code === "KeyM" &&
    !event.repeat &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !(
      event.target instanceof HTMLElement &&
      event.target.closest("input, textarea, select, [contenteditable]")
    )
  ) {
    event.preventDefault();
    emit("close");
    return;
  }

  if (event.key !== "Tab") return;
  const dialog = content.value?.closest("dialog");
  const buttons = dialog?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
  const first = buttons?.[0];
  const last = buttons?.[buttons.length - 1];
  if (!first || !last) return;
  if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === dialog)
  ) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  await nextTick();
  content.value?.closest("dialog")?.focus();
});

onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <UiModal
    :model-value="true"
    title="Marketplace"
    :size="ModalSize.LG"
    @update:model-value="emit('close')"
  >
    <div ref="content" class="marketplace" :aria-busy="status === 'loading'">
      <p v-if="status === 'loading'" class="marketplace__message" role="status">
        Loading listings...
      </p>
      <div v-else-if="status === 'error'" class="marketplace__message">
        <p role="alert">The marketplace could not be loaded.</p>
        <UiButton :variant="ButtonVariant.SECONDARY" @click="emit('refresh')">
          Try again
        </UiButton>
      </div>
      <p
        v-else-if="status === 'ready' && !listings.length"
        class="marketplace__message"
        role="status"
      >
        No active listings available.
      </p>
      <ul
        v-else-if="status === 'ready'"
        class="marketplace__list"
        aria-label="Active listings"
      >
        <li v-for="listing in listings" :key="listing.id" class="marketplace__listing">
          <div class="marketplace__item">
            <h3>{{ listing.itemName }}</h3>
            <dl class="marketplace__characteristics">
              <div>
                <dt>Category</dt>
                <dd>{{ listing.category }}</dd>
              </div>
              <div>
                <dt>Rarity</dt>
                <dd>{{ listing.rarity }}</dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd>{{ listing.quantity }}</dd>
              </div>
            </dl>
            <p class="marketplace__seller">
              Seller <span>{{ listing.sellerId }}</span>
            </p>
          </div>
          <dl class="marketplace__price">
            <dt>Price</dt>
            <dd>{{ priceFormat.format(listing.price) }}</dd>
          </dl>
        </li>
      </ul>
    </div>
    <template #footer>
      <UiButton
        :variant="ButtonVariant.SECONDARY"
        :disabled="status === 'loading'"
        @click="emit('refresh')"
        >Refresh</UiButton
      >
    </template>
  </UiModal>
</template>

<style scoped lang="scss">
.marketplace {
  color: var(--color-text-primary);

  &__message {
    padding-block: var(--space-5);
    text-align: center;
    color: var(--color-text-muted);
  }

  &__list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  &__listing {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(5rem, auto);
    align-items: start;
    gap: var(--space-4);
    padding-block: var(--space-4);
    border-bottom: 1px solid var(--color-border-subtle);

    &:first-child {
      padding-top: 0;
    }
    &:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
  }

  &__item {
    min-width: 0;

    h3 {
      margin: 0 0 var(--space-3);
      font-size: var(--font-size-lg);
      color: var(--color-text-highlight);
      overflow-wrap: anywhere;
    }
  }

  &__characteristics {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-5);
    margin: 0;

    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
  }

  dt {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
  }

  &__seller {
    margin: var(--space-3) 0 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    overflow-wrap: anywhere;

    span {
      display: block;
    }
  }

  &__price {
    margin: 0;
    text-align: right;
    max-width: 10rem;
    overflow-wrap: anywhere;

    dd {
      margin: 0;
      color: var(--color-text-highlight);
      font-size: var(--font-size-lg);
      font-variant-numeric: tabular-nums;
    }
  }

  @media (max-width: 480px) {
    &__listing {
      grid-template-columns: minmax(0, 1fr);
    }
    &__price {
      text-align: left;
    }
  }
}
</style>
