import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { GatewayError } from "~/shared/utils/gateway";
import * as api from "../api/dungeonApi";
import { clearFloorCache } from "../composables/useDungeonFloor";
import { useDungeonExplorer } from "../composables/useDungeonExplorer";
import { Cell, cellAt, decodeFloor, gateOf, isWalkableAt, step } from "../dungeonMap";
import type { Direction, DungeonMapResponse, DungeonRunResponse, Position } from "../types";
import mapFixture from "./fixtures/map-DGPEAP9GWJKZF-f0.json";
import runFixture from "./fixtures/run-DGPEAP9GWJKZF.json";

vi.mock("../api/dungeonApi", () => ({
  fetchDungeonRun: vi.fn(),
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
    vi.mocked(api.fetchDungeonRun).mockResolvedValue(initialRun);
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
    vi.mocked(api.fetchDungeonRun).mockResolvedValue(run);
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
    vi.mocked(api.fetchDungeonRun).mockResolvedValue(belowGate);
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
