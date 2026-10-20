import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { GatewayError } from "~/shared/utils/gateway";
import * as api from "../api/dungeonApi";
import { clearFloorCache } from "../composables/useDungeonFloor";
import { useDungeonExplorer } from "../composables/useDungeonExplorer";
import { MOB_DEATH_MS, MOVE_COOLDOWN_MS } from "../dungeonRules";
import { Cell, cellAt, decodeFloor, gateOf, isWalkableAt, step } from "../dungeonMap";
import type { Direction, DungeonMapResponse, DungeonRunResponse, Position } from "../types";
import mapFixture from "./fixtures/map-DGPEAP9GWJKZF-f0.json";
import runFixture from "./fixtures/run-DGPEAP9GWJKZF.json";

vi.mock("../api/dungeonApi", () => ({
  joinDungeon: vi.fn(),
  fetchDungeonMap: vi.fn(),
  moveHero: vi.fn(),
  defeatFloorBoss: vi.fn(),
  createDungeonRun: vi.fn(),
}));

const map = mapFixture as DungeonMapResponse;
const initialRun = runFixture as DungeonRunResponse;
const floor = decodeFloor(map);

/** The server accepts every move and answers with the hero one tile further. */
function serverAccepts() {
  let hero: Position = { ...initialRun.hero };
  let turn = 0;
  vi.mocked(api.moveHero).mockImplementation(async (_runId, direction: Direction) => {
    const offsets = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] } as const;
    hero = { x: hero.x + offsets[direction][0], y: hero.y + offsets[direction][1] };
    turn++;
    return { ...initialRun, hero, turn };
  });
}

