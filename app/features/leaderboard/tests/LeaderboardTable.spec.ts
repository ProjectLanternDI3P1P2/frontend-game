import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import LeaderboardTable from "../components/LeaderboardTable.vue";
import { buildLeaderboardView } from "../leaderboardRules";
import { entry, leaderboard, ME } from "./fixtures/leaderboardFixtures";

function mountTable(meRank: number) {
  const me = entry(meRank, ME);
  const entries = Array.from({ length: 50 }, (_, index) =>
    index + 1 === meRank ? me : entry(index + 1),
  );
  const view = buildLeaderboardView(leaderboard({ entries, me }), ME);
  return mount(LeaderboardTable, {
    props: { rows: view.rows, pinnedMe: view.pinnedMe },
    attachTo: document.body,
  });
}

describe("LeaderboardTable", () => {
  it("renders a semantic table of rank, player and score", () => {
    const wrapper = mountTable(7);

    expect(wrapper.findAll("thead th").map((th) => th.text())).toEqual([
      "Rank",
      "Player",
      "Score",
    ]);
    expect(wrapper.findAll("tbody tr")).toHaveLength(50);
    expect(wrapper.find("tbody tr").text()).toContain("Player 1");
    wrapper.unmount();
  });

  it("marks my line with a 'You' badge and aria-current, not only a colour", () => {
    const wrapper = mountTable(7);
    const mine = wrapper.findAll('tbody tr[aria-current="true"]');

    expect(mine).toHaveLength(1);
    expect(mine[0]!.text()).toContain("You");
    expect(mine[0]!.text()).toContain("7");
    expect(wrapper.find(".leaderboard-table__pinned").exists()).toBe(false);
    wrapper.unmount();
  });

  it("scrolls to my line and focuses it on 'Show my position'", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const wrapper = mountTable(30);

    const button = wrapper
      .findAll("button")
      .find((b) => b.text() === "Show my position");
    await button!.trigger("click");

    const mine = wrapper.get('tbody tr[aria-current="true"]');
    expect(scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(mine.element);
    wrapper.unmount();
  });

  it("pins my line under the table with my real rank outside the top 50", async () => {
    const wrapper = mountTable(132);

    expect(wrapper.findAll("tbody tr")).toHaveLength(50);
    expect(wrapper.find('tbody [aria-current="true"]').exists()).toBe(false);
    const pinned = wrapper.get('.leaderboard-table__pinned[aria-current="true"]');
    expect(pinned.text()).toContain("132");
    expect(pinned.text()).toContain("You");
    expect(pinned.text()).toContain("9,868");

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Show my position")!
      .trigger("click");
    expect(document.activeElement).toBe(pinned.element);
    wrapper.unmount();
  });
});
