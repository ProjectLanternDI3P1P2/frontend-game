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
import { computed, ref, shallowRef } from "vue";
import { defeatFloorBoss, fetchDungeonRun, moveHero, takeStairsDown } from "../api/dungeonApi";
import type { DecodedFloor } from "../dungeonMap";
import { canEnter, Cell, cellAt, elementsAt, roomAt, step } from "../dungeonMap";
import { reveal } from "../dungeonRules";
import type { Direction, DungeonElement, DungeonRunResponse, Position } from "../types";
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
  const pendingMoves = ref(0);

  // The fog lives in a typed array; the version counter is what Vue tracks.
  const revealed = shallowRef<Uint8Array>(new Uint8Array(0));
  const revealVersion = ref(0);
  const visitedRoomIds = ref<number[]>([]);

  let queue: Promise<void> = Promise.resolve();
  let generation = 0;
  let bumpCount = 0;

  const floor = computed<DecodedFloor | null>(() => loaded.value?.floor ?? null);
  const currentRoom = computed(() =>
    floor.value ? roomAt(floor.value, hero.value) : undefined,
  );
  const isOnStairsDown = computed(
    () =>
      !!floor.value &&
      cellAt(floor.value, hero.value.x, hero.value.y) === Cell.StairsDown,
  );
  const floorBossDefeated = computed(() => run.value?.floorBossDefeated ?? false);
  /** In the boss room, boss still standing: the fight can start. */
  const canFightBoss = computed(
    () =>
      run.value?.status === "active" &&
      !floorBossDefeated.value &&
      currentRoom.value?.type === "boss",
  );

  async function start(): Promise<void> {
    status.value = "loading";
    errorMessage.value = null;
    try {
      const state = await fetchDungeonRun(runId);
      await enterFloor(state);
      status.value = "ready";
    } catch (error) {
      status.value = "error";
      errorMessage.value = describe(error);
    }
  }

  async function enterFloor(state: DungeonRunResponse): Promise<void> {
    const next = await loadFloor(state.seed, state.currentFloor);
    run.value = state;
    loaded.value = next;
    revealed.value = new Uint8Array(next.floor.width * next.floor.height);
    visitedRoomIds.value = [];
    placeHero(state.hero);

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
    if (!current || !state || state.status !== "active") return;
    if (pendingMoves.value >= MAX_PENDING_MOVES) return;

    const target = step(hero.value, direction);
    if (!canEnter(current, target, state.floorBossDefeated)) {
      // Same rule as the backend: no request for a move it would refuse.
      bump.value = { direction, id: ++bumpCount };
      const isGate = cellAt(current, target.x, target.y) === Cell.Gate;
      announce(isGate ? "The gate is locked: defeat the boss of this floor first." : "Blocked.");
      return;
    }

    placeHero(target);
    const here = elementsAt(current, target);
    if (here.length > 0) announce(`On this tile: ${here.map((e) => e.type).join(", ")}.`);

    pendingMoves.value++;
    const moveGeneration = generation;
    queue = queue.then(async () => {
      try {
        if (moveGeneration !== generation) return;
        const updated = await moveHero(runId, direction);
        run.value = updated;
        const isLastPending = pendingMoves.value === 1;
        if (isLastPending && !samePosition(updated.hero, hero.value)) {
          placeHero(updated.hero);
        }
      } catch (error) {
        await resynchronise(error);
      } finally {
        pendingMoves.value--;
      }
    });
  }

  async function descend(): Promise<void> {
    if (!isOnStairsDown.value) return;
    const moveGeneration = generation;
    await queue;
    if (moveGeneration !== generation) return;
    try {
      const updated = await takeStairsDown(runId);
      await enterFloor(updated);
      announce(`Floor ${updated.currentFloor + 1} of ${updated.floorCount}.`);
    } catch (error) {
      await resynchronise(error);
    }
  }

  /**
   * Stands in for the fight until Combat exists: records the boss's defeat,
   * which opens the gate to the stairs, or wins the run on the last floor.
   */
  async function fightBoss(): Promise<void> {
    if (!canFightBoss.value) return;
    const moveGeneration = generation;
    await queue;
    if (moveGeneration !== generation) return;
    try {
      const updated = await defeatFloorBoss(runId);
      run.value = updated;
      announce(
        updated.status === "won"
          ? "Victory! The final boss is defeated."
          : "The boss is defeated: the gate to the stairs is open.",
      );
    } catch (error) {
      await resynchronise(error);
    }
  }

  /** The backend refused or the outcome is unknown: its state wins (ADR-FE-008). */
  async function resynchronise(error: unknown): Promise<void> {
    generation++;
    errorMessage.value = describe(error);
    try {
      const authoritative = await fetchDungeonRun(runId);
      if (authoritative.currentFloor !== run.value?.currentFloor) {
        await enterFloor(authoritative);
      } else {
        run.value = authoritative;
        placeHero(authoritative.hero);
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

  return {
    run,
    loaded,
    floor,
    hero,
    status,
    errorMessage,
    announcement,
    bump,
    pendingMoves,
    revealed,
    revealVersion,
    visitedRoomIds,
    currentRoom,
    isOnStairsDown,
    floorBossDefeated,
    canFightBoss,
    start,
    move,
    descend,
    fightBoss,
  };
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function describeRoom(floor: DecodedFloor, roomId: number): string {
  const room = floor.rooms[roomId]!;
  const count = (type: DungeonElement["type"]) =>
    floor.elements.filter((element) => element.roomId === roomId && element.type === type)
      .length;
  const traps = count("trap");
  const details = [
    room.type === "combat" ? `${count("enemy")} enemies` : null,
    traps > 0 ? `beware of ${traps} spike traps` : null,
    room.type === "boss"
      ? floor.isFinalFloor
        ? "the final boss awaits"
        : "its boss guards the gate to the stairs"
      : null,
    room.type === "stairs" ? "stairs lead down" : null,
    room.type === "treasure" ? "a treasure lies here" : null,
  ].filter(Boolean);

  return `Room ${room.id + 1} of ${floor.rooms.length}${details.length ? `: ${details.join(", ")}` : ""}.`;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}
