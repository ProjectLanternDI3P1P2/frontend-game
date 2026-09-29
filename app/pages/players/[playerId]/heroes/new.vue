<script setup lang="ts">
import { ButtonType, ButtonVariant } from "~/shared/ui/UiButton.vue";
import { NoticeTone } from "~/shared/ui/UiNotice.vue";
import { PanelVariant } from "~/shared/ui/UiPanel.vue";
import { GatewayError } from "~/shared/utils/gateway";
import { createIdempotencyKey } from "~/shared/utils/idempotency";
import { HERO_CLASS_OPTIONS, type HeroClassCode } from "~/features/player/types";
import { usePlayerApi } from "~/features/player/api/playerApi";

const route = useRoute();
const router = useRouter();
const playerId = computed(() => String(route.params.playerId));
const name = ref("");
const classCode = ref<HeroClassCode>("warrior");
const error = ref("");
const submitting = ref(false);
let idempotencyKey: string | null = null;

async function submit() {
  error.value = "";
  if (!name.value.trim()) {
    error.value = "Enter a hero name.";
    return;
  }
  submitting.value = true;
  idempotencyKey ??= createIdempotencyKey();
  try {
    const hero = await usePlayerApi().createHero(playerId.value, {
      name: name.value.trim(), classCode: classCode.value, idempotencyKey,
    });
    await router.push(`/players/${encodeURIComponent(playerId.value)}/heroes/${hero.id}`);
  } catch (cause) {
    error.value = cause instanceof GatewayError ? cause.message : "Unable to create this hero.";
  } finally { submitting.value = false; }
}
</script>

<template>
  <main class="hero-creation">
    <header><p class="eyebrow">Heroes · New</p><h1>Create a hero</h1></header>
    <UiNotice v-if="error" :tone="NoticeTone.DANGER">{{ error }}</UiNotice>
    <div class="hero-creation__grid">
      <UiPanel title="Choose your hero">
        <form @submit.prevent="submit">
          <UiInput id="hero-name" v-model="name" label="Hero name" :error="error" required autocomplete="off" />
          <fieldset><legend>Class</legend><div class="classes">
            <button v-for="heroClass in HERO_CLASS_OPTIONS" :key="heroClass.code" type="button" class="class-card" :class="{ 'class-card--selected': classCode === heroClass.code }" :aria-pressed="classCode === heroClass.code" @click="classCode = heroClass.code">
              <strong>{{ heroClass.label }}</strong><span>Base health: {{ heroClass.baseHealth }}</span>
            </button>
          </div></fieldset>
          <UiButton :type="ButtonType.SUBMIT" :variant="ButtonVariant.PRIMARY" :busy="submitting">Confirm</UiButton>
        </form>
      </UiPanel>
      <UiPanel title="Preview" :variant="PanelVariant.INSET"><p class="preview-name">{{ name || "Unnamed hero" }}</p><p>{{ classCode }}</p><p>Level 1 · first ability unlocked</p></UiPanel>
    </div>
  </main>
</template>

<style scoped lang="scss">
.hero-creation {
  display: grid;
  gap: var(--space-5);
  max-width: var(--layout-max-width);
  margin: 0 auto;
  padding: var(--space-7) var(--layout-gutter);
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--color-text-highlight);
  font-size: var(--font-size-sm);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 { margin: 0; color: var(--color-text-primary); font-family: var(--font-family-display); }
.hero-creation__grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.45fr); gap: var(--space-5); }
form, fieldset { display: grid; gap: var(--space-4); }
fieldset { border: 0; padding: 0; }
legend { color: var(--color-text-highlight); font-weight: var(--font-weight-bold); }
.classes { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: var(--space-3); }
.class-card { display: grid; gap: var(--space-2); padding: var(--space-4); border: 1px solid var(--color-border-subtle); background: var(--color-surface-base); color: var(--color-text-primary); cursor: pointer; text-align: left; }
.class-card--selected { border-color: var(--color-accent); box-shadow: var(--shadow-gold); }
.class-card span { color: var(--color-text-muted); font-size: var(--font-size-sm); }
.preview-name { margin: 0; color: var(--color-text-highlight); font-family: var(--font-family-display); font-size: var(--font-size-xl); }
@media (max-width: 48rem) { .hero-creation__grid { grid-template-columns: 1fr; } }
</style>
