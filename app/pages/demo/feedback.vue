<script setup lang="ts">
import { ref } from "vue";
import {
  ButtonVariant,
  ModalSize,
  NoticeTone,
  PanelHeadingLevel,
} from "~/shared/ui/ui.types";
useHead({ title: "Feedback · UI kit" });
const activeTab = ref("overview");
const modalOpen = ref(false);
const questAccepted = ref(false);
const tabs = [
  { id: "overview", label: "Overview" },
  { id: "rewards", label: "Rewards" },
  { id: "history", label: "History", disabled: true },
];
const acceptQuest = () => {
  questAccepted.value = true;
  modalOpen.value = false;
};
</script>
<template>
  <div class="demo-page">
    <header>
      <NuxtLink to="/demo">← Component library</NuxtLink>
      <h1>Feedback & overlays</h1>
      <p>Dynamic content retains accessible roles and keyboard controls.</p>
    </header>
    <UiPanel title="UiNotice" :heading-level="PanelHeadingLevel.TWO"
      ><div class="demo-page__stack">
        <UiNotice title="Information">The Ancient Crypt portal is open.</UiNotice
        ><UiNotice :tone="NoticeTone.SUCCESS" title="Reward unlocked"
          >You received 120 coins.</UiNotice
        ><UiNotice :tone="NoticeTone.WARNING" title="Warning"
          >The party already has four players.</UiNotice
        ><UiNotice :tone="NoticeTone.DANGER" title="Danger"
          >This area is recommended for level 30.</UiNotice
        >
      </div></UiPanel
    ><UiPanel title="UiTabs" :heading-level="PanelHeadingLevel.TWO"
      ><UiTabs v-model="activeTab" :tabs="tabs" label="Quest details"
        ><p v-if="activeTab === 'overview'">
          Find the lost shard in the caverns beneath the old city.
        </p>
        <p v-else>
          Possible loot: an arcane gem, 120 coins, and a dungeon map.
        </p></UiTabs
      ></UiPanel
    ><UiPanel title="UiModal" :heading-level="PanelHeadingLevel.TWO"
      ><div class="demo-page__stack">
        <UiButton @click="modalOpen = true">Accept quest</UiButton
        ><UiNotice v-if="questAccepted" :tone="NoticeTone.SUCCESS" title="Quest added"
          >The Ancient Crypt is now in your journal.</UiNotice
        >
      </div></UiPanel
    ><UiModal v-model="modalOpen" title="The Ancient Crypt" :size="ModalSize.SM"
      ><p>This quest is recommended for a level 20 party. Add it to your journal?</p>
      <template #footer
        ><UiButton :variant="ButtonVariant.GHOST" @click="modalOpen = false"
          >Later</UiButton
        ><UiButton @click="acceptQuest">Accept</UiButton></template
      ></UiModal
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
.demo-page__stack {
  display: grid;
  gap: var(--space-3);
}
</style>
