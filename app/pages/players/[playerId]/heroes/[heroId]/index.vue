<script setup lang="ts">
import { ButtonVariant } from "~/shared/ui/UiButton.vue";
import { BadgeTone } from "~/shared/ui/UiBadge.vue";
import { NoticeTone } from "~/shared/ui/UiNotice.vue";
import { PanelVariant } from "~/shared/ui/UiPanel.vue";
import { GatewayError } from "~/shared/utils/gateway";
import { usePlayerApi } from "~/features/player/api/playerApi";
import type { HeroSheet } from "~/features/player/types";

const route = useRoute();
const playerId = computed(() => String(route.params.playerId));
const heroId = computed(() => String(route.params.heroId));
const hero = ref<HeroSheet | null>(null);
const loading = ref(true);
const error = ref("");
async function load() {
  loading.value = true;
  error.value = "";
  try {
    hero.value = await usePlayerApi().getHeroSheet(playerId.value, heroId.value);
  } catch (cause) {
    error.value =
      cause instanceof GatewayError ? cause.message : "Unable to load this hero.";
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>

<template>
  <main class="hero-sheet">
    <NuxtLink class="back" :to="`/players/${encodeURIComponent(playerId)}/heroes`"
      >← Back to my heroes</NuxtLink
    >
    <UiNotice v-if="error" :tone="NoticeTone.DANGER"
      >{{ error }}
      <UiButton :variant="ButtonVariant.GHOST" @click="load">Retry</UiButton></UiNotice
    >
    <UiNotice v-else-if="loading" :tone="NoticeTone.INFO">Loading hero sheet…</UiNotice>
    <template v-else-if="hero"
      ><header>
        <p class="eyebrow">Hero sheet</p>
        <h1>{{ hero.name }}</h1>
        <UiBadge :tone="BadgeTone.ARCANE">{{ hero.classCode }}</UiBadge>
      </header>
      <div class="hero-sheet__grid">
        <UiPanel title="Identity"
          ><dl>
            <div>
              <dt>Level</dt>
              <dd>{{ hero.level }}</dd>
            </div>
            <div>
              <dt>Maximum health</dt>
              <dd>{{ hero.maximumHealth }} HP</dd>
            </div>
          </dl></UiPanel
        >
        <UiPanel title="Base attributes"
          ><dl>
            <div v-for="(value, label) in hero.attributes" :key="label">
              <dt>{{ label }}</dt>
              <dd>{{ value }}</dd>
            </div>
          </dl></UiPanel
        >
        <UiPanel title="Abilities"
          ><ul v-if="hero.abilities.length">
            <li v-for="ability in hero.abilities" :key="ability.code">
              <strong>{{ ability.label }}</strong
              ><span>{{ ability.targetingType }}</span>
            </li>
          </ul>
          <p v-else>No ability is available.</p></UiPanel
        >
        <UiPanel title="Equipment and inventory" :variant="PanelVariant.INSET"
          ><UiNotice :tone="NoticeTone.INFO"
            >Managed by Rewards. The Player details above remain available while that
            service is unavailable.</UiNotice
          ></UiPanel
        >
      </div>
    </template>
  </main>
</template>

<style scoped lang="scss">
.hero-sheet {
  display: grid;
  gap: var(--space-5);
  max-width: var(--layout-max-width);
  margin: 0 auto;
  padding: var(--space-7) var(--layout-gutter);
}
.back {
  color: var(--color-text-highlight);
}
header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.eyebrow {
  width: 100%;
  margin: 0;
  color: var(--color-text-highlight);
  font-size: var(--font-size-sm);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
h1 {
  min-width: 0;
  margin: 0;
  color: var(--color-text-primary);
  font-family: var(--font-family-display);
  overflow-wrap: anywhere;
}
.hero-sheet__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
}
dl {
  display: grid;
  gap: var(--space-3);
  margin: 0;
}
dl div,
li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}
dt,
li span {
  color: var(--color-text-muted);
}
dt {
  text-transform: capitalize;
}
dd {
  margin: 0;
  color: var(--color-text-primary);
  font-weight: var(--font-weight-bold);
}
ul {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  border-bottom: 1px solid var(--color-border-subtle);
  padding-bottom: var(--space-3);
}
@media (max-width: 48rem) {
  .hero-sheet__grid {
    grid-template-columns: 1fr;
  }
}
</style>
