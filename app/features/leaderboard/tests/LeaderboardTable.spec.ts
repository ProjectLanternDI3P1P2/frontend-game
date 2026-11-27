import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import LeaderboardTable from "../components/LeaderboardTable.vue";
import { entry, ME, NOW } from "./fixtures/leaderboardFixtures";

function mountTable(myRanks: number[] = [], props: Record<string, unknown> = {}) {
  const entries = Array.from({ length: 10 }, (_, index) =>
    entry(index + 1, myRanks.includes(index + 1) ? ME : undefined),
  );
  return mount(LeaderboardTable, {
    props: { entries, currentPlayerId: ME, caption: "Ranking", now: NOW, ...props },
  });
}

describe("LeaderboardTable", () => {
  it("renders a semantic table with every ranking column", () => {
    const wrapper = mountTable();

    const headers = wrapper.findAll("thead th");
    expect(headers.map((th) => th.text())).toEqual([
      "Rank",
      "Trend",
      "Player",
      "Hero",
      "Class",
      "Level",
      "Total XP",
      "Runs",
      "Win rate",
      "Last activity",
    ]);
    expect(headers.every((th) => th.attributes("scope") === "col")).toBe(true);
    expect(wrapper.find("caption").text()).toBe("Ranking");
    expect(wrapper.findAll("tbody tr")).toHaveLength(10);
    const first = wrapper.find("tbody tr");
    expect(first.text()).toContain("Hero 1");
    expect(first.text()).toContain("9,999");
    expect(first.text()).toContain("50%");
    expect(first.text()).toContain("3 min ago");
  });

  it("marks each of my heroes with 'You', and only the target line with aria-current", () => {
    const wrapper = mountTable([3, 7], { targetHeroId: "hero-3" });

    const mine = wrapper
      .findAll("tbody tr")
      .filter((row) => row.text().includes("You"));
    expect(mine.map((row) => row.find("td").text())).toEqual(["3", "7"]);
    const current = wrapper.findAll('tbody tr[aria-current="true"]');
    expect(current).toHaveLength(1);
    expect(current[0]!.find("td").text()).toBe("3");
    expect(wrapper.find("tbody tr[tabindex]").exists()).toBe(false);
  });

  it("never takes a deleted player's hero for mine", () => {
    const wrapper = mount(LeaderboardTable, {
      props: { entries: [entry(1, null)], currentPlayerId: "", caption: "Ranking" },
    });

    expect(wrapper.text()).toContain("Anonymous hero");
    expect(wrapper.text()).not.toContain("You");
  });

  it("pins my heroes in the foot after the separator", () => {
    const wrapper = mountTable([], { pinned: [entry(58, ME)] });

    const foot = wrapper.get("tfoot");
    expect(foot.text()).toContain("47 positions between rank 10 and yours");
    expect(foot.text()).toContain("Hero 58");
    expect(foot.text()).toContain("You");
  });

  it("emits toggle from a line click and from its toggle button, once each", async () => {
    const wrapper = mountTable();

    await wrapper.findAll("tbody tr")[1]!.trigger("click");
    await wrapper.get('[data-hero-id="hero-3"]').trigger("click");

    expect(wrapper.emitted("toggle")).toEqual([["hero-2"], ["hero-3"]]);
  });

  it("only scrolls the table, as a keyboard-reachable named region", () => {
    const wrapper = mountTable();
    const region = wrapper.get('[role="region"]');

    expect(region.attributes("aria-label")).toBe("Ranking");
    expect(region.attributes("tabindex")).toBe("0");
  });
});
