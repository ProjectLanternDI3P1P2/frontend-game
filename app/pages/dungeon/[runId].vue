<script setup lang="ts">
/**
 * The exploration screen. Client-rendered (ADR-FE-004): see routeRules.
 * Composes the dungeon feature; holds no rule of its own.
 */
import DungeonControls from "~/features/dungeon/components/DungeonControls.vue";
import DungeonMinimap from "~/features/dungeon/components/DungeonMinimap.vue";
import DungeonViewport from "~/features/dungeon/components/DungeonViewport.vue";
import { useDungeonExplorer } from "~/features/dungeon/composables/useDungeonExplorer";
import { directionForKey } from "~/features/dungeon/dungeonRules";
import { ButtonVariant } from "~/shared/ui/ui.types";

useHead({ title: "Exploration" });

const route = useRoute();
const explorer = useDungeonExplorer(String(route.params.runId));
const {
  run,
  loaded,
  hero,
  status,
  errorMessage,
  announcement,
  bump,
  revealed,
  revealVersion,
  visitedRoomIds,
  currentRoom,
  isOnStairsDown,
  floorBossDefeated,
  canFightBoss,
} = explorer;

/** Odd sizes keep the hero on the centre tile. */
const viewport = { columns: 17, rows: 13 };
const board = ref<HTMLElement | null>(null);
const copied = ref(false);

onMounted(async () => {
  await explorer.start();
  await nextTick();
  board.value?.focus();
});

function onKeydown(event: KeyboardEvent) {
  if (event.code === "Enter" && isOnStairsDown.value) {
    event.preventDefault();
    void explorer.descend();
    return;
  }

  const direction = directionForKey(event.code);
  if (!direction) return;
  event.preventDefault();
  explorer.move(direction);
}

/** Buttons take the focus: give it back to the board, so the keys keep working. */
async function act(action: () => Promise<void>) {
  await action();
  await nextTick();
  board.value?.focus();
}

async function copyShareLink() {
  if (!run.value) return;
  const url = `${window.location.origin}/dungeon?seed=${run.value.seed}`;
  await navigator.clipboard.writeText(url);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}
</script>

<template>
  <div class="dungeon-page">
    <p v-if="status === 'loading'" class="dungeon-page__status">Opening the dungeon…</p>

    <p v-else-if="status === 'error'" class="dungeon-page__status" role="alert">
      The dungeon could not be loaded: {{ errorMessage }}
    </p>

    <template v-else-if="loaded && run">
      <header class="dungeon-page__hud">
        <h1 class="dungeon-page__title">
          Floor {{ run.currentFloor + 1 }}<span v-if="run.floorCount > 1"> / {{ run.floorCount }}</span>
        </h1>
        <dl class="dungeon-page__facts">
          <div>
            <dt>Seed</dt>
            <dd class="dungeon-page__seed">{{ run.seed }}</dd>
          </div>
          <div>
            <dt>Turn</dt>
            <dd>{{ run.turn }}</dd>
          </div>
          <div>
            <dt>Rooms</dt>
            <dd>{{ visitedRoomIds.length }} / {{ loaded.floor.rooms.length }}</dd>
          </div>
        </dl>
        <UiButton :variant="ButtonVariant.GHOST" @click="copyShareLink">
          {{ copied ? "Link copied" : "Share this dungeon" }}
        </UiButton>
      </header>

      <div class="dungeon-page__stage">
        <!-- ADR-FE-015: documented gameplay exception. The board takes the
             arrow keys, so it is a focusable application region with
             instructions; the same moves are available as buttons.
             WAI-ARIA makes `application` a focusable widget, which Sonar's
             tabindex rule (Web:S6845) does not know: hence the NOSONAR. -->
        <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
        <div ref="board" class="dungeon-page__board" role="application" aria-label="Dungeon" aria-describedby="dungeon-help" tabindex="0" @keydown="onKeydown"> <!-- NOSONAR -->
          <DungeonViewport
            :loaded="loaded"
            :hero="hero"
            :revealed="revealed"
            :reveal-version="revealVersion"
            :bump="bump"
            :viewport="viewport"
            :floor-boss-defeated="floorBossDefeated"
          />
        </div>

        <aside class="dungeon-page__side">
          <DungeonMinimap
            :rooms="loaded.floor.rooms"
            :visited-room-ids="visitedRoomIds"
            :current-room-id="currentRoom?.id ?? null"
          />
          <DungeonControls :disabled="run.status !== 'active'" @move="explorer.move" />
          <UiButton v-if="isOnStairsDown" @click="act(explorer.descend)">Take the stairs down</UiButton>
          <!-- Stand-in for Combat's fight: records the victory over the boss. -->
          <UiButton v-if="canFightBoss" @click="act(explorer.fightBoss)">Fight the boss</UiButton>
          <!-- A live status message, not a form field: it has nothing to label. -->
          <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -->
          <output v-if="run.status === 'won'" class="dungeon-page__victory">
            Victory! The final boss is defeated.
          </output>
          <p id="dungeon-help" class="dungeon-page__help">
            Arrow keys, WASD or ZQSD to move, one tile per turn. Defeat the boss of the floor to
            open the gate to the stairs, then Enter on the stairs to go down.
          </p>
        </aside>
      </div>

      <p v-if="errorMessage" class="dungeon-page__status" role="alert">{{ errorMessage }}</p>
      <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.dungeon-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);

  &__hud {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-6);
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-xl);
  }

  &__facts {
    display: flex;
    gap: var(--space-5);
    margin: 0;

    dt {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
    }

    dd {
      margin: 0;
    }
  }

  &__seed {
    font-family: var(--font-family-mono);
  }

  &__stage {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
    align-items: flex-start;
  }

  &__board {
    border-radius: var(--radius-md);

    &:focus-visible {
      outline: 3px solid var(--color-focus-ring);
      outline-offset: 3px;
    }
  }

  &__side {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    max-inline-size: 14rem;
  }

  &__victory {
    display: block;
    margin: 0;
    color: var(--color-accent);
    font-weight: 600;
  }

  &__help,
  &__status {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }
}
</style>
