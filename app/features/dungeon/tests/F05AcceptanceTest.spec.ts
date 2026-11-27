/**
 * F05 — Final boss of the dungeon (US #266): invariant, degraded states, proofs.
 * One `describe` per acceptance criterion. The page is mounted with the API
 * mocked; failing floors are built in memory from the backend fixtures.
 */
import { flushPromises, mount } from "@vue/test-utils";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Component,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api/dungeonApi";
import { findFloorBoss } from "../bossRules";
import { clearFloorCache } from "../composables/useDungeonFloor";
import { useDungeonExplorer } from "../composables/useDungeonExplorer";
import { decodeFloor, isWalkableAt, roomAt, step } from "../dungeonMap";
import type {
  Direction,
  DungeonElement,
  DungeonMapResponse,
  DungeonRunResponse,
} from "../types";
import mapA from "./fixtures/map-DGPEAP9GWJKZF-f0.json";
import mapB from "./fixtures/map-DDR55WKRPRVBN-f0.json";
import runFixture from "./fixtures/run-DGPEAP9GWJKZF.json";
import UiButton from "~/shared/ui/UiButton.vue";

vi.mock("../api/dungeonApi", () => ({
  joinDungeon: vi.fn(),
  fetchDungeonMap: vi.fn(),
  moveHero: vi.fn(),
  defeatFloorBoss: vi.fn(),
  openChest: vi.fn(),
  createDungeonRun: vi.fn(),
  spawnMob: vi.fn(),
}));

const map = mapA as DungeonMapResponse;
const fixtures = [mapA, mapB] as DungeonMapResponse[];
const initialRun = runFixture as DungeonRunResponse;
const floor = decodeFloor(map);
const bossElement = map.elements.find((element) => element.type === "boss")!;
const bossRoom = map.rooms.find((room) => room.type === "boss")!;

/** A tile next to the boss, inside its room, and the step that walks into it. */
const towardBoss = (["north", "east", "south", "west"] as const).find((candidate) => {
  const from = step(bossElement, opposite(candidate));
  return isWalkableAt(floor, from) && roomAt(floor, from)?.type === "boss";
})!;
const nextToBoss = step(bossElement, opposite(towardBoss));
const inBossRoom: DungeonRunResponse = { ...initialRun, hero: nextToBoss };

function withElements(elements: DungeonElement[]): DungeonMapResponse {
  return { ...map, elements };
}
const withoutBoss = withElements(map.elements.filter((e) => e.type !== "boss"));

