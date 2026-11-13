import { describe, expect, it } from "vitest";
import { diffRunCues } from "../audio/diffRunCues";
import type { DungeonRunResponse } from "../types";
import runFixture from "./fixtures/run-DGPEAP9GWJKZF.json";

const base = {
  ...(runFixture as DungeonRunResponse),
  status: "active",
  currentFloor: 0,
  floorCount: 3,
  floorBossDefeated: false,
  discoveredRoomIds: [0],
} satisfies DungeonRunResponse;

function run(change: Partial<DungeonRunResponse>): DungeonRunResponse {
  return { ...base, ...change };
}

describe("diffRunCues", () => {
  it("plays nothing on the first snapshot of a session", () => {
    expect(diffRunCues(null, base)).toEqual([]);
    expect(diffRunCues(null, run({ floorBossDefeated: true, status: "won" }))).toEqual(
      [],
    );
  });

  it("plays nothing when nothing audible changed", () => {
    expect(
      diffRunCues(base, run({ turn: base.turn + 1, hero: { x: 1, y: 1 } })),
    ).toEqual([]);
  });

  it("opens the gate when the boss of the floor falls", () => {
    expect(diffRunCues(base, run({ floorBossDefeated: true }))).toEqual(["gateOpen"]);
  });

  it("does not open the gate again once it is open", () => {
    const open = run({ floorBossDefeated: true });
    expect(diffRunCues(open, run({ floorBossDefeated: true, turn: 9 }))).toEqual([]);
  });

  it("plays the victory alone when the final boss falls", () => {
    const lastFloor = run({ currentFloor: 2 });
    expect(
      diffRunCues(
        lastFloor,
        run({ currentFloor: 2, floorBossDefeated: true, status: "won" }),
      ),
    ).toEqual(["victory"]);
  });

  it("goes down a floor, without the new floor's rooms or reset gate", () => {
    const open = run({ floorBossDefeated: true, discoveredRoomIds: [0, 1, 2] });
    expect(
      diffRunCues(
        open,
        run({ currentFloor: 1, floorBossDefeated: false, discoveredRoomIds: [0] }),
      ),
    ).toEqual(["floorDown"]);
  });

  it("plays nothing when a resynchronisation lands on an earlier floor", () => {
    expect(diffRunCues(run({ currentFloor: 1 }), base)).toEqual([]);
  });

  it("announces a newly discovered room once", () => {
    const entered = run({ discoveredRoomIds: [0, 3] });
    expect(diffRunCues(base, entered)).toEqual(["roomDiscovered"]);
    expect(diffRunCues(entered, run({ discoveredRoomIds: [0, 3], turn: 9 }))).toEqual(
      [],
    );
  });

  it("plays nothing for a lost or abandoned run", () => {
    expect(diffRunCues(base, run({ status: "lost" }))).toEqual([]);
    expect(diffRunCues(base, run({ status: "abandoned" }))).toEqual([]);
  });

  it("plays nothing across two different runs", () => {
    expect(
      diffRunCues(base, run({ id: "another-run", floorBossDefeated: true })),
    ).toEqual([]);
  });
});
