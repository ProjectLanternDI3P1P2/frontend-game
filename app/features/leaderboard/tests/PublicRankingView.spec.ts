import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createSimulatedLeaderboardApi } from "../api/simulatedLeaderboardApi";
import PublicRankingView from "../components/PublicRankingView.vue";
import {
  LOADING_PUBLIC_RANKING,
  loadPublicRanking,
  type PublicRankingState,
} from "../composables/usePublicRanking";
import { LoadStatus, MockScenario } from "../types";

const NOW = new Date("2026-10-21T12:00:00Z");

const stubs = {
  NuxtLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
  UiIconButton: true,
};

function render(state: PublicRankingState, refreshing = false) {
  return mount(PublicRankingView, {
    props: { state, refreshing },
    global: { stubs },
  });
}

async function stateFor(scenario: MockScenario): Promise<PublicRankingState> {
  return loadPublicRanking(
    createSimulatedLeaderboardApi({ scenario, delayMs: 0, now: () => NOW }),
  );
}

describe("PublicRankingView", () => {
  it("assembles header, podium, leaders and top 10 when ready", async () => {
    const wrapper = render(await stateFor(MockScenario.PLAYED));
    expect(wrapper.get("h1").text()).toBe("Rankings · Season 3");
    expect(wrapper.find(".public-podium").exists()).toBe(true);
    expect(wrapper.find(".public-class-leaders").exists()).toBe(true);
    expect(wrapper.find(".public-top-table").exists()).toBe(true);
    expect(wrapper.findAll("h2").map((h) => h.text())).toEqual([
      "Podium",
      "Season 3 leaders by class",
      "Top 10",
    ]);
  });

  it("announces loading, without heading suffix, freshness or sections", () => {
    const wrapper = render({ ...LOADING_PUBLIC_RANKING });
    expect(wrapper.get("h1").text()).toBe("Rankings");
    expect(wrapper.get('[aria-live="polite"]').text()).toBe("Loading rankings…");
    expect(wrapper.find(".public-ranking__meta").exists()).toBe(false);
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("shows « Not consolidated yet » for an invalid consolidation date", async () => {
    const ready = await stateFor(MockScenario.PLAYED);
    const wrapper = render({
      ...ready,
      ranking: { ...ready.ranking!, consolidatedAt: "garbage" },
    });
    expect(wrapper.get(".public-ranking__meta").text()).toContain(
      "Not consolidated yet",
    );
    expect(wrapper.find("time").exists()).toBe(false);
  });

  it("shows the empty state with the season and 0 ranked heroes", async () => {
    const wrapper = render(await stateFor(MockScenario.EMPTY));
    expect(wrapper.get(".public-ranking__empty").text()).toContain("No ranked run yet");
    expect(wrapper.text()).toContain("0 ranked heroes");
    expect(wrapper.find(".public-podium").exists()).toBe(false);
  });

  it("shows the error with Retry, which is emitted", async () => {
    const wrapper = render({
      status: LoadStatus.ERROR,
      ranking: null,
      errorMessage: "Leaderboard unavailable",
    });
    expect(wrapper.get('[role="alert"]').text()).toContain("Leaderboard unavailable");
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Retry")!
      .trigger("click");
    expect(wrapper.emitted("retry")).toHaveLength(1);
  });

  it("announces a refresh over the error", () => {
    const wrapper = render(
      { status: LoadStatus.ERROR, ranking: null, errorMessage: "x" },
      true,
    );
    expect(wrapper.get('[aria-live="polite"]').text()).toBe("Refreshing rankings…");
  });
});
