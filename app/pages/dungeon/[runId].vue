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
import {
  MOVE_COOLDOWN_MS,
  createCooldown,
  directionForKey,
} from "~/features/dungeon/dungeonRules";
import { SANDBOX_SEED } from "~/features/dungeon/seed";
import type { Direction, EnemyKindName, Position } from "~/features/dungeon/types";
import ChestLootModal from "~/features/reward/components/ChestLootModal.vue";
import { ButtonSize, ButtonVariant } from "~/shared/ui/ui.types";

// A run id change remounts the explorer after its in-flight work is invalidated.
definePageMeta({ layout: "game", key: (route) => route.fullPath });
useHead({ title: "Exploration" });

const route = useRoute();
const playerId = computed(() =>
  typeof route.query.playerId === "string" ? route.query.playerId : null,
);
const explorer = useDungeonExplorer(String(route.params.runId));
const {
  run,
  loaded,
  hero,
  appearance,
  status,
  errorMessage,
  announcement,
  bump,
  facing,
  revealed,
  revealVersion,
  visitedRoomIds,
  currentRoom,
  currentCorridor,
  floorBossDefeated,
  mobs,
  dyingMobs,
  openableChest,
  movementBlocked,
  chestLoot,
} = explorer;

const board = ref<HTMLElement | null>(null);
const viewport = useBoardViewport(board);
const copied = ref(false);
const isSandbox = computed(() => import.meta.dev && run.value?.seed === SANDBOX_SEED);
const MOB_KINDS: EnemyKindName[] = ["zombie", "bat", "goblin", "mage"];
const spawnKind = ref<EnemyKindName>("zombie");

onMounted(async () => {
  await explorer.start();
  await nextTick();
  board.value?.focus();
});

watch(
  () => String(route.params.runId),
  (nextRunId, previousRunId) => {
    if (nextRunId !== previousRunId) explorer.dispose();
  },
);
onBeforeUnmount(() => explorer.dispose());

const canMove = createCooldown(MOVE_COOLDOWN_MS);

/** One move per slide, from the keyboard as from the on-screen pad. */
function move(direction: Direction) {
  if (!movementBlocked.value && canMove()) explorer.move(direction);
}

function spawnAt(position: Position) {
  if (isSandbox.value && !movementBlocked.value) explorer.spawn(spawnKind.value, position);
}

function onKeydown(event: KeyboardEvent) {
  if (event.code === "KeyE") {
    event.preventDefault();
    if (!movementBlocked.value) explorer.openChest();
    return;
  }
  const direction = directionForKey(event.code);
  if (!direction) return;
  event.preventDefault();
  move(direction);
}

async function copyShareLink() {
  if (!run.value) return;
  const path = playerId.value
    ? `/players/${encodeURIComponent(playerId.value)}/play?seed=${encodeURIComponent(run.value.seed)}`
    : `/dungeon?seed=${encodeURIComponent(run.value.seed)}`;
  const url = `${window.location.origin}${path}`;
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
      <div
        ref="board"
        class="dungeon-page__board"
        role="application"
        aria-label="Dungeon"
        aria-describedby="dungeon-help"
        tabindex="0"
        @keydown="onKeydown"
      >
        <!-- NOSONAR -->
        <DungeonViewport
          :loaded="loaded"
          :hero="hero"
          :facing="facing"
          :appearance="appearance"
          :revealed="revealed"
          :reveal-version="revealVersion"
          :bump="bump"
          :viewport="viewport"
          :floor-boss-defeated="floorBossDefeated"
          :mobs="mobs"
          :dying-mobs="dyingMobs"
          :opened-chest-element-ids="run.openedChestElementIds"
          :openable-chest-element-id="openableChest?.id ?? null"
          @open-chest="explorer.openChest"
          @tile="spawnAt"
        />
      </div>

      <fieldset v-if="isSandbox" class="dungeon-page__panel dungeon-page__sandbox">
        <legend>Sandbox: click a tile to spawn</legend>
        <label v-for="kind in MOB_KINDS" :key="kind">
          <input
            v-model="spawnKind"
            type="radio"
            name="spawn-kind"
            :value="kind"
            @change="board?.focus()"
          />
          {{ kind }}
        </label>
      </fieldset>

      <header class="dungeon-page__panel dungeon-page__hud">
        <h1 class="dungeon-page__title">
          Floor {{ run.currentFloor + 1
          }}<span v-if="run.floorCount > 1"> / {{ run.floorCount }}</span>
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
          <UiButton
            :variant="ButtonVariant.GHOST"
            :size="ButtonSize.SM"
            @click="copyShareLink"
          >
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
          :current-corridor="currentCorridor ?? null"
        />
      </aside>

      <div class="dungeon-page__actions">
        <!-- A live status message, not a form field: it has nothing to label. -->
        <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -->
        <output
          v-if="run.status === 'won'"
          class="dungeon-page__panel dungeon-page__victory"
        >
          Victory! The final boss is defeated.
        </output>
        <p
          v-if="errorMessage"
          class="dungeon-page__panel dungeon-page__error"
          role="alert"
        >
          {{ errorMessage }}
        </p>
      </div>

      <DungeonControls
        class="dungeon-page__pad"
        :disabled="run.status !== 'active' || movementBlocked"
        @move="move"
      />

      <p id="dungeon-help" class="visually-hidden">
        Arrow keys, WASD or ZQSD to move, one tile per turn. Press E while standing on
        or next to a chest to open it. Walk into the boss of the floor to fight it; once
        it is defeated, walk into the gate behind it to go down.
      </p>
      <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>

      <ChestLootModal
        v-if="chestLoot"
        :interaction="chestLoot"
        @retry="explorer.retryChestLoot"
        @close="explorer.closeChestLoot"
      />
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
  &__sandbox {
    top: 50%;
    left: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    translate: 0 -50%;

    legend {
      float: left;
      margin-block-end: var(--space-2);
      font-size: var(--font-size-sm);
      font-weight: 600;
    }

    label {
      display: flex;
      gap: var(--space-2);
      text-transform: capitalize;
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
