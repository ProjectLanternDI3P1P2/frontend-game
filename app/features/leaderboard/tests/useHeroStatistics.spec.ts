import { describe, expect, it, vi } from "vitest";
import { GENERIC_LOAD_ERROR } from "../composables/loadError";
import { useHeroStatistics } from "../composables/useHeroStatistics";
import { LoadStatus } from "../types";
import { GatewayError } from "~/shared/utils/gateway";
import { apiStub, heroStatistics, NOW } from "./fixtures/leaderboardFixtures";

describe("useHeroStatistics", () => {
  it("starts loading, then exposes grouped values and the consolidation age", async () => {
    const api = apiStub();
    const state = useHeroStatistics("player-1", "hero-1", { api, now: () => NOW });

    expect(state.status.value).toBe(LoadStatus.LOADING);
    await state.load();

    expect(api.getHeroStatistics).toHaveBeenCalledWith(
      "player-1",
      "hero-1",
      expect.any(AbortSignal),
    );
    expect(state.status.value).toBe(LoadStatus.READY);
    expect(state.groups.value[0]?.statistics[0]).toMatchObject({
      key: "games_played",
      value: 12,
    });
    expect(state.consolidation.value).toEqual({
      consolidatedAt: "2026-10-21T11:57:00Z",
      label: "Updated 3 min ago",
      isConsolidating: false,
    });
  });

  it("is ready with zeros, not empty nor in error, for a hero who never played", async () => {
    const api = apiStub({
      getHeroStatistics: vi
        .fn()
        .mockResolvedValue(heroStatistics({ consolidatedAt: null, statistics: [] })),
    });
    const state = useHeroStatistics("p", "h", { api });
    await state.load();

    expect(state.status.value).toBe(LoadStatus.READY);
    expect(
      state.groups.value
        .flatMap((group) => group.statistics)
        .every((s) => s.value === 0),
    ).toBe(true);
    expect(state.consolidation.value?.label).toBe("Not consolidated yet");
  });

  it("keeps showing figures while a consolidation runs", async () => {
    const api = apiStub({
      getHeroStatistics: vi
        .fn()
        .mockResolvedValue(heroStatistics({ isConsolidating: true })),
    });
    const state = useHeroStatistics("p", "h", { api });
    await state.load();

    expect(state.status.value).toBe(LoadStatus.READY);
    expect(state.consolidation.value?.isConsolidating).toBe(true);
  });

  it("reports a failure, then recovers on retry by reading again", async () => {
    const api = apiStub({
      getHeroStatistics: vi
        .fn()
        .mockRejectedValueOnce(
          new GatewayError(503, { code: "DOWN", message: "Service unavailable." }),
        )
        .mockResolvedValueOnce(heroStatistics()),
    });
    const state = useHeroStatistics("p", "h", { api });

    await state.load();
    expect(state.status.value).toBe(LoadStatus.ERROR);
    expect(state.errorMessage.value).toBe("Service unavailable.");

    await state.retry();
    expect(api.getHeroStatistics).toHaveBeenCalledTimes(2);
    expect(state.status.value).toBe(LoadStatus.READY);
    expect(state.errorMessage.value).toBe("");
  });

  it("never leaves the error message empty, even for a Gateway error without one", async () => {
    const api = apiStub({
      getHeroStatistics: vi
        .fn()
        .mockRejectedValue(new GatewayError(500, { code: "X", message: "  " })),
    });
    const state = useHeroStatistics("p", "h", { api });
    await state.load();

    expect(state.status.value).toBe(LoadStatus.ERROR);
    expect(state.errorMessage.value).toBe(GENERIC_LOAD_ERROR);
  });

  it("ignores the answer of a superseded request", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    const api = apiStub({
      getHeroStatistics: vi
        .fn()
        .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
        .mockResolvedValueOnce(heroStatistics({ statistics: [] })),
    });
    const state = useHeroStatistics("p", "h", { api });

    const first = state.load();
    await state.load();
    resolveFirst(heroStatistics());
    await first;

    expect(state.groups.value[0]?.statistics[0]?.value).toBe(0);
  });
});
