import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { useLeaderboard } from "../composables/useLeaderboard";
import { EmptyReason } from "../rankingViewRules";
import { HeroClass, LoadStatus, RankingSort } from "../types";
import {
  apiStub,
  entry,
  ME,
  NOW,
  query,
  ranking,
} from "./fixtures/leaderboardFixtures";

describe("useLeaderboard", () => {
  it("loads the requested page with the consolidation age", async () => {
    const api = apiStub();
    const state = useLeaderboard(query(), { api, now: () => NOW });

    expect(state.status.value).toBe(LoadStatus.LOADING);
    await state.load();

    expect(api.getRanking).toHaveBeenCalledWith(query(), expect.any(AbortSignal));
    expect(state.status.value).toBe(LoadStatus.READY);
    expect(state.entries.value).toHaveLength(10);
    expect(state.ranking.value?.totalCount).toBe(42);
    expect(state.consolidation.value?.label).toBe("Updated 3 min ago");
  });

  it("exposes my heroes as the backend sent them", async () => {
    const mine = [entry(7, ME), entry(58, ME)];
    const api = apiStub({
      getRanking: vi.fn().mockResolvedValue(ranking({ me: mine })),
    });
    const state = useLeaderboard(query(), { api });
    await state.load();

    expect(state.me.value).toEqual(mine);
  });

  it("is empty, not in error, when nobody is ranked", async () => {
    const api = apiStub({
      getRanking: vi
        .fn()
        .mockResolvedValue(
          ranking({ entries: [], totalCount: 0, consolidatedAt: null }),
        ),
    });
    const state = useLeaderboard(query(), { api });
    await state.load();

    expect(state.status.value).toBe(LoadStatus.EMPTY);
    expect(state.errorMessage.value).toBe("");
    expect(state.consolidation.value?.label).toBe("Not consolidated yet");
  });

  it("treats a null body as empty and a page past the end as ready", async () => {
    const api = apiStub({
      getRanking: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(ranking({ entries: [], page: 9 })),
    });
    const state = useLeaderboard(query(), { api });

    await state.load();
    expect(state.status.value).toBe(LoadStatus.EMPTY);
    expect(state.entries.value).toEqual([]);

    await state.load();
    expect(state.status.value).toBe(LoadStatus.READY);
  });

  it("reads again when the query changes", async () => {
    const api = apiStub();
    const current = ref(query());
    const state = useLeaderboard(current, { api });
    await state.load();

    current.value = { ...current.value, heroClass: HeroClass.MAGE, page: 1 };
    await nextTick();

    expect(api.getRanking).toHaveBeenCalledTimes(2);
    expect(api.getRanking).toHaveBeenLastCalledWith(
      query({ heroClass: HeroClass.MAGE }),
      expect.any(AbortSignal),
    );
  });

  it("ignores an answer that arrives after a newer request", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    const api = apiStub({
      getRanking: vi
        .fn()
        .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
        .mockResolvedValueOnce(ranking({ totalCount: 2 })),
    });
    const state = useLeaderboard(query(), { api });

    const first = state.load();
    await state.load();
    resolveFirst(ranking({ totalCount: 99 }));
    await first;

    expect(state.ranking.value?.totalCount).toBe(2);
  });

  it("keeps the table on screen while refreshing, then shows the new reading", async () => {
    let resolveRefresh: (value: unknown) => void = () => {};
    const api = apiStub({
      getRanking: vi
        .fn()
        .mockResolvedValueOnce(ranking())
        .mockReturnValueOnce(new Promise((resolve) => (resolveRefresh = resolve))),
    });
    const state = useLeaderboard(query(), { api });
    await state.load();

    const refreshing = state.refresh();
    expect(state.refreshing.value).toBe(true);
    expect(state.status.value).toBe(LoadStatus.READY);

    resolveRefresh(ranking({ entries: [entry(1)], totalCount: 1 }));
    await refreshing;
    expect(state.refreshing.value).toBe(false);
    expect(state.entries.value).toHaveLength(1);
  });

  it("reports a failure and retries", async () => {
    const api = apiStub({
      getRanking: vi
        .fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(ranking()),
    });
    const state = useLeaderboard(query(), { api });

    await state.load();
    expect(state.status.value).toBe(LoadStatus.ERROR);
    expect(state.hasData.value).toBe(false);
    expect(state.errorMessage.value).not.toBe("");

    await state.retry();
    expect(state.status.value).toBe(LoadStatus.READY);
  });

  it("does not read again when the query is re-evaluated unchanged", async () => {
    const api = apiStub();
    const current = ref(query());
    const state = useLeaderboard(() => ({ ...current.value }), { api });
    await state.load();

    current.value = query();
    await nextTick();

    expect(api.getRanking).toHaveBeenCalledTimes(1);
  });

  it("tells nobody ranked from nothing matching the filters", async () => {
    const api = apiStub({
      getRanking: vi.fn().mockResolvedValue(ranking({ entries: [], totalCount: 0 })),
    });
    const nobody = useLeaderboard(query(), { api });
    await nobody.load();
    expect(nobody.emptyReason.value).toBe(EmptyReason.NOBODY_RANKED);

    const filtered = useLeaderboard(query({ search: "zzz" }), { api });
    await filtered.load();
    expect(filtered.emptyReason.value).toBe(EmptyReason.NO_MATCH);

    const ready = useLeaderboard(query(), { api: apiStub() });
    await ready.load();
    expect(ready.emptyReason.value).toBeNull();
  });

  it("computes the page of a rank without filter, probes it with one", async () => {
    const plain = useLeaderboard(query({ sort: RankingSort.LEVEL }), {
      api: apiStub(),
    });
    expect(await plain.findPageOfRank(58)).toBe(6);

    const byPage = (page: number) =>
      ranking({
        page,
        totalCount: 50,
        entries: Array.from({ length: 10 }, (_, i) =>
          entry((page - 1) * 30 + i * 3 + 1),
        ),
      });
    const api = apiStub({
      getRanking: vi.fn().mockImplementation(async (q) => byPage(q.page)),
    });
    const filtered = useLeaderboard(query({ heroClass: HeroClass.SHAMAN }), { api });
    await filtered.load();

    expect(await filtered.findPageOfRank(64)).toBe(3);
    for (const [request] of api.getRanking.mock.calls) {
      expect(request.sort).toBe(RankingSort.TOTAL_XP);
      expect(request.heroClass).toBe(HeroClass.SHAMAN);
    }
  });
});
