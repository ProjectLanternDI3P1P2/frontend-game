<script setup lang="ts">
/**
 * Opens a fight without a dungeon: pick an encounter and a party, then play it.
 * In the target flow the dungeon opens the fight when the party walks into a pack or
 * the boss; this screen stays useful to test and balance the fight on its own.
 */
import { startFight } from "~/features/combat/api/combatApi";
import type { MonsterClass } from "~/features/combat/types";
import { ButtonType } from "~/shared/ui/ui.types";

definePageMeta({ layout: "game" });
useHead({ title: "Fight" });

/**
 * The heroes Combat serves while the Player contract is not plugged in
 * (combat-backend MockHeroCatalog): fixed ids for reproducible tests.
 */
const MOCK_HEROES = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Aldric", role: "Warrior" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Lyra", role: "Mage" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Kael", role: "Rogue, wounded" },
];

const ENCOUNTERS: { value: MonsterClass; label: string }[] = [
  { value: "Ordinary", label: "A pack of monsters" },
  { value: "SubBoss", label: "A sub-boss" },
  { value: "Boss", label: "The boss of the floor" },
];

const route = useRoute();
const encounter = ref<MonsterClass>(
  ENCOUNTERS.some((e) => e.value === route.query.encounter)
    ? (route.query.encounter as MonsterClass)
    : "Ordinary",
);
const floor = ref(Number(route.query.floor) || 1);
const party = ref<string[]>(MOCK_HEROES.map((hero) => hero.id));
const starting = ref(false);
const error = ref<string | null>(null);

async function start() {
  if (party.value.length === 0) return;
  starting.value = true;
  error.value = null;
  try {
    const fight = await startFight({
      dungeonRunId:
        typeof route.query.runId === "string" ? route.query.runId : crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      floor: floor.value,
      encounter: encounter.value,
      heroIds: party.value,
      monsterCount: Number(route.query.monsters) || undefined,
    });
    // Replaced, so that "back" never opens a second fight from this launcher.
    await navigateTo(
      { path: `/combat/${fight.fightId}`, query: { returnTo: route.query.returnTo } },
      { replace: isFromDungeon },
    );
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "The fight could not start.";
  } finally {
    starting.value = false;
  }
}

/** Sent by the dungeon (`auto=1`): the party is already chosen, the fight starts at once. */
const isFromDungeon = route.query.auto === "1";
onMounted(() => {
  if (isFromDungeon) void start();
});
</script>

<template>
  <div class="combat-launcher">
    <p v-if="isFromDungeon && !error" class="combat-launcher__card" role="status">
      Monsters attack!
    </p>
    <form v-else class="combat-launcher__card" @submit.prevent="start">
      <h1>To arms!</h1>

      <fieldset>
        <legend>Encounter</legend>
        <label v-for="option in ENCOUNTERS" :key="option.value">
          <input v-model="encounter" type="radio" name="encounter" :value="option.value" />
          {{ option.label }}
        </label>
      </fieldset>

      <fieldset>
        <legend>Party</legend>
        <label v-for="hero in MOCK_HEROES" :key="hero.id">
          <input v-model="party" type="checkbox" :value="hero.id" />
          {{ hero.name }} <small>— {{ hero.role }}</small>
        </label>
      </fieldset>

      <label class="combat-launcher__floor">
        Floor
        <input v-model.number="floor" type="number" min="1" max="40" />
      </label>

      <p v-if="error" class="combat-launcher__error" role="alert">{{ error }}</p>

      <UiButton :type="ButtonType.SUBMIT" :busy="starting" :disabled="party.length === 0">Fight</UiButton>
    </form>
  </div>
</template>

<style scoped lang="scss">
.combat-launcher {
  display: grid;
  place-items: center;
  block-size: 100%;
  padding: var(--space-4);
  background: radial-gradient(circle at 50% 30%, var(--palette-obsidian-600), var(--palette-obsidian-900));

  &__card {
    display: grid;
    gap: var(--space-4);
    inline-size: min(26rem, 100%);
    padding: var(--space-6);
    border: 3px solid var(--palette-parchment-700);
    border-radius: 18px;
    background: var(--palette-parchment-300);
    color: var(--palette-charcoal-700);
    font-family: var(--font-family-display);

    h1 {
      margin: 0;
      color: var(--palette-blood-600);
      text-align: center;
    }

    fieldset {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding: var(--space-3);
      border: 1px solid var(--palette-parchment-700);
      border-radius: var(--radius-md);
    }

    legend {
      padding: 0 var(--space-1);
      font-weight: 700;
    }
  }

  &__floor {
    display: flex;
    align-items: center;
    gap: var(--space-3);

    input {
      inline-size: 5rem;
    }
  }

  &__error {
    margin: 0;
    color: var(--palette-blood-600);
    font-size: var(--font-size-sm);
  }
}
</style>
