<script setup lang="ts">
/**
 * The exploration screen. Client-rendered (ADR-FE-004): see routeRules.
 * Composes the dungeon feature; holds no rule of its own.
 */
import DungeonControls from "~/features/dungeon/components/DungeonControls.vue";
import DungeonMinimap from "~/features/dungeon/components/DungeonMinimap.vue";
import DungeonViewport from "~/features/dungeon/components/DungeonViewport.vue";
import { useBoardViewport } from "~/features/dungeon/composables/useBoardViewport";
import { useDungeonExplorer } from "~/features/dungeon/composables/useDungeonExplorer";
import { directionForKey } from "~/features/dungeon/dungeonRules";
import { ButtonSize, ButtonVariant } from "~/shared/ui/ui.types";

definePageMeta({ layout: "game" });
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

const board = ref<HTMLElement | null>(null);
const viewport = useBoardViewport(board);
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
      <!-- ADR-FE-015: documented gameplay exception. The board takes the
           arrow keys, so it is a focusable application region with
           instructions; on touch screens the same moves are buttons.
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

      <header class="dungeon-page__panel dungeon-page__hud">
        <h1 class="dungeon-page__title">
          Floor {{ run.currentFloor + 1 }}<span v-if="run.floorCount > 1"> / {{ run.floorCount }}</span>
        </h1>
        <dl class="dungeon-page__facts">
          <div>
            <dt>Turn</dt>
            <dd>{{ run.turn }}</dd>
          </div>
          <div>
            <dt>Rooms</dt>
            <dd>{{ visitedRoomIds.length }} / {{ loaded.floor.rooms.length }}</dd>
          </div>
        </dl>
        <div class="dungeon-page__links">
          <UiButton :variant="ButtonVariant.GHOST" :size="ButtonSize.SM" @click="copyShareLink">
            {{ copied ? "Link copied" : "Share" }}
          </UiButton>
          <NuxtLink to="/dungeon" class="dungeon-page__leave">Leave</NuxtLink>
        </div>
      </header>

      <aside class="dungeon-page__panel dungeon-page__map" aria-label="Map">
        <DungeonMinimap
          :rooms="loaded.floor.rooms"
          :visited-room-ids="visitedRoomIds"
          :current-room-id="currentRoom?.id ?? null"
        />
      </aside>

      <div class="dungeon-page__actions">
        <UiButton v-if="isOnStairsDown" @click="act(explorer.descend)">Take the stairs down</UiButton>
        <!-- Stand-in for Combat's fight: records the victory over the boss. -->
        <UiButton v-if="canFightBoss" @click="act(explorer.fightBoss)">Fight the boss</UiButton>
        <!-- A live status message, not a form field: it has nothing to label. -->
        <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -->
        <output v-if="run.status === 'won'" class="dungeon-page__panel dungeon-page__victory">
          Victory! The final boss is defeated.
        </output>
        <p v-if="errorMessage" class="dungeon-page__panel dungeon-page__error" role="alert">
          {{ errorMessage }}
        </p>
      </div>

      <DungeonControls
        class="dungeon-page__pad"
        :disabled="run.status !== 'active'"
        @move="explorer.move"
      />

      <p id="dungeon-help" class="visually-hidden">
        Arrow keys, WASD or ZQSD to move, one tile per turn. Defeat the boss of the floor to
        open the gate to the stairs, then Enter on the stairs to go down.
      </p>
      <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.dungeon-page {
  position: absolute;
  inset: 0;
  overflow: hidden;
  // The void of the tileset itself: the outer faces of the walls fade into it.
  background-color: #000f0d;

  &__board {
    position: absolute;
    inset: 0;
    overflow: hidden;

    &:focus-visible {
      outline: 3px solid var(--color-focus-ring);
      outline-offset: -3px;
    }
  }

  // Overlays float over the board, which stays visible around them.
  &__panel {
    position: absolute;
    z-index: var(--z-overlay);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background-color: color-mix(in srgb, var(--color-surface-raised) 82%, transparent);
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(4px);
  }

  &__hud {
    top: var(--space-4);
    left: var(--space-4);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3) var(--space-5);
    max-inline-size: calc(100% - 2 * var(--space-4));
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-lg);
    white-space: nowrap;
  }

  &__facts {
    display: flex;
    gap: var(--space-4);
    margin: 0;

    dt {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
    }

    dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
  }

  &__links {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  &__leave {
    font-size: var(--font-size-sm);
  }

  &__map {
    top: var(--space-4);
    right: var(--space-4);
    display: grid;
    place-items: center;
    min-inline-size: 7rem;
    min-block-size: 5rem;

    // On a narrow screen the HUD takes the top: the map goes below it.
    @media (max-width: 640px) {
      top: auto;
      bottom: var(--space-4);
      left: var(--space-4);
      right: auto;
    }
  }

  &__actions {
    position: absolute;
    z-index: var(--z-overlay);
    bottom: var(--space-6);
    left: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    translate: -50% 0;
    inline-size: max-content;
    max-inline-size: calc(100% - 2 * var(--space-4));

    > .dungeon-page__panel {
      position: static;
    }
  }

  &__victory {
    display: block;
    margin: 0;
    color: var(--color-accent);
    font-weight: 600;
  }

  &__error {
    margin: 0;
    color: var(--color-danger);
    font-size: var(--font-size-sm);
  }

  // The directional pad is for touch screens: with a mouse, the keyboard plays.
  &__pad {
    position: absolute;
    z-index: var(--z-overlay);
    right: var(--space-4);
    bottom: var(--space-4);

    @media (hover: hover) and (pointer: fine) {
      display: none;
    }
  }

  &__status {
    position: absolute;
    top: 50%;
    left: 50%;
    margin: 0;
    translate: -50% -50%;
    color: var(--color-text-muted);
  }
}
</style>
