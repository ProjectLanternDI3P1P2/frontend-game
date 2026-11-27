import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useRankingHeroDetail } from "../composables/useRankingHeroDetail";
import { GENERIC_LOAD_ERROR } from "../composables/loadError";
import { LoadStatus } from "../types";
import { apiStub } from "./fixtures/leaderboardFixtures";
import { heroDetail } from "./fixtures/rankingDetailFixtures";

describe("useRankingHeroDetail", () => {
  it("loads the detail, then READY", async () => {
    const api = apiStub({
      getRankingHeroDetail: vi.fn().mockResolvedValue(heroDetail()),
    });
    const state = useRankingHeroDetail("hero-1", { api });

    await state.load();

    expect(state.status.value).toBe(LoadStatus.READY);
    expect(state.detail.value?.heroName).toBe("Brakka");
  });

  it("turns a failure or an empty body into ERROR with a readable message", async () => {
    const api = apiStub({ getRankingHeroDetail: vi.fn().mockResolvedValue(null) });
    const state = useRankingHeroDetail("hero-1", { api });

    await state.load();

    expect(state.status.value).toBe(LoadStatus.ERROR);
    expect(state.errorMessage.value).toBe(GENERIC_LOAD_ERROR);
  });

  it("ignores a late answer for a previous hero", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    const getRankingHeroDetail = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValue(heroDetail({ heroName: "Second" }));
    const heroId = ref("hero-1");
    const state = useRankingHeroDetail(heroId, {
      api: apiStub({ getRankingHeroDetail }),
    });

    const first = state.load();
    heroId.value = "hero-2";
    await flushPromises();
    resolveFirst(heroDetail({ heroName: "First" }));
    await first;

    expect(getRankingHeroDetail.mock.calls[0]![1].aborted).toBe(true);
    expect(state.detail.value?.heroName).toBe("Second");
  });
});
