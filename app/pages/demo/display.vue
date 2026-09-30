<script setup lang="ts">
import { ref } from "vue";
import {
  AvatarSize,
  AvatarStatus,
  BadgeTone,
  ItemRarity,
  ProgressTone,
  StatTone,
  PanelHeadingLevel,
} from "~/shared/ui/ui.types";
useHead({ title: "Game data · UI kit" });
const experience = ref(68);
const selectedItem = ref("Azure Scepter");
const heroFace = new URL("../../assets/heroes/dg_faceset.png", import.meta.url).href;
</script>
<template>
  <div class="demo-page">
    <header>
      <NuxtLink to="/demo">← Component library</NuxtLink>
      <h1>Game data</h1>
      <p>Presentational components powered by semantic colors and item rarity.</p>
    </header>
    <UiPanel title="UiPanel & UiStat" :heading-level="PanelHeadingLevel.TWO"
      ><div class="demo-page__stats">
        <UiStat label="Level" value="24" detail="Scout" :tone="StatTone.ACCENT"
          ><template #icon>✦</template></UiStat
        ><UiStat
          label="Victories"
          value="147"
          detail="This season"
          :tone="StatTone.SUCCESS"
          ><template #icon>♜</template></UiStat
        ><UiStat label="Defeats" value="12" detail="This season" :tone="StatTone.DANGER"
          ><template #icon>⚑</template></UiStat
        >
      </div></UiPanel
    ><UiPanel title="UiAvatar & UiProgressBar" :heading-level="PanelHeadingLevel.TWO"
      ><div class="demo-page__hero">
        <UiAvatar
          :src="heroFace"
          name="Mira the Scout"
          :status="AvatarStatus.ONLINE"
          :size="AvatarSize.LG"
        />
        <div class="demo-page__hero-copy">
          <strong>Mira the Scout</strong
          ><UiBadge :tone="BadgeTone.ARCANE">Mist mage</UiBadge
          ><UiProgressBar
            :value="experience"
            label="Experience"
            :show-value="true"
            :tone="ProgressTone.ARCANE"
          /><input
            v-model.number="experience"
            class="demo-page__range"
            type="range"
            min="0"
            max="100"
            aria-label="Change experience"
          />
        </div></div></UiPanel
    ><UiPanel title="UiItemCard" :heading-level="PanelHeadingLevel.TWO"
      ><div class="demo-page__items">
        <UiItemCard
          name="Azure Scepter"
          description="Channels arcane energy."
          :rarity="ItemRarity.MAGIC"
          :selected="selectedItem === 'Azure Scepter'"
          @select="selectedItem = 'Azure Scepter'"
        /><UiItemCard
          name="Sunblade"
          description="A legendary quest weapon."
          :rarity="ItemRarity.LEGENDARY"
          :selected="selectedItem === 'Sunblade'"
          @select="selectedItem = 'Sunblade'"
        /><UiItemCard
          name="Forgotten Ring"
          description="A mythic relic."
          :rarity="ItemRarity.MYTHIC"
          :selected="selectedItem === 'Forgotten Ring'"
          @select="selectedItem = 'Forgotten Ring'"
        />
      </div>
      <p class="demo-page__selected">
        Selected item: <strong>{{ selectedItem }}</strong>
      </p></UiPanel
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
.demo-page > header p,
.demo-page__selected {
  color: var(--color-text-muted);
}
.demo-page__stats {
  display: grid;
  gap: var(--space-3);
  @include bp.from("md") {
    grid-template-columns: repeat(3, 1fr);
  }
}
.demo-page__hero {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
}
.demo-page__hero-copy {
  display: grid;
  width: min(100%, 30rem);
  gap: var(--space-3);
}
.demo-page__range {
  accent-color: var(--color-arcane);
}
.demo-page__items {
  display: grid;
  gap: var(--space-3);
  @include bp.from("md") {
    grid-template-columns: repeat(3, 1fr);
  }
}
.demo-page__selected {
  margin-top: var(--space-4);
}
</style>
