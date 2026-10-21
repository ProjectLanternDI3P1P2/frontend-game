import { describe, expect, it, vi } from "vitest";
import { useLeaderboard } from "../composables/useLeaderboard";
import { LoadStatus } from "../types";
import { apiStub, entry, leaderboard, ME, NOW } from "./fixtures/leaderboardFixtures";

describe("useLeaderboard", () => {
  it("loads the top 50 with the consolidation age", async () => {
    const api = apiStub();
    const state = useLeaderboard(ME, { api, now: () => NOW });

    expect(state.status.value).toBe(LoadStatus.LOADING);
    await state.load();

    expect(api.getLeaderboard).toHaveBeenCalledWith(ME, expect.any(AbortSignal));
    expect(state.status.value).toBe(LoadStatus.READY);
    expect(state.view.value.rows).toHaveLength(50);
    expect(state.consolidation.value?.label).toBe("Updated 3 min ago");
  });

  it("is empty, not in error, when nobody is ranked", async () => {
    const api = apiStub({
      getLeaderboard: vi
        .fn()
        .mockResolvedValue(leaderboard({ entries: [], consolidatedAt: null })),
    });
    const state = useLeaderboard(ME, { api });
    await state.load();

    expect(state.status.value).toBe(LoadStatus.EMPTY);
    expect(state.errorMessage.value).toBe("");
  });

  it("keeps the table on screen while refreshing, then shows the new reading", async () => {
    let resolveRefresh: (value: unknown) => void = () => {};
    const me = entry(87, ME);
    const api = apiStub({
      getLeaderboard: vi
        .fn()
        .mockResolvedValueOnce(leaderboard())
        .mockReturnValueOnce(new Promise((resolve) => (resolveRefresh = resolve))),
    });
    const state = useLeaderboard(ME, { api });
    await state.load();

    const refreshing = state.refresh();
    expect(state.refreshing.value).toBe(true);
    expect(state.status.value).toBe(LoadStatus.READY);

    resolveRefresh(leaderboard({ me }));
    await refreshing;
    expect(state.refreshing.value).toBe(false);
    expect(state.view.value.pinnedMe?.rank).toBe(87);
  });

  it("reports a failure and retries", async () => {
    const api = apiStub({
      getLeaderboard: vi
        .fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(leaderboard()),
    });
    const state = useLeaderboard(ME, { api });

    await state.load();
    expect(state.status.value).toBe(LoadStatus.ERROR);
    expect(state.hasData.value).toBe(false);
    expect(state.errorMessage.value).not.toBe("");

    await state.retry();
    expect(state.status.value).toBe(LoadStatus.READY);
  });
});
