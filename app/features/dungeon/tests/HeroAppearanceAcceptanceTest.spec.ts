/**
 * US-DUNGEON-13 — The hero in the dungeon looks like the one made in the hero editor.
 *
 * CA1: a hero with a chosen look is drawn with that look.
 * CA2: a hero with no look set is drawn with the default look.
 * CA3: a missing or malformed look is drawn with the default look, never a broken sprite.
 * CA4: the run never waits on, nor fails because of, the hero's look (error, timeout).
 *
 * Drives the explorer as the page does, with the Dungeon API mocked at its boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_HERO_APPEARANCE } from "~/features/player/appearance";
import { GatewayError } from "~/shared/utils/gateway";
import * as api from "../api/dungeonApi";
import { clearFloorCache } from "../composables/useDungeonFloor";
import {
  HERO_APPEARANCE_TIMEOUT_MS,
  useDungeonExplorer,
  type HeroAppearanceReport,
} from "../composables/useDungeonExplorer";
import { heroLayers, type HeroAppearance } from "../tiles/hero";
import type {
  DungeonMapResponse,
  DungeonRunHeroesResponse,
  DungeonRunResponse,
  RunHeroResponse,
} from "../types";
import mapFixture from "./fixtures/map-DGPEAP9GWJKZF-f0.json";
import runFixture from "./fixtures/run-DGPEAP9GWJKZF.json";

vi.mock("../api/dungeonApi", () => ({
  joinDungeon: vi.fn(),
  fetchDungeonMap: vi.fn(),
  fetchRunHeroes: vi.fn(),
  moveHero: vi.fn(),
  defeatFloorBoss: vi.fn(),
  openChest: vi.fn(),
  createDungeonRun: vi.fn(),
}));

const run = runFixture as DungeonRunResponse;
const HERO_ID = "0199a5b2-1111-7000-8000-000000000001";

function heroesAnswer(...heroes: Partial<RunHeroResponse>[]): DungeonRunHeroesResponse {
  return {
    runId: run.id,
    heroes: heroes.map((hero) => ({
      heroId: HERO_ID,
      appearance: { skinTone: 1, hairStyle: "bob1", hairColor: 1 },
      isDefaultAppearance: false,
      ...hero,
    })),
  };
}

/** The body and hair the viewport draws, as Player's codes. */
function drawnLook(appearance: HeroAppearance) {
  return {
    skinTone: appearance.body.variant,
    hairStyle: appearance.hair?.style ?? "bald",
    hairColor: appearance.hair?.variant ?? null,
  };
}

/** Starts the explorer as the page does, and records what it reports. */
async function startExplorer() {
  const reports: HeroAppearanceReport[] = [];
  const explorer = useDungeonExplorer(run.id, {
    onHeroAppearance: (report) => reports.push(report),
  });
  await explorer.start();
  return { explorer, reports };
}

