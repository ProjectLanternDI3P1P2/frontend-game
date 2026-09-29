<script setup lang="ts">
import { ref } from "vue";
import {
  BadgeSize,
  BadgeTone,
  ButtonSize,
  ButtonVariant,
  IconButtonVariant,
  NoticeTone,
  PanelHeadingLevel,
} from "~/shared/ui/ui.types";
useHead({ title: "Actions · UI kit" });
const busy = ref(false);
const showMessage = ref(false);
const simulateLoading = () => {
  busy.value = true;
  window.setTimeout(() => {
    busy.value = false;
    showMessage.value = true;
  }, 800);
};
</script>
<template>
  <div class="demo-page">
    <header>
      <NuxtLink to="/demo">← Component library</NuxtLink>
      <h1>Actions & states</h1>
      <p>Visual variants keep the same native, accessible button interface.</p>
    </header>
    <UiNotice
      v-if="showMessage"
      :tone="NoticeTone.SUCCESS"
      title="Action complete"
      dismissible
      @dismiss="showMessage = false"
      >The busy button is available again.</UiNotice
    ><UiPanel title="UiButton" :heading-level="PanelHeadingLevel.TWO"
      ><div class="demo-page__row">
        <UiButton>Continue</UiButton
        ><UiButton :variant="ButtonVariant.SECONDARY">Equip</UiButton
        ><UiButton :variant="ButtonVariant.GHOST">View details</UiButton
        ><UiButton :variant="ButtonVariant.DANGER">Abandon</UiButton
        ><UiButton :size="ButtonSize.SM">Small</UiButton
        ><UiButton :size="ButtonSize.LG">Large</UiButton
        ><UiButton :busy="busy" @click="simulateLoading"
          >Simulate quest</UiButton
        ><UiButton disabled>Unavailable</UiButton>
      </div></UiPanel
    ><UiPanel title="UiIconButton" :heading-level="PanelHeadingLevel.TWO"
      ><div class="demo-page__row">
        <UiIconButton label="Add">＋</UiIconButton
        ><UiIconButton
          label="Open settings"
          :variant="IconButtonVariant.OUTLINE"
          >⚙</UiIconButton
        ><UiIconButton label="Delete" :variant="IconButtonVariant.DANGER"
          >×</UiIconButton
        ><UiIconButton label="Disabled action" disabled>⌁</UiIconButton>
      </div></UiPanel
    ><UiPanel title="UiBadge" :heading-level="PanelHeadingLevel.TWO"
      ><div class="demo-page__row">
        <UiBadge>New</UiBadge><UiBadge :tone="BadgeTone.SUCCESS">Online</UiBadge
        ><UiBadge :tone="BadgeTone.ARCANE">Arcane</UiBadge
        ><UiBadge :tone="BadgeTone.RARITY" :size="BadgeSize.SM">Rare</UiBadge
        ><UiBadge :tone="BadgeTone.DANGER" outlined>Alert</UiBadge>
      </div></UiPanel
    >
  </div>
</template>
<style scoped lang="scss">
.demo-page {
  display: grid;
  gap: var(--space-5);
}
.demo-page > header {
  display: grid;
  gap: var(--space-2);
}
.demo-page > header p {
  color: var(--color-text-muted);
}
.demo-page__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}
</style>
