import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEADERBOARD_API_KEY } from "../api/leaderboardSource";
import { createSimulatedLeaderboardApi } from "../api/simulatedLeaderboardApi";
import HeroStatisticsView from "../components/HeroStatisticsView.vue";
import LeaderboardView from "../components/LeaderboardView.vue";
import { STATISTICS_CATALOGUE } from "../statisticsCatalogue";
import { MockScenario, type LeaderboardApi } from "../types";
import { GatewayError } from "~/shared/utils/gateway";
import { SIMULATED_PLAYER_ID } from "~/features/leaderboard/simulatedIdentity";

const stubs = {
  NuxtLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
  UiIconButton: true,
};

afterEach(() => vi.unstubAllGlobals());

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
  it("identifies values seeded in the backend as demonstration data", async () => {
    const api = simulated(MockScenario.PLAYED);
    const response = await api.getHeroStatistics("p", "h");
    vi.spyOn(api, "getHeroStatistics").mockResolvedValue({ ...response, isDemo: true });
    const wrapper = mountWith(HeroStatisticsView, { playerId: "p", heroId: "h" }, api);
    await settle();

    expect(wrapper.text()).toContain(
      "Demonstration statistics seeded in the leaderboard backend.",
    );
  });

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
  it("opens the selected Player hero instead of a seeded ranking hero", async () => {
    const navigate = vi.fn();
    vi.stubGlobal("navigateTo", navigate);
    const selectedHeroId = "00000000-0000-0000-0000-000000000103";
    const wrapper = mountWith(
      LeaderboardView,
      { currentPlayerId: "me", progressionHeroId: selectedHeroId },
      simulated(MockScenario.PLAYED),
    );
    await settle();

    await wrapper.findAll('[role="tab"]')[1]!.trigger("click");
    expect(navigate).toHaveBeenCalledWith(
      `/players/me/heroes/${selectedHeroId}/statistics`,
    );
  });

  it("disables progression when Player has no hero, even if the ranking has demo rows", async () => {
    const wrapper = mountWith(
      LeaderboardView,
      { currentPlayerId: "me", progressionHeroId: null },
      simulated(MockScenario.PLAYED),
    );
    await settle();
    expect(wrapper.findAll('[role="tab"]')[1]!.attributes("disabled")).toBeDefined();
  });

  it("shows the authenticated name instead of the seeded ranking owner", async () => {
    const wrapper = mountWith(
      LeaderboardView,
      { currentPlayerId: SIMULATED_PLAYER_ID, currentPlayerName: "demo" },
      simulated(MockScenario.PLAYED),
    );
    await settle();

    expect(wrapper.text()).toContain("Signed in as demo");
    expect(wrapper.text()).not.toContain("Signed in as MaelisRune");
  });

  it("shows the first page, my hero, the consolidation age and Refresh view", async () => {
    const api = simulated(MockScenario.PLAYED);
    const spy = vi.spyOn(api, "getRanking");
    const wrapper = mountWith(
      LeaderboardView,
      { currentPlayerId: SIMULATED_PLAYER_ID },
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
      .find((b) => b.text() === "Refresh view")!
      .trigger("click");
    await settle();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it.each([MockScenario.LAGGING, MockScenario.REBUILDING, MockScenario.FROZEN])(
    "keeps the table readable in the %s scenario",
    async (scenario) => {
      const wrapper = mountWith(
        LeaderboardView,
        { currentPlayerId: SIMULATED_PLAYER_ID },
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
