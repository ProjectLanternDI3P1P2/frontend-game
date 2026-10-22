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
import { defeatFloorBoss, joinDungeon, moveHero } from "../api/dungeonApi";
import type { DecodedFloor } from "../dungeonMap";
import {
  Cell,
  cellAt,
  corridorAt,
  decodeVisitedTiles,
  elementsAt,
  goesDown,
  isWalkableAt,
  roomAt,
  step,
} from "../dungeonMap";
import { MOB_DEATH_MS, MOVE_COOLDOWN_MS, reveal } from "../dungeonRules";
import { heroAppearanceOf } from "../tiles/hero";
import type {
  Direction,
  DungeonElement,
  DungeonRunResponse,
  MobState,
  Position,
} from "../types";
import type { LoadedFloor } from "./useDungeonFloor";
import { loadFloor, prefetchFloor } from "./useDungeonFloor";

/** Moves typed ahead of the server. Beyond it, key repeats are ignored. */
const MAX_PENDING_MOVES = 4;

export type ExplorerStatus = "loading" | "ready" | "error";

/** The most monsters Combat puts in one fight (its `Fight:MaxMonsters`). */
const MAX_PACK = 4;

/** The party met monsters: the page opens the fight. */
export interface Encounter {
  encounter: "Ordinary" | "Boss";
  /** 1-based, as Combat counts floors. */
  floor: number;
  /** Ids of the mobs fought (their enemy elements); empty for the boss. */
  elementIds: number[];
}

/** How a fight ended, as Combat reports it. */
export type FightOutcome = "Victory" | "Defeat" | "Fled";

export interface ExplorerOptions {
  /** Called when mobs reach the hero, or the hero walks into the boss. */
  onEncounter?: (encounter: Encounter) => void;
}

export function useDungeonExplorer(runId: string, options: ExplorerOptions = {}) {
  const run = shallowRef<DungeonRunResponse | null>(null);
  const loaded = shallowRef<LoadedFloor | null>(null);
  const hero = ref<Position>({ x: 0, y: 0 });
  /** The look of the hero: for now drawn at random for each run (see `heroAppearanceOf`). */
  const appearance = heroAppearanceOf(runId);
  const status = ref<ExplorerStatus>("loading");
  const errorMessage = ref<string | null>(null);
  const announcement = ref("");
  /** Changes identity on every refused key, so the view can replay its bump. */
  const bump = shallowRef<{ direction: Direction; id: number } | null>(null);
  /** Where the hero last tried to go: the view turns it that way. */
  const facing = ref<Direction>("south");
  const pendingMoves = ref(0);

  // The fog lives in a typed array; the version counter is what Vue tracks.
  const revealed = shallowRef<Uint8Array>(new Uint8Array(0));
  const revealVersion = ref(0);
  const visitedRoomIds = ref<number[]>([]);

  let queue: Promise<void> = Promise.resolve();
  let generation = 0;
  let bumpCount = 0;
  let isFighting = false;

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

  // The server dates each death: only a new turn brings new deaths to show.
  watch(
    run,
    (next, previous) => {
      if (!next || !previous || next.turn === previous.turn) return;
      const killed = next.killedMobs;
      if (killed.length === 0) return;
      dyingMobs.value = [...dyingMobs.value, ...killed];
      // Dungeon kills the mobs that reach the hero in place of a fight (its TODO
      // "fight-trigger"): the fight is played here, against them.
      void startEncounter(
        "Ordinary",
        killed.slice(0, MAX_PACK).map((mob) => mob.id),
        MOVE_COOLDOWN_MS,
      );
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
    status.value = "loading";
    errorMessage.value = null;
    try {
      const state = await joinDungeon(runId);
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
    restoreExploration(next.floor, state.visitedTiles);
    placeHero(state.hero);

    if (state.currentFloor + 1 < state.floorCount) {
      prefetchFloor(state.seed, state.currentFloor + 1);
    }
  }

  /**
   * The server keeps the tiles the hero stood on: revealing around each of them
   * again rebuilds the fog and the minimap as they were before a reload.
   */
  function restoreExploration(current: DecodedFloor, visitedTiles: string): void {
    const roomIds = new Set<number>();
    for (const tile of decodeVisitedTiles(current, visitedTiles)) {
      const room = roomAt(current, tile);
      if (room && roomIds.has(room.id)) continue; // already revealed whole
      reveal(current, revealed.value, tile);
      if (room) roomIds.add(room.id);
    }
    visitedRoomIds.value = [...roomIds];
    revealVersion.value++;
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
    if (pendingMoves.value >= MAX_PENDING_MOVES) return;
    if (dyingMobs.value.length > 0) return;

    facing.value = direction;
    const target = step(hero.value, direction);

    // Walking into the boss starts the fight; into the open gate, the way down.
    if (bossAt(current, target)) {
      void startEncounter("Boss", []);
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
      announce(isGate ? "The gate is locked: defeat the boss of this floor first." : "Blocked.");
      return;
    }

    // Same rule as the backend: a mob blocks the way.
    if (mobs.value.some((mob) => samePosition(mob, target))) {
      bump.value = { direction, id: ++bumpCount };
      announce("A mob blocks the way.");
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
      await enterFloor(updated);
      announce(`Floor ${updated.currentFloor + 1} of ${updated.floorCount}.`);
    } catch (error) {
      await resynchronise(error);
    } finally {
      pendingMoves.value--;
    }
  }

  /**
   * Lets the moves already typed land, then hands the fight to the page.
   * @param delay Time for the player to see the contact before the fight opens.
   */
  async function startEncounter(
    encounter: Encounter["encounter"],
    elementIds: number[],
    delay = 0,
  ): Promise<void> {
    const state = run.value;
    if (!state || state.status !== "active" || isFighting) return;
    if (encounter === "Boss" && !canFightBoss.value) return;
    isFighting = true;
    const moveGeneration = generation;
    await queue;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    isFighting = false;
    if (moveGeneration !== generation) return;
    announce(encounter === "Boss" ? "The boss attacks!" : "Monsters attack!");
    options.onEncounter?.({ encounter, floor: state.currentFloor + 1, elementIds });
  }

  /**
   * Back from Combat. The mobs of a pack are already dead on Dungeon's side; the boss
   * beaten is recorded by Dungeon, which opens the gate down, or wins the run on the last
   * floor. TODO(contract): in the target flow Combat reports the outcome to Dungeon itself,
   * and a lost or fled fight leaves the mobs alive.
   */
  async function resolveFight(
    encounter: Encounter["encounter"],
    outcome: FightOutcome,
  ): Promise<void> {
    const state = run.value;
    if (!state) return;
    if (outcome === "Defeat") {
      announce("The party has fallen… it gets back up, bruised.");
      return;
    }
    if (outcome === "Fled") {
      announce("The party got away.");
      return;
    }
    if (encounter === "Ordinary") {
      announce("The monsters are defeated.");
      return;
    }
    if (state.floorBossDefeated || isFighting) return;
    isFighting = true;
    try {
      const updated = await defeatFloorBoss(runId);
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
    generation++;
    errorMessage.value = describe(error);
    try {
      const authoritative = await joinDungeon(runId);
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
    appearance,
    status,
    errorMessage,
    announcement,
    bump,
    facing,
    pendingMoves,
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
    resolveFight,
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
