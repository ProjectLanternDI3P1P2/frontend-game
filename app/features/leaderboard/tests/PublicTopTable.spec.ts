import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import PublicTopTable from "../components/PublicTopTable.vue";
import { HeroClass } from "../types";
import { entry } from "./fixtures/leaderboardFixtures";

describe("PublicTopTable", () => {
  const top = [
    entry(1, "p-1", { rankDelta: 3, heroName: "Brann", totalXp: 98_450, level: 48 }),
    entry(2, null, { rankDelta: -1, heroClass: HeroClass.MAGE }),
    entry(3, "p-3", { rankDelta: 0 }),
    entry(4, "p-4", { rankDelta: null }),
  ];

  function render() {
    return mount(PublicTopTable, { props: { entries: top } });
  }

  it("has a caption and column headers scoped to their column", () => {
    const wrapper = render();
    expect(wrapper.get("h2").text()).toBe("Top 10");
    expect(wrapper.get("caption").text()).toContain("Top 10 heroes");
    const headers = wrapper.findAll("thead th");
    expect(headers.map((th) => th.text())).toEqual([
      "Rank",
      "Trend",
      "Player",
      "Hero",
      "Class",
      "Level",
      "Total XP",
    ]);
    expect(headers.every((th) => th.attributes("scope") === "col")).toBe(true);
  });

  it("renders one row per hero, the hero name as row header", () => {
    const rows = render().findAll("tbody tr");
    expect(rows).toHaveLength(4);
    const cells = rows[0]!.findAll("td, th").map((c) => c.text());
    expect(cells[0]).toBe("1");
    expect(cells[2]).toBe("Player 1");
    expect(cells.slice(3)).toEqual(["Brann", "Warrior", "48", "98,450"]);
    expect(rows[0]!.get('th[scope="row"]').text()).toBe("Brann");
    expect(rows[1]!.findAll("td")[2]!.text()).toBe("Anonymous hero");
  });

  it("shows the trend arrow and spells it out for screen readers", () => {
    const trends = render().findAll(".public-top-table__trend");
    expect(trends.map((t) => t.get('[aria-hidden="true"]').text())).toEqual([
      "▲ 3",
      "▼ 1",
      "— 0",
      "NEW",
    ]);
    expect(trends.map((t) => t.get(".visually-hidden").text())).toEqual([
      "Up 3 places",
      "Down 1 place",
      "No change",
      "New in the ranking",
    ]);
    expect(trends[0]!.classes()).toContain("public-top-table__trend--up");
  });
});
