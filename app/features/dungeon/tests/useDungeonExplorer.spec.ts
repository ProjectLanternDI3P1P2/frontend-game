import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { GatewayError } from "~/shared/utils/gateway";
import * as api from "../api/dungeonApi";
import { clearFloorCache } from "../composables/useDungeonFloor";
import { useDungeonExplorer } from "../composables/useDungeonExplorer";
import { Cell, cellAt, decodeFloor, gateOf } from "../dungeonMap";
import type { Direction, DungeonMapResponse, DungeonRunResponse, Position } from "../types";
import mapFixture from "./fixtures/map-0KX4M2T9QZ7PA-f0.json";
import runFixture from "./fixtures/run-0KX4M2T9QZ7PA.json";

vi.mock("../api/dungeonApi", () => ({
  fetchDungeonRun: vi.fn(),
  fetchDungeonMap: vi.fn(),
  moveHero: vi.fn(),
  takeStairsDown: vi.fn(),
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

    explorer.move("west");
    explorer.move("west");
    expect(explorer.hero.value).toEqual({ x: initialRun.hero.x - 2, y: initialRun.hero.y });

    await flushPromises();
    expect(vi.mocked(api.moveHero).mock.calls.map(([, direction]) => direction)).toEqual([
      "west",
      "west",
    ]);
    expect(explorer.run.value?.turn).toBe(2);
    expect(explorer.pendingMoves.value).toBe(0);
  });

  it("sends no request for a move into a wall", async () => {
    serverAccepts();
    const explorer = useDungeonExplorer(initialRun.id);
    await explorer.start();

    // One row above the centre of the start room holds no door: walk to its wall.
    explorer.move("north");
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

    explorer.move("west");
    explorer.move("west");
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

  it("keeps the gate to the stairs locked until the boss is defeated", async () => {
    const gate = gateOf(floor)!;
    const beforeGate: DungeonRunResponse = { ...initialRun, hero: { x: gate.x, y: gate.y + 1 } };
    vi.mocked(api.fetchDungeonRun).mockResolvedValue(beforeGate);
    vi.mocked(api.defeatFloorBoss).mockResolvedValue({ ...beforeGate, floorBossDefeated: true });
    vi.mocked(api.moveHero).mockResolvedValue({ ...beforeGate, hero: gate, floorBossDefeated: true });
    const explorer = useDungeonExplorer(initialRun.id);
    await explorer.start();

    explorer.move("north");
    await flushPromises();
    expect(api.moveHero).not.toHaveBeenCalled();
    expect(explorer.bump.value?.direction).toBe("north");
    expect(explorer.canFightBoss.value).toBe(true);

    await explorer.fightBoss();
    explorer.move("north");
    await flushPromises();

    expect(api.defeatFloorBoss).toHaveBeenCalledWith(initialRun.id);
    expect(explorer.floorBossDefeated.value).toBe(true);
    expect(explorer.canFightBoss.value).toBe(false);
    expect(api.moveHero).toHaveBeenCalledWith(initialRun.id, "north");
    expect(explorer.hero.value).toEqual(gate);
  });
});