/** A promise settled from the test, to observe what happens while a load is in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, ko) => {
    resolve = ok;
    reject = ko;
  });
  return { promise, resolve, reject };
}

async function mountPage() {
  // The page relies on Nuxt's auto-imports: they are provided by hand here.
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("nextTick", nextTick);
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("onBeforeUnmount", onBeforeUnmount);
  vi.stubGlobal("definePageMeta", () => {});
  vi.stubGlobal("useHead", () => {});
  vi.stubGlobal("useRoute", () => ({
    params: { runId: initialRun.id },
    query: {},
    fullPath: `/dungeon/${initialRun.id}`,
  }));
  const { default: Page } = (await import("~/pages/dungeon/[runId].vue")) as {
    default: Component;
  };
  const wrapper = mount(Page, {
    global: {
      components: { UiButton },
      stubs: { NuxtLink: true, AudioMuteToggle: true, ChestLootModal: true },
    },
  });
  await flushPromises();
  return wrapper;
}

type Page = Awaited<ReturnType<typeof mountPage>>;

const bossSprites = (page: Page) => page.findAll(".dungeon-element--boss");
const bossNotice = (page: Page) => page.find(".dungeon-boss-notice");
const buttonNamed = (page: Page, name: string) =>
  page.findAll("button").find((button) => button.text() === name);

describe("F05", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearFloorCache();
    vi.mocked(api.joinDungeon).mockResolvedValue(initialRun);
    vi.mocked(api.fetchDungeonMap).mockResolvedValue(map);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("CA1 — the rule locates the single boss of a valid floor", () => {
    it.each(fixtures.map((fixture) => [fixture.seed, fixture] as const))(
      "returns the boss position of %s",
      (_seed, fixture) => {
        const boss = fixture.elements.find((element) => element.type === "boss")!;
        const room = fixture.rooms.find((candidate) => candidate.type === "boss")!;
        expect(findFloorBoss(decodeFloor(fixture))).toEqual({
          ok: true,
          boss: { x: boss.x, y: boss.y, roomId: room.id, elementId: boss.id },
        });
      },
    );
  });

  describe("CA2 — a broken invariant is a typed failure, never an exception", () => {
    it("no boss element: missing", () => {
      expect(() => findFloorBoss(withoutBoss)).not.toThrow();
      expect(findFloorBoss(withoutBoss)).toEqual({ ok: false, reason: "missing" });
    });

    it("two boss elements: duplicate", () => {
      const twice = withElements([...map.elements, { ...bossElement, id: 9999 }]);
      expect(findFloorBoss(twice)).toEqual({ ok: false, reason: "duplicate" });
    });

    it("boss element outside the boss room: misplaced", () => {
      const start = map.rooms.find((room) => room.type === "start")!;
      const moved = withElements(
        map.elements.map((element) =>
          element.type === "boss"
            ? { ...element, ...start.center, roomId: start.id }
            : element,
        ),
      );
      expect(findFloorBoss(moved)).toEqual({ ok: false, reason: "misplaced" });
    });

    it("no boss room: misplaced", () => {
      const rooms = map.rooms.map((room) =>
        room.type === "boss" ? { ...room, type: "empty" as const } : room,
      );
      expect(findFloorBoss({ ...map, rooms })).toEqual({
        ok: false,
        reason: "misplaced",
      });
    });

    it("several boss rooms: misplaced", () => {
      const rooms = map.rooms.map((room) =>
        room.type === "treasure" ? { ...room, type: "boss" as const } : room,
      );
      expect(findFloorBoss({ ...map, rooms })).toEqual({
        ok: false,
        reason: "misplaced",
      });
    });

    it("boss element tagged with the boss room id but outside its bounds: misplaced", () => {
      const start = map.rooms.find((room) => room.type === "start")!;
      const moved = withElements(
        map.elements.map((element) =>
          element.type === "boss" ? { ...element, ...start.center } : element,
        ),
      );
      expect(findFloorBoss(moved)).toEqual({ ok: false, reason: "misplaced" });
    });

    it("empty floor: missing, no throw", () => {
      expect(findFloorBoss({ rooms: [], elements: [] })).toEqual({
        ok: false,
        reason: "missing",
      });
    });
  });

  describe("CA3 — same seed and floor, same position, the one received", () => {
    it("two independent decodings give the same position", () => {
      const first = findFloorBoss(decodeFloor(structuredClone(map)));
      const second = findFloorBoss(decodeFloor(structuredClone(map)));
      expect(first).toEqual(second);
      expect(first.ok && first.boss).toEqual({
        x: bossElement.x,
        y: bossElement.y,
        roomId: bossElement.roomId,
        elementId: bossElement.id,
      });
    });

    it("two successive explorer loads expose the same position, from one fetch", async () => {
      const first = useDungeonExplorer(initialRun.id);
      await first.start();
      const second = useDungeonExplorer(initialRun.id);
      await second.start();

      expect(first.floorBoss.value).toEqual(second.floorBoss.value);
      expect(first.floorBoss.value).toMatchObject({
        x: bossElement.x,
        y: bossElement.y,
      });
      const floor0 = vi
        .mocked(api.fetchDungeonMap)
        .mock.calls.filter(([, index]) => index === 0);
      expect(floor0).toHaveLength(1);
    });
  });

  describe("CA4 — the boss is shown once, where it stands, until defeated", () => {
    it("can fight only from inside the boss room", async () => {
      const outside = useDungeonExplorer(initialRun.id);
      await outside.start();
      expect(outside.floorBoss.value?.roomId).toBe(bossRoom.id);
      expect(outside.canFightBoss.value).toBe(false);

      vi.mocked(api.joinDungeon).mockResolvedValue(inBossRoom);
      const inside = useDungeonExplorer(initialRun.id);
      await inside.start();
      expect(inside.canFightBoss.value).toBe(true);
    });

    it("the board draws no boss from the start room", async () => {
      const page = await mountPage();
      expect(page.find('[role="application"]').exists()).toBe(true);
      expect(bossSprites(page)).toHaveLength(0);
    });

    it("the board draws exactly one boss, at its position, in the boss room", async () => {
      vi.mocked(api.joinDungeon).mockResolvedValue(inBossRoom);
      const page = await mountPage();
      const sprites = bossSprites(page);
      expect(sprites).toHaveLength(1);
      const style = (sprites[0]!.element as HTMLElement).style;
      expect(style.getPropertyValue("--x").trim()).toBe(String(bossElement.x));
      expect(style.getPropertyValue("--y").trim()).toBe(String(bossElement.y));
    });

    it("the board draws no boss once it is defeated", async () => {
      vi.mocked(api.joinDungeon).mockResolvedValue({
        ...inBossRoom,
        floorBossDefeated: true,
      });
      const page = await mountPage();
      expect(bossSprites(page)).toHaveLength(0);
    });
  });

  describe("CA5 — broken invariant: exploration kept, explicit notice, reload", () => {
    it("keeps exploring, says so, and clears the notice once the floor is valid", async () => {
      vi.mocked(api.fetchDungeonMap).mockResolvedValueOnce(withoutBoss);
      const page = await mountPage();

      expect(page.find('[role="application"]').exists()).toBe(true);
      const notice = bossNotice(page);
      expect(notice.attributes("role")).toBe("alert");
      expect(notice.text()).toContain(
        "The final boss of this floor could not be located.",
      );

      const joins = vi.mocked(api.joinDungeon).mock.calls.length;
      await buttonNamed(page, "Reload floor")!.trigger("click");
      await flushPromises();

      expect(api.joinDungeon).toHaveBeenCalledTimes(joins + 1);
      const floor0 = vi
        .mocked(api.fetchDungeonMap)
        .mock.calls.filter(([, index]) => index === 0);
      expect(floor0).toHaveLength(2);
      expect(bossNotice(page).exists()).toBe(false);
      expect(page.find('[role="application"]').exists()).toBe(true);
    });

    it("after a successful reload, mounting the page again shows the valid floor", async () => {
      vi.mocked(api.fetchDungeonMap).mockResolvedValueOnce(withoutBoss);
      const first = await mountPage();
      expect(bossNotice(first).attributes("role")).toBe("alert");
      await buttonNamed(first, "Reload floor")!.trigger("click");
      await flushPromises();
      expect(bossNotice(first).exists()).toBe(false);
      first.unmount();

      // Same session, cache kept: the page is mounted again.
      const page = await mountPage();
      expect(page.find('[role="application"]').exists()).toBe(true);
      expect(bossNotice(page).exists()).toBe(false);
    });

    it("after a successful reload, start() and retry() of the same explorer show the valid floor", async () => {
      vi.mocked(api.fetchDungeonMap).mockResolvedValueOnce(withoutBoss);
      const explorer = useDungeonExplorer(initialRun.id);
      await explorer.start();
      expect(explorer.bossFailure.value).not.toBeNull();
      await explorer.reloadFloor();
      expect(explorer.bossFailure.value).toBeNull();

      await explorer.start();
      expect(explorer.bossFailure.value).toBeNull();
      await explorer.retry();
      expect(explorer.bossFailure.value).toBeNull();
      expect(explorer.floorBoss.value).toMatchObject({
        x: bossElement.x,
        y: bossElement.y,
      });
    });

    it("after a successful reload, a new explorer (cache kept) shows the valid floor", async () => {
      vi.mocked(api.fetchDungeonMap).mockResolvedValueOnce(withoutBoss);
      const first = useDungeonExplorer(initialRun.id);
      await first.start();
      await first.reloadFloor();
      const second = useDungeonExplorer(initialRun.id);
      await second.start();
      expect(second.bossFailure.value).toBeNull();
    });

    it("Reload floor still invalid: notice kept, exploration kept", async () => {
      vi.mocked(api.fetchDungeonMap).mockResolvedValue(withoutBoss);
      const page = await mountPage();
      await buttonNamed(page, "Reload floor")!.trigger("click");
      await flushPromises();
      expect(bossNotice(page).exists()).toBe(true);
      expect(page.find('[role="application"]').exists()).toBe(true);
    });

    it("Reload floor failing: exploration and notice kept, error shown", async () => {
      vi.mocked(api.fetchDungeonMap).mockResolvedValueOnce(withoutBoss);
      const page = await mountPage();
      vi.mocked(api.joinDungeon).mockRejectedValueOnce(new Error("Network down."));
      await buttonNamed(page, "Reload floor")!.trigger("click");
      await flushPromises();
      expect(page.find('[role="application"]').exists()).toBe(true);
      expect(bossNotice(page).exists()).toBe(true);
      expect(page.text()).not.toContain("could not be loaded");
      expect(page.find(".dungeon-page__error").text()).toContain("Network down.");
    });
  });

  describe("CA6 — failed load: explicit error, announced loading, retry", () => {
    it("announces the loading politely", async () => {
      const join = deferred<DungeonRunResponse>();
      vi.mocked(api.joinDungeon).mockReturnValue(join.promise);
      const page = await mountPage();
      const status = page.get('[role="status"]');
      expect(status.text()).toContain("Opening the dungeon");
      // role="status" carries an implicit aria-live="polite" (WAI-ARIA); an
      // explicit value, if any, must not be stronger or off.
      expect(status.attributes("aria-live") ?? "polite").toBe("polite");
      join.resolve(initialRun);
      await flushPromises();
    });

    it.each([
      ["the run", () => vi.mocked(api.joinDungeon)],
      ["the floor", () => vi.mocked(api.fetchDungeonMap)],
    ] as const)("retries after %s failed, and clears the error", async (_, fails) => {
      fails().mockRejectedValueOnce(new Error("Network down."));
      const page = await mountPage();

      const alert = page.get('[role="alert"]');
      expect(alert.text()).toContain("The dungeon could not be loaded: Network down.");
      expect(page.find('[role="application"]').exists()).toBe(false);

      await buttonNamed(page, "Retry")!.trigger("click");
      await flushPromises();

      expect(page.find('[role="application"]').exists()).toBe(true);
      expect(page.text()).not.toContain("could not be loaded");
      expect(buttonNamed(page, "Retry")).toBeUndefined();
    });

    it("Retry failing again keeps the error and the Retry button", async () => {
      vi.mocked(api.joinDungeon).mockRejectedValue(new Error("Network down."));
      const page = await mountPage();
      await buttonNamed(page, "Retry")!.trigger("click");
      await flushPromises();
      expect(page.get('[role="alert"]').text()).toContain("could not be loaded");
      expect(buttonNamed(page, "Retry")).toBeDefined();
    });
  });

  describe("CA7 — no second load while one is in flight", () => {
    it("Retry is gone while the retry loads, and sends one request", async () => {
      vi.mocked(api.joinDungeon).mockRejectedValueOnce(new Error("Network down."));
      const page = await mountPage();
      const join = deferred<DungeonRunResponse>();
      vi.mocked(api.joinDungeon).mockReturnValueOnce(join.promise);

      await buttonNamed(page, "Retry")!.trigger("click");
      expect(buttonNamed(page, "Retry")).toBeUndefined();
      expect(page.get('[role="status"]').text()).toContain("Opening the dungeon");

      join.resolve(initialRun);
      await flushPromises();
      expect(api.joinDungeon).toHaveBeenCalledTimes(2);
    });

    it("reloading the floor twice at once reads each resource once", async () => {
      vi.mocked(api.fetchDungeonMap).mockResolvedValueOnce(withoutBoss);
      const explorer = useDungeonExplorer(initialRun.id);
      await explorer.start();
      vi.mocked(api.joinDungeon).mockClear();
      vi.mocked(api.fetchDungeonMap).mockClear();

      const first = explorer.reloadFloor();
      const second = explorer.reloadFloor();
      const third = explorer.retry();
      expect(explorer.isReloading.value).toBe(true);
      await Promise.all([first, second, third]);

      expect(api.joinDungeon).toHaveBeenCalledTimes(1);
      const floor0 = vi
        .mocked(api.fetchDungeonMap)
        .mock.calls.filter(([, index]) => index === 0);
      expect(floor0).toHaveLength(1);
      expect(explorer.isReloading.value).toBe(false);
      expect(explorer.bossFailure.value).toBeNull();
    });

    it("Reload floor clicked twice while loading: disabled, one request per resource", async () => {
      vi.mocked(api.fetchDungeonMap).mockResolvedValueOnce(withoutBoss);
      const page = await mountPage();
      vi.mocked(api.joinDungeon).mockClear();
      vi.mocked(api.fetchDungeonMap).mockClear();
      const join = deferred<DungeonRunResponse>();
      vi.mocked(api.joinDungeon).mockReturnValueOnce(join.promise);

      await buttonNamed(page, "Reload floor")!.trigger("click");
      expect(page.find('[role="application"]').exists()).toBe(true);
      expect(bossNotice(page).exists()).toBe(true);
      const again = buttonNamed(page, "Reload floor");
      expect(again).toBeDefined();
      expect(again!.attributes("disabled")).toBeDefined();
      await again!.trigger("click");
      join.resolve(initialRun);
      await flushPromises();
      expect(api.joinDungeon).toHaveBeenCalledTimes(1);
      const floor0 = vi
        .mocked(api.fetchDungeonMap)
        .mock.calls.filter(([, index]) => index === 0);
      expect(floor0).toHaveLength(1);
      expect(bossNotice(page).exists()).toBe(false);
    });
  });

  describe("CA8 — the boss follows the run read from the server", () => {
    it("a failed defeat whose resync says defeated: boss gone, gate open", async () => {
      vi.mocked(api.joinDungeon)
        .mockResolvedValueOnce(inBossRoom)
        .mockResolvedValueOnce({ ...inBossRoom, floorBossDefeated: true });
      vi.mocked(api.defeatFloorBoss).mockRejectedValue(new Error("Timeout."));
      const page = await mountPage();
      expect(bossSprites(page)).toHaveLength(1);

      await page.get('[role="application"]').trigger("keydown", {
        code: keyFor(towardBoss),
      });
      await flushPromises();

      expect(api.defeatFloorBoss).toHaveBeenCalledTimes(1);
      expect(api.joinDungeon).toHaveBeenCalledTimes(2);
      expect(bossSprites(page)).toHaveLength(0);
      expect(page.find(".dungeon-door--opening").exists()).toBe(true);
    });

    it("a failed defeat whose resync says standing: boss still shown", async () => {
      vi.mocked(api.joinDungeon).mockResolvedValue(inBossRoom);
      vi.mocked(api.defeatFloorBoss).mockRejectedValue(new Error("Timeout."));
      const page = await mountPage();

      await page.get('[role="application"]').trigger("keydown", {
        code: keyFor(towardBoss),
      });
      await flushPromises();

      expect(api.joinDungeon).toHaveBeenCalledTimes(2);
      expect(bossSprites(page)).toHaveLength(1);
      expect(page.find(".dungeon-door--opening").exists()).toBe(false);
    });
  });

  describe("CA9 — two quick steps into the boss send one defeat", () => {
    it("posts boss-defeats once", async () => {
      vi.mocked(api.joinDungeon).mockResolvedValue(inBossRoom);
      vi.mocked(api.defeatFloorBoss).mockResolvedValue({
        ...inBossRoom,
        floorBossDefeated: true,
      });
      const explorer = useDungeonExplorer(initialRun.id);
      await explorer.start();

      explorer.move(towardBoss);
      explorer.move(towardBoss);
      await flushPromises();

      expect(api.defeatFloorBoss).toHaveBeenCalledTimes(1);
      expect(explorer.floorBossDefeated.value).toBe(true);
    });
  });
});

function opposite(direction: Direction): Direction {
  return ({ north: "south", east: "west", south: "north", west: "east" } as const)[
    direction
  ];
}

function keyFor(direction: Direction): string {
  return {
    north: "ArrowUp",
    east: "ArrowRight",
    south: "ArrowDown",
    west: "ArrowLeft",
  }[direction];
}
