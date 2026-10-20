/**
 * State of one exploration: the run, the displayed hero, the fog of war.
 *
 * Moves are PREDICTED (ADR-FE-008): the hero moves as soon as the key is
 * pressed if the tile is walkable, and the request follows. Requests are sent
 * one at a time, in order, because the game is turn-based. If the backend
 * refuses a move or the network fails, the queued moves are dropped and the
 * authoritative run is read again: the client never keeps a position the
 * backend did not accept.
 */
import { computed, ref, shallowRef, watch } from "vue";
import {
  defeatFloorBoss,
  fetchDungeonRun,
  generateChestLoot,
  moveHero,
} from "../api/dungeonApi";
import { CHEST_LOOT_DIFFICULTY } from "../chestLootConfig";
import type { DecodedFloor } from "../dungeonMap";
import {
  Cell,
  cellAt,
  corridorAt,
  elementsAt,
  goesDown,
  isWalkableAt,
  roomAt,
  step,
} from "../dungeonMap";
import { MOB_DEATH_MS, MOVE_COOLDOWN_MS, reveal } from "../dungeonRules";
import type {
  Direction,
  ChestLootInteraction,
  DungeonElement,
  DungeonRunResponse,
  MobState,
  Position,
} from "../types";
import { createIdempotencyKey } from "~/shared/utils/idempotency";
import type { LoadedFloor } from "./useDungeonFloor";
import { loadFloor, prefetchFloor } from "./useDungeonFloor";

/** Moves typed ahead of the server. Beyond it, key repeats are ignored. */
const MAX_PENDING_MOVES = 4;

export type ExplorerStatus = "loading" | "ready" | "error";

