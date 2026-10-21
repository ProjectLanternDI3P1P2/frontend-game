import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { LEADERBOARD_API_KEY } from "../api/leaderboardSource";
import { createSimulatedLeaderboardApi } from "../api/simulatedLeaderboardApi";
import HeroStatisticsView from "../components/HeroStatisticsView.vue";
import LeaderboardView from "../components/LeaderboardView.vue";
import { STATISTICS_CATALOGUE } from "../statisticsCatalogue";
import { MockScenario, type LeaderboardApi } from "../types";
import { GatewayError } from "~/shared/utils/gateway";
import { SEEDED_PLAYER_ID } from "~/features/player/seededPlayer";

const stubs = {
  NuxtLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
  UiIconButton: true,
};

function mountWith(component: object, props: object, api: LeaderboardApi) {
  return mount(component, {
    props,
    global: { stubs, provide: { [LEADERBOARD_API_KEY as symbol]: api } },
  });
}

/** Lets the simulated delay (a 0 ms timer) elapse, then renders. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1));
  await flushPromises();
}

function simulated(scenario: MockScenario) {
  return createSimulatedLeaderboardApi({ scenario, delayMs: 0 });
}

describe("HeroStatisticsView", () => {
  it("announces loading, then shows every catalogue statistic by category", async () => {
    const wrapper = mountWith(
      HeroStatisticsView,
      { playerId: "p", heroId: "h" },
      simulated(MockScenario.PLAYED),
    );

    expect(wrapper.get('[aria-live="polite"]').text()).toBe("Loading statistics…");
    await settle();

    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.findAll("h2").map((h) => h.text())).toEqual([
      "Games",
      "Dungeon",
      "Combat",
      "Rewards",
    ]);
    expect(wrapper.findAll(".ui-stat")).toHaveLength(STATISTICS_CATALOGUE.length);
    expect(wrapper.findAll('ul[role="list"]')).toHaveLength(4);
    expect(wrapper.text()).toContain("Updated 3 min ago");
    expect(wrapper.get("a").attributes("href")).toBe("/players/p/heroes/h");
  });

  it("shows zeros and no error for a hero who never played", async () => {
    const wrapper = mountWith(
      HeroStatisticsView,
      { playerId: "p", heroId: "h" },
      simulated(MockScenario.EMPTY),
    );
    await settle();

    const values = wrapper.findAll(".ui-stat__value").map((v) => v.text());
    expect(values).toHaveLength(STATISTICS_CATALOGUE.length);
    expect(values.every((value) => value === "0")).toBe(true);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("mentions a running consolidation discreetly", async () => {
    const wrapper = mountWith(
      HeroStatisticsView,
      { playerId: "p", heroId: "h" },
      simulated(MockScenario.CONSOLIDATING),
    );
    await settle();

    expect(wrapper.text()).toContain("being consolidated");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.findAll(".ui-stat")).toHaveLength(STATISTICS_CATALOGUE.length);
  });

  it("shows an alert with Retry, which reads again", async () => {
    const api = simulated(MockScenario.ERROR);
    const spy = vi.spyOn(api, "getHeroStatistics");
    const wrapper = mountWith(HeroStatisticsView, { playerId: "p", heroId: "h" }, api);
    await settle();

    expect(wrapper.get('[role="alert"]').text()).toContain("could not be loaded");
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Retry")!
      .trigger("click");
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("LeaderboardLoadState", () => {
  it("keeps the live region in the tree and shows Retry for an empty Gateway message", async () => {
    const api = createSimulatedLeaderboardApi({ delayMs: 0 });
    vi.spyOn(api, "getRanking").mockRejectedValue(
      new GatewayError(500, { code: "X", message: "" }),
    );
    const wrapper = mountWith(LeaderboardView, { currentPlayerId: "me" }, api);
    await settle();

    const live = wrapper.get('[aria-live="polite"]');
    expect(live.isVisible()).toBe(true);
    expect(live.classes()).toContain("visually-hidden");
    expect(wrapper.get('[role="alert"]').text()).toContain("Check your connection");
    expect(wrapper.findAll("button").some((b) => b.text() === "Retry")).toBe(true);
  });
});

describe("LeaderboardView", () => {
  it("shows the first page, my hero, the consolidation age and Refresh", async () => {
    const api = simulated(MockScenario.PLAYED);
    const spy = vi.spyOn(api, "getRanking");
    const wrapper = mountWith(
      LeaderboardView,
      { currentPlayerId: SEEDED_PLAYER_ID },
      api,
    );
    await settle();

    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.findAll("tbody tr")).toHaveLength(10);
    const mine = wrapper.get('tr[aria-current="true"]');
    expect(mine.text()).toContain("You");
    expect(mine.find("td").text()).toBe("7");
    expect(wrapper.text()).toContain("Updated 3 min ago");

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Refresh")!
      .trigger("click");
    await settle();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it.each([MockScenario.LAGGING, MockScenario.REBUILDING, MockScenario.FROZEN])(
    "keeps the table readable in the %s scenario",
    async (scenario) => {
      const wrapper = mountWith(
        LeaderboardView,
        { currentPlayerId: SEEDED_PLAYER_ID },
        simulated(scenario),
      );
      await settle();

      expect(wrapper.findAll("tbody tr")).toHaveLength(10);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    },
  );

  it("explains an empty leaderboard without an error", async () => {
    const wrapper = mountWith(
      LeaderboardView,
      { currentPlayerId: "me" },
      simulated(MockScenario.EMPTY),
    );
    await settle();

    expect(wrapper.find("table").exists()).toBe(false);
    expect(wrapper.text()).toContain("No hero has been ranked yet");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("shows an alert with Retry on failure", async () => {
    const wrapper = mountWith(
      LeaderboardView,
      { currentPlayerId: "me" },
      simulated(MockScenario.ERROR),
    );
    await settle();

    expect(wrapper.get('[role="alert"]').text()).toContain("could not be loaded");
    expect(wrapper.findAll("button").some((b) => b.text() === "Retry")).toBe(true);
  });
});