describe("US-DUNGEON-13", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearFloorCache();
    vi.mocked(api.joinDungeon).mockResolvedValue(run);
    vi.mocked(api.fetchDungeonMap).mockResolvedValue(mapFixture as DungeonMapResponse);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("CA1 — a hero with a chosen look", () => {
    it("is drawn with the skin and hair chosen in the hero editor", async () => {
      vi.mocked(api.fetchRunHeroes).mockResolvedValue(
        heroesAnswer({ appearance: { skinTone: 6, hairStyle: "dap1", hairColor: 9 } }),
      );

      const { explorer, reports } = await startExplorer();

      expect(explorer.status.value).toBe("ready");
      expect(drawnLook(explorer.appearance.value)).toEqual({
        skinTone: 6,
        hairStyle: "dap1",
        hairColor: 9,
      });
      const sheets = heroLayers(explorer.appearance.value, "south").map(
        ({ sheet }) => sheet,
      );
      expect(sheets.some((sheet) => sheet.includes("_0bas_humn_v06"))).toBe(true);
      expect(sheets.some((sheet) => sheet.includes("_4har_dap1_v09"))).toBe(true);
      expect(explorer.appearanceSource.value).toBe("chosen");
      expect(reports).toEqual([{ source: "chosen", durationMs: expect.any(Number) }]);
    });

    it("draws a bald hero without hair", async () => {
      vi.mocked(api.fetchRunHeroes).mockResolvedValue(
        heroesAnswer({
          appearance: { skinTone: 2, hairStyle: "bald", hairColor: null },
        }),
      );

      const { explorer } = await startExplorer();

      expect(explorer.appearance.value.hair).toBeNull();
      expect(explorer.appearanceSource.value).toBe("chosen");
    });

    it("reads the look for this run, through the Dungeon API, cancellable", async () => {
      vi.mocked(api.fetchRunHeroes).mockResolvedValue(heroesAnswer({}));

      await startExplorer();

      expect(api.fetchRunHeroes).toHaveBeenCalledOnce();
      expect(api.fetchRunHeroes).toHaveBeenCalledWith(run.id, expect.any(AbortSignal));
    });
  });

  describe("CA2 — a hero with no look set", () => {
    it("is drawn with the default look when Player could not describe it", async () => {
      vi.mocked(api.fetchRunHeroes).mockResolvedValue(
        heroesAnswer({
          appearance: { skinTone: 1, hairStyle: "bob1", hairColor: 1 },
          isDefaultAppearance: true,
        }),
      );

      const { explorer } = await startExplorer();

      expect(drawnLook(explorer.appearance.value)).toEqual(DEFAULT_HERO_APPEARANCE);
      expect(explorer.appearanceSource.value).toBe("player-default");
    });

    it("is drawn with the default look for a run started without a hero", async () => {
      vi.mocked(api.fetchRunHeroes).mockResolvedValue(heroesAnswer());

      const { explorer, reports } = await startExplorer();

      expect(drawnLook(explorer.appearance.value)).toEqual(DEFAULT_HERO_APPEARANCE);
      expect(reports.map(({ source }) => source)).toEqual(["no-hero"]);
    });
  });

  describe("CA3 — a missing or malformed look", () => {
    it.each([
      ["no appearance object", null],
      ["an empty appearance object", {}],
    ])("falls back to the default look for %s", async (_case, appearance) => {
      vi.mocked(api.fetchRunHeroes).mockResolvedValue(
        heroesAnswer({ appearance: appearance as never }),
      );

      const { explorer } = await startExplorer();

      expect(drawnLook(explorer.appearance.value)).toEqual(DEFAULT_HERO_APPEARANCE);
      expect(explorer.appearanceSource.value).toBe("unrecognized");
    });

    it("keeps what it knows and replaces only the unknown code", async () => {
      vi.mocked(api.fetchRunHeroes).mockResolvedValue(
        heroesAnswer({
          appearance: { skinTone: 8, hairStyle: "mohawk", hairColor: 4 },
        }),
      );

      const { explorer, reports } = await startExplorer();

      expect(drawnLook(explorer.appearance.value)).toEqual({
        skinTone: 8,
        hairStyle: DEFAULT_HERO_APPEARANCE.hairStyle,
        hairColor: 4,
      });
      expect(reports.map(({ source }) => source)).toEqual(["unrecognized"]);
    });

    it("falls back to the default look for an answer without a hero list", async () => {
      vi.mocked(api.fetchRunHeroes).mockResolvedValue({ runId: run.id } as never);

      const { explorer } = await startExplorer();

      expect(explorer.status.value).toBe("ready");
      expect(drawnLook(explorer.appearance.value)).toEqual(DEFAULT_HERO_APPEARANCE);
    });
  });

  describe("CA4 — the run never depends on the hero's look", () => {
    it("loads the run with the default look when the request fails", async () => {
      vi.mocked(api.fetchRunHeroes).mockRejectedValue(
        new GatewayError(503, { code: "unavailable", message: "Player is down" }),
      );

      const { explorer, reports } = await startExplorer();

      expect(explorer.status.value).toBe("ready");
      expect(explorer.errorMessage.value).toBeNull();
      expect(drawnLook(explorer.appearance.value)).toEqual(DEFAULT_HERO_APPEARANCE);
      expect(reports.map(({ source }) => source)).toEqual(["unavailable"]);
    });

    it("stops waiting after the timeout, cancels the request and shows the run", async () => {
      vi.useFakeTimers();
      let signal: AbortSignal | undefined;
      vi.mocked(api.fetchRunHeroes).mockImplementation(
        (_runId, abortSignal) =>
          new Promise((_resolve, reject) => {
            signal = abortSignal;
            abortSignal?.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      );
      const reports: HeroAppearanceReport[] = [];
      const explorer = useDungeonExplorer(run.id, {
        onHeroAppearance: (report) => reports.push(report),
      });

      const started = explorer.start();
      await vi.advanceTimersByTimeAsync(HERO_APPEARANCE_TIMEOUT_MS - 1);
      expect(explorer.status.value).toBe("loading");

      await vi.advanceTimersByTimeAsync(1);
      await started;

      expect(signal?.aborted).toBe(true);
      expect(explorer.status.value).toBe("ready");
      expect(drawnLook(explorer.appearance.value)).toEqual(DEFAULT_HERO_APPEARANCE);
      expect(reports.map(({ source }) => source)).toEqual(["unavailable"]);
    });

    it("still reports the run's own error when the run cannot be read", async () => {
      vi.mocked(api.fetchRunHeroes).mockResolvedValue(heroesAnswer({}));
      vi.mocked(api.joinDungeon).mockRejectedValue(
        new GatewayError(404, { code: "notFound", message: "Unknown run" }),
      );

      const { explorer } = await startExplorer();

      expect(explorer.status.value).toBe("error");
    });

    it("cancels the request and ignores a late answer once the page is left", async () => {
      let answer: (value: DungeonRunHeroesResponse) => void = () => {};
      let signal: AbortSignal | undefined;
      vi.mocked(api.fetchRunHeroes).mockImplementation(
        (_runId, abortSignal) =>
          new Promise((resolve) => {
            signal = abortSignal;
            answer = resolve;
          }),
      );
      const reports: HeroAppearanceReport[] = [];
      const explorer = useDungeonExplorer(run.id, {
        onHeroAppearance: (report) => reports.push(report),
      });

      const started = explorer.start();
      explorer.dispose();
      answer(
        heroesAnswer({ appearance: { skinTone: 9, hairStyle: "dap1", hairColor: 2 } }),
      );
      await started;

      expect(signal?.aborted).toBe(true);
      expect(explorer.appearanceSource.value).toBe("pending");
      expect(drawnLook(explorer.appearance.value)).toEqual(DEFAULT_HERO_APPEARANCE);
      expect(reports).toEqual([]);
    });
  });
});