describe("useDungeonExplorer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearFloorCache();
    vi.mocked(api.joinDungeon).mockResolvedValue(initialRun);
    vi.mocked(api.fetchDungeonMap).mockResolvedValue(map);
  });

  it("places the hero on the run's position and reveals the start room", async () => {
    const explorer = useDungeonExplorer(initialRun.id);
    await explorer.start();

    expect(explorer.status.value).toBe("ready");
    expect(explorer.hero.value).toEqual(initialRun.hero);
    expect(explorer.visitedRoomIds.value).toEqual([0]);
    expect(explorer.revealed.value.some((tile) => tile === 1)).toBe(true);
  });

  it("rebuilds the fog and the minimap from the tiles the server says were visited", async () => {
    const farRoom = floor.rooms[floor.rooms.length - 1]!;
    vi.mocked(api.joinDungeon).mockResolvedValue({
      ...initialRun,
      visitedTiles: encodeTiles([initialRun.hero, farRoom.center]),
    });

    const explorer = useDungeonExplorer(initialRun.id);
    await explorer.start();

    expect([...explorer.visitedRoomIds.value].sort((a, b) => a - b)).toEqual([
      0,
      farRoom.id,
    ]);
    expect(
      explorer.revealed.value[farRoom.center.y * floor.width + farRoom.center.x],
    ).toBe(1);
  });

  it("moves the hero at once and confirms with the server, in order", async () => {
    serverAccepts();
    const explorer = useDungeonExplorer(initialRun.id);
    await explorer.start();

    // From below the entrance door, into the start room.
    explorer.move("south");
    explorer.move("south");
    expect(explorer.hero.value).toEqual({ x: initialRun.hero.x, y: initialRun.hero.y + 2 });

    await flushPromises();
    expect(vi.mocked(api.moveHero).mock.calls.map(([, direction]) => direction)).toEqual([
      "south",
      "south",
    ]);
    expect(explorer.run.value?.turn).toBe(2);
    expect(explorer.pendingMoves.value).toBe(0);
  });

  it("sends no request for a move into a wall", async () => {
    serverAccepts();
    const explorer = useDungeonExplorer(initialRun.id);
    await explorer.start();

    // Off the centre row of the start room, where the side doors are: walk to its wall.
    explorer.move("south");
    await flushPromises();
    while (cellAt(floor, explorer.hero.value.x - 1, explorer.hero.value.y) === Cell.Floor) {
      explorer.move("west");
      await flushPromises();
    }
    const requests = vi.mocked(api.moveHero).mock.calls.length;
    const before = { ...explorer.hero.value };

    explorer.move("west");
    await flushPromises();

    expect(api.moveHero).toHaveBeenCalledTimes(requests);
    expect(explorer.hero.value).toEqual(before);
    expect(explorer.bump.value?.direction).toBe("west");
  });

  it("sends no request for a move onto a known mob, and bumps", async () => {
    serverAccepts();
    const below = { x: initialRun.hero.x, y: initialRun.hero.y + 1 };
    vi.mocked(api.joinDungeon).mockResolvedValue({
      ...initialRun,
      mobs: [{ id: 99, kind: "zombie", ...below, aggro: true, nextTeleport: null }],
    });
    const explorer = useDungeonExplorer(initialRun.id);
    await explorer.start();

    explorer.move("south");
    await flushPromises();

    expect(api.moveHero).not.toHaveBeenCalled();
    expect(explorer.hero.value).toEqual(initialRun.hero);
    expect(explorer.bump.value?.direction).toBe("south");
    expect(explorer.mobs.value.map((mob) => mob.id)).toEqual([99]);
  });

  it("lets a killed mob slide to where it fell, then fade out, holding the hero meanwhile", async () => {
    vi.useFakeTimers();
    const zombie = { id: 7, kind: "zombie", x: 1, y: 1, aggro: true, nextTeleport: null } as const;
    const fallen = { ...zombie, x: 2, y: 1 };
    vi.mocked(api.joinDungeon).mockResolvedValue({ ...initialRun, mobs: [zombie] });
    vi.mocked(api.moveHero).mockImplementation(async () => ({
      ...initialRun,
      hero: { x: initialRun.hero.x, y: initialRun.hero.y + 1 },
      turn: 1,
      mobs: [],
      killedMobs: [fallen],
    }));
    const explorer = useDungeonExplorer(initialRun.id);
    await explorer.start();

    // The move that kills it: it is drawn on the tile it stepped to, not where it was.
    explorer.move("south");
    await flushPromises();
    expect(explorer.dyingMobs.value).toEqual([fallen]);

    // While it slides and fades, the hero stands still.
    explorer.move("south");
    await flushPromises();
    expect(api.moveHero).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(MOVE_COOLDOWN_MS + MOB_DEATH_MS);
    await flushPromises();
    expect(explorer.dyingMobs.value).toEqual([]);
    vi.useRealTimers();
  });

  it("goes back to the server's position when a move is refused", async () => {
    vi.mocked(api.moveHero).mockRejectedValue(
      new GatewayError(409, { code: "CONFLICT", message: "Refused." }),
    );
    const explorer = useDungeonExplorer(initialRun.id);
    await explorer.start();

    explorer.move("south");
    explorer.move("south");
    await flushPromises();

    expect(api.moveHero).toHaveBeenCalledTimes(1);
    expect(explorer.hero.value).toEqual(initialRun.hero);
    expect(explorer.errorMessage.value).toBe("Refused.");
  });

  it("loads each floor once, whatever the number of explorers", async () => {
    await Promise.all([
      useDungeonExplorer(initialRun.id).start(),
      useDungeonExplorer(initialRun.id).start(),
    ]);

    // Floor 0, and floor 1 prefetched once.
    const floors = vi.mocked(api.fetchDungeonMap).mock.calls.map(([, floorIndex]) => floorIndex);
    expect(floors.sort()).toEqual([0, 1]);
  });

  it("fights the boss when the hero walks into it", async () => {
    const boss = floor.elements.find((element) => element.type === "boss")!;
    const direction = (["north", "east", "south", "west"] as const).find((candidate) =>
      isWalkableAt(floor, step(boss, opposite(candidate))),
    )!;
    const nextToBoss = step(boss, opposite(direction));
    const run: DungeonRunResponse = { ...initialRun, hero: nextToBoss };
    vi.mocked(api.joinDungeon).mockResolvedValue(run);
    vi.mocked(api.defeatFloorBoss).mockResolvedValue({ ...run, floorBossDefeated: true });
    const explorer = useDungeonExplorer(initialRun.id);
    await explorer.start();

    explorer.move(direction);
    await flushPromises();

    expect(api.defeatFloorBoss).toHaveBeenCalledWith(initialRun.id);
    expect(api.moveHero).not.toHaveBeenCalled();
    expect(explorer.hero.value).toEqual(nextToBoss);
    expect(explorer.floorBossDefeated.value).toBe(true);
  });

  it("keeps the gate locked until the boss is defeated, then goes down through it", async () => {
    const gate = gateOf(floor)!;
    const belowGate: DungeonRunResponse = { ...initialRun, hero: { x: gate.x, y: gate.y + 1 } };
    const arrival = { x: 7, y: 9 };
    vi.mocked(api.joinDungeon).mockResolvedValue(belowGate);
    vi.mocked(api.moveHero).mockResolvedValue({
      ...belowGate,
      currentFloor: 1,
      hero: arrival,
      turn: 1,
    });
    const explorer = useDungeonExplorer(initialRun.id);
    await explorer.start();

    explorer.move("north");
    await flushPromises();
    expect(api.moveHero).not.toHaveBeenCalled();
    expect(explorer.bump.value?.direction).toBe("north");

    explorer.run.value = { ...belowGate, floorBossDefeated: true };
    explorer.move("north");
    await flushPromises();

    expect(api.moveHero).toHaveBeenCalledWith(initialRun.id, "north");
    expect(explorer.run.value?.currentFloor).toBe(1);
    expect(explorer.hero.value).toEqual(arrival);
    expect(vi.mocked(api.fetchDungeonMap).mock.calls.map(([, floorIndex]) => floorIndex)).toContain(1);
  });
});

function opposite(direction: Direction): Direction {
  return ({ north: "south", east: "west", south: "north", west: "east" } as const)[direction];
}

/** The run's `visitedTiles` bitset, as the server encodes it. */
function encodeTiles(tiles: Position[]): string {
  const bytes = new Uint8Array(Math.ceil((floor.width * floor.height) / 8));
  for (const { x, y } of tiles) {
    const index = y * floor.width + x;
    bytes[index >> 3]! |= 1 << (index & 7);
  }
  return btoa(String.fromCharCode(...bytes));
}