export function useDungeonExplorer(runId: string) {
  const run = shallowRef<DungeonRunResponse | null>(null);
  const loaded = shallowRef<LoadedFloor | null>(null);
  const hero = ref<Position>({ x: 0, y: 0 });
  const status = ref<ExplorerStatus>("loading");
  const errorMessage = ref<string | null>(null);
  const announcement = ref("");
  /** Changes identity on every refused key, so the view can replay its bump. */
  const bump = shallowRef<{ direction: Direction; id: number } | null>(null);
  /** Where the hero last tried to go: the view turns it that way. */
  const facing = ref<Direction>("south");
  const pendingMoves = ref(0);
  const pendingChestKey = ref<string | null>(null);
  const chestLoot = shallowRef<ChestLootInteraction | null>(null);
  const openedChestIds = ref<number[]>([]);

  // The fog lives in a typed array; the version counter is what Vue tracks.
  const revealed = shallowRef<Uint8Array>(new Uint8Array(0));
  const revealVersion = ref(0);
  const visitedRoomIds = ref<number[]>([]);

  let queue: Promise<void> = Promise.resolve();
  let generation = 0;
  let bumpCount = 0;
  let isFighting = false;
  let observedChestKey: string | null = null;
  let chestRequestGeneration = 0;
  let chestAbortController: AbortController | null = null;
  let disposed = false;

  const floor = computed<DecodedFloor | null>(() => loaded.value?.floor ?? null);
  const currentRoom = computed(() =>
    floor.value ? roomAt(floor.value, hero.value) : undefined,
  );
  /** The two rooms the corridor under the hero joins, for the minimap. */
  const currentCorridor = computed(() =>
    floor.value ? corridorAt(floor.value, hero.value) : undefined,
  );
  const floorBossDefeated = computed(() => run.value?.floorBossDefeated ?? false);
  /** Where the server last saw the mobs: they move on its turn, not on the prediction. */
  const mobs = computed(() => run.value?.mobs ?? []);
  /** Mobs the last turn killed: they slide to where they fell, then fade out. */
  const dyingMobs = shallowRef<MobState[]>([]);
  const movementBlocked = computed(
    () => disposed || pendingChestKey.value !== null || chestLoot.value !== null,
  );

  // The server dates each death: only a new turn brings new deaths to show.
  watch(
    run,
    (next, previous) => {
      if (!next || !previous || next.turn === previous.turn) return;
      const killed = next.killedMobs;
      if (killed.length === 0) return;
      dyingMobs.value = [...dyingMobs.value, ...killed];
      setTimeout(() => {
        dyingMobs.value = dyingMobs.value.filter((mob) => !killed.includes(mob));
      }, MOVE_COOLDOWN_MS + MOB_DEATH_MS);
    },
    { flush: "sync" },
  );
  /** In the boss room, boss still standing: the fight can start. */
  const canFightBoss = computed(
    () =>
      run.value?.status === "active" &&
      !floorBossDefeated.value &&
      currentRoom.value?.type === "boss",
  );

  async function start(): Promise<void> {
    disposed = false;
    status.value = "loading";
    errorMessage.value = null;
    try {
      const state = await fetchDungeonRun(runId);
      await enterFloor(state);
      if (disposed) return;
      status.value = "ready";
    } catch (error) {
      if (disposed) return;
      status.value = "error";
      errorMessage.value = describe(error);
    }
  }

  async function enterFloor(state: DungeonRunResponse): Promise<void> {
    const next = await loadFloor(state.seed, state.currentFloor);
    if (disposed) return;
    run.value = state;
    loaded.value = next;
    openedChestIds.value = [];
    revealed.value = new Uint8Array(next.floor.width * next.floor.height);
    visitedRoomIds.value = [];
    placeHero(state.hero);
    observeConfirmedChest(state.hero, state.currentFloor);

    if (state.currentFloor + 1 < state.floorCount) {
      prefetchFloor(state.seed, state.currentFloor + 1);
    }
  }

  function placeHero(position: Position): void {
    const current = floor.value;
    if (!current) return;

    const previousRoom = roomAt(current, hero.value);
    hero.value = position;
    if (reveal(current, revealed.value, position)) revealVersion.value++;

    const room = roomAt(current, position);
    if (room && !visitedRoomIds.value.includes(room.id)) {
      visitedRoomIds.value = [...visitedRoomIds.value, room.id];
    }
    if (room && room.id !== previousRoom?.id) {
      announce(describeRoom(current, room.id));
    }
  }

  function move(direction: Direction): void {
    const current = floor.value;
    const state = run.value;
    if (!current || state?.status !== "active") return;
    if (movementBlocked.value) return;
    if (pendingMoves.value >= MAX_PENDING_MOVES) return;
    if (dyingMobs.value.length > 0) return;

    facing.value = direction;
    const target = step(hero.value, direction);

    // Walking into the boss starts the fight; into the open gate, the way down.
    if (bossAt(current, target)) {
      void fightBoss();
      return;
    }
    if (goesDown(current, target, state.floorBossDefeated)) {
      void goDown(direction);
      return;
    }

    if (!isWalkableAt(current, target)) {
      // Same rule as the backend: no request for a move it would refuse.
      bump.value = { direction, id: ++bumpCount };
      const isGate = cellAt(current, target.x, target.y) === Cell.Gate;
      announce(
        isGate
          ? "The gate is locked: defeat the boss of this floor first."
          : "Blocked.",
      );
      return;
    }

    // Same rule as the backend: a mob blocks the way.
    if (mobs.value.some((mob) => samePosition(mob, target))) {
      bump.value = { direction, id: ++bumpCount };
      announce("A mob blocks the way.");
      return;
    }

    const here = elementsAt(current, target);
    const chest = here.find((element) => element.type === "item");
    const queuedChestKey = chest ? chestKey(state.currentFloor, chest.id) : null;
    if (queuedChestKey) pendingChestKey.value = queuedChestKey;
    placeHero(target);
    if (here.length > 0)
      announce(`On this tile: ${here.map((e) => e.type).join(", ")}.`);

    pendingMoves.value++;
    const moveGeneration = generation;
    queue = queue.then(async () => {
      try {
        if (moveGeneration !== generation) return;
        const updated = await moveHero(runId, direction);
        if (disposed || moveGeneration !== generation) return;
        run.value = updated;
        const isLastPending = pendingMoves.value === 1;
        if (isLastPending && !samePosition(updated.hero, hero.value)) {
          placeHero(updated.hero);
        }
        if (chest && samePosition(updated.hero, target)) {
          beginChestInteraction(chest, updated.currentFloor);
        } else {
          observeConfirmedChest(updated.hero, updated.currentFloor);
        }
      } catch (error) {
        await resynchronise(error);
      } finally {
        if (queuedChestKey && pendingChestKey.value === queuedChestKey) {
          pendingChestKey.value = null;
        }
        pendingMoves.value--;
      }
    });
  }

  /** The boss still standing on a tile, if any. */
  function bossAt(current: DecodedFloor, position: Position): boolean {
    return (
      !floorBossDefeated.value &&
      elementsAt(current, position).some((element) => element.type === "boss")
    );
  }

  /** Through the open gate: the next floor, down the ladder in the middle of its start room. */
  async function goDown(direction: Direction): Promise<void> {
    const moveGeneration = generation;
    pendingMoves.value++;
    try {
      await queue;
      if (moveGeneration !== generation) return;
      const updated = await moveHero(runId, direction);
      if (disposed || moveGeneration !== generation) return;
      await enterFloor(updated);
      announce(`Floor ${updated.currentFloor + 1} of ${updated.floorCount}.`);
    } catch (error) {
      await resynchronise(error);
    } finally {
      pendingMoves.value--;
    }
  }

  /**
   * Stands in for the fight until Combat exists: walking into the boss records its
   * defeat, which opens the gate down, or wins the run on the last floor.
   */
  async function fightBoss(): Promise<void> {
    if (!canFightBoss.value || isFighting) return;
    isFighting = true;
    const moveGeneration = generation;
    await queue;
    if (moveGeneration !== generation) {
      isFighting = false;
      return;
    }
    try {
      const updated = await defeatFloorBoss(runId);
      if (disposed || moveGeneration !== generation) return;
      run.value = updated;
      announce(
        updated.status === "won"
          ? "Victory! The final boss is defeated."
          : "The boss is defeated: the gate down is open.",
      );
    } catch (error) {
      await resynchronise(error);
    } finally {
      isFighting = false;
    }
  }

  /** The backend refused or the outcome is unknown: its state wins (ADR-FE-008). */
  async function resynchronise(error: unknown): Promise<void> {
    if (disposed) return;
    generation++;
    errorMessage.value = describe(error);
    try {
      const authoritative = await fetchDungeonRun(runId);
      if (authoritative.currentFloor !== run.value?.currentFloor) {
        await enterFloor(authoritative);
      } else {
        run.value = authoritative;
        placeHero(authoritative.hero);
        observeConfirmedChest(authoritative.hero, authoritative.currentFloor);
      }
    } catch (refreshError) {
      errorMessage.value = describe(refreshError);
    }
  }

  function announce(message: string): void {
    // Re-announce identical messages: screen readers ignore unchanged text.
    announcement.value = "";
    queueMicrotask(() => (announcement.value = message));
  }

  /** Starts one idempotent Reward interaction for a confirmed chest position. */
  function beginChestInteraction(chest: DungeonElement, floorIndex: number): void {
    const key = chestKey(floorIndex, chest.id);
    if (
      disposed ||
      !Number.isInteger(chest.id) ||
      chest.id < 0 ||
      chestLoot.value ||
      observedChestKey === key
    )
      return;
    observedChestKey = key;
    const interaction: ChestLootInteraction = {
      commandId: createIdempotencyKey(),
      chestElementId: chest.id,
      floor: floorIndex + 1,
      status: "loading",
      result: null,
      errorMessage: null,
    };
    chestLoot.value = interaction;
    void requestChestLoot(interaction);
  }

  /** Tracks leaving a chest so stepping back onto it creates a fresh interaction. */
  function observeConfirmedChest(position: Position, floorIndex: number): void {
    const current = floor.value;
    if (!current) return;
    const chest = elementsAt(current, position).find(
      (element) => element.type === "item",
    );
    if (chest) beginChestInteraction(chest, floorIndex);
    else observedChestKey = null;
  }

  /** Sends or retries the active interaction without changing its command id. */
  async function requestChestLoot(interaction: ChestLootInteraction): Promise<void> {
    const requestGeneration = ++chestRequestGeneration;
    chestAbortController?.abort();
    const controller = new AbortController();
    chestAbortController = controller;
    try {
      const result = await generateChestLoot(
        {
          commandId: interaction.commandId,
          dungeonRunId: runId,
          chestElementId: interaction.chestElementId,
          floor: interaction.floor,
          difficulty: CHEST_LOOT_DIFFICULTY,
        },
        controller.signal,
      );
      if (!isCurrentChestRequest(interaction, requestGeneration)) return;
      if (!openedChestIds.value.includes(interaction.chestElementId)) {
        openedChestIds.value = [...openedChestIds.value, interaction.chestElementId];
      }
      chestLoot.value = {
        ...interaction,
        status: "success",
        result,
        errorMessage: null,
      };
      announce(result.alreadyGenerated ? "Chest loot recalled." : "Chest opened.");
    } catch (error) {
      if (!isCurrentChestRequest(interaction, requestGeneration)) return;
      chestLoot.value = {
        ...interaction,
        status: "error",
        result: null,
        errorMessage: describe(error),
      };
    }
  }

  function isCurrentChestRequest(
    interaction: ChestLootInteraction,
    requestGeneration: number,
  ): boolean {
    return (
      !disposed &&
      requestGeneration === chestRequestGeneration &&
      chestLoot.value?.commandId === interaction.commandId
    );
  }

  function retryChestLoot(): void {
    const interaction = chestLoot.value;
    if (!interaction || interaction.status !== "error") return;
    const loading = { ...interaction, status: "loading" as const, errorMessage: null };
    chestLoot.value = loading;
    void requestChestLoot(loading);
  }

  function closeChestLoot(): void {
    if (!chestLoot.value) return;
    chestRequestGeneration++;
    chestAbortController?.abort();
    chestAbortController = null;
    chestLoot.value = null;
  }

  /** Invalidates every in-flight response when the page is left or changes run. */
  function dispose(): void {
    disposed = true;
    generation++;
    pendingChestKey.value = null;
    closeChestLoot();
  }

  return {
    run,
    loaded,
    floor,
    hero,
    status,
    errorMessage,
    announcement,
    bump,
    facing,
    pendingMoves,
    pendingChestKey,
    movementBlocked,
    chestLoot,
    openedChestIds,
    revealed,
    revealVersion,
    visitedRoomIds,
    currentRoom,
    currentCorridor,
    floorBossDefeated,
    mobs,
    dyingMobs,
    canFightBoss,
    start,
    move,
    fightBoss,
    retryChestLoot,
    closeChestLoot,
    dispose,
  };
}

function chestKey(floorIndex: number, chestElementId: number): string {
  return `${floorIndex}:${chestElementId}`;
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function describeRoom(floor: DecodedFloor, roomId: number): string {
  const room = floor.rooms[roomId]!;
  const count = (type: DungeonElement["type"]) =>
    floor.elements.filter(
      (element) => element.roomId === roomId && element.type === type,
    ).length;
  const traps = count("trap");
  const details = [
    room.type === "combat" ? `${count("enemy")} enemies` : null,
    traps > 0 ? `beware of ${traps} spike traps` : null,
    room.type === "boss" ? describeBoss(floor) : null,
    room.type === "treasure" ? "a treasure lies here" : null,
  ].filter(Boolean);

  const title = `Room ${room.id + 1} of ${floor.rooms.length}`;
  return details.length ? `${title}: ${details.join(", ")}.` : `${title}.`;
}

function describeBoss(floor: DecodedFloor): string {
  return floor.isFinalFloor ? "the final boss awaits" : "its boss guards the gate down";
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}
