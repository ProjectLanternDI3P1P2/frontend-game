import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEADERBOARD_API_KEY } from "../api/leaderboardSource";
import RankingRowDetail from "../components/RankingRowDetail.vue";
import type { LeaderboardApi } from "../types";
import { apiStub } from "./fixtures/leaderboardFixtures";
import { heroDetail } from "./fixtures/rankingDetailFixtures";

const stubs = {
  NuxtLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
  UiIconButton: true,
};

function mountDetail(api: LeaderboardApi, currentPlayerId = "me") {
  return mount(RankingRowDetail, {
    props: { heroId: "hero-1", currentPlayerId },
    global: { stubs, provide: { [LEADERBOARD_API_KEY as symbol]: api } },
    attachTo: document.body,
  });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("RankingRowDetail", () => {
  it("reads the detail of its hero and emits nothing", async () => {
    const api = apiStub({
      getRankingHeroDetail: vi.fn().mockResolvedValue(heroDetail()),
    });
    const wrapper = mountDetail(api);
    await flushPromises();

    expect(api.getRankingHeroDetail).toHaveBeenCalledWith(
      "hero-1",
      expect.any(AbortSignal),
    );
    expect(api.getRankingHeroFacts).not.toHaveBeenCalled();
    expect(wrapper.emitted()).toEqual({});
  });

  it("badges my own hero with the text 'You'", async () => {
    const api = apiStub({
      getRankingHeroDetail: vi.fn().mockResolvedValue(heroDetail({ playerId: "me" })),
    });
    const wrapper = mountDetail(api, "me");
    await flushPromises();

    expect(wrapper.get(".ranking-row-detail__header").text()).toContain("You");
  });

  it("caps the runs at four", async () => {
    const run = heroDetail().lastRuns[0]!;
    const api = apiStub({
      getRankingHeroDetail: vi
        .fn()
        .mockResolvedValue(heroDetail({ lastRuns: [run, run, run, run, run] })),
    });
    const wrapper = mountDetail(api);
    await flushPromises();

    expect(wrapper.findAll(".ranking-row-detail__run")).toHaveLength(4);
  });

  it("retries the detail after a failure", async () => {
    const getRankingHeroDetail = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(heroDetail());
    const wrapper = mountDetail(apiStub({ getRankingHeroDetail }));
    await flushPromises();

    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Hero · Brakka");
  });
});
