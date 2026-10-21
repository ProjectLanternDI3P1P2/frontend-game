import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import LeaderboardTable from "../components/LeaderboardTable.vue";
import { entry, ME } from "./fixtures/leaderboardFixtures";

function mountTable(...myRanks: number[]) {
  const entries = Array.from({ length: 10 }, (_, index) =>
    entry(index + 1, myRanks.includes(index + 1) ? ME : undefined),
  );
  return mount(LeaderboardTable, { props: { entries, currentPlayerId: ME } });
}

describe("LeaderboardTable", () => {
  it("renders a semantic table of rank, hero and total XP", () => {
    const wrapper = mountTable();

    const headers = wrapper.findAll("thead th");
    expect(headers.map((th) => th.text())).toEqual(["Rank", "Hero", "Total XP"]);
    expect(headers.every((th) => th.attributes("scope") === "col")).toBe(true);
    expect(wrapper.findAll("tbody tr")).toHaveLength(10);
    const first = wrapper.find("tbody tr");
    expect(first.text()).toContain("Hero 1");
    expect(first.text()).toContain("9,999");
  });

  it("marks each of my heroes with a 'You' badge and aria-current, not only a colour", () => {
    const wrapper = mountTable(3, 7);
    const mine = wrapper.findAll('tbody tr[aria-current="true"]');

    expect(mine).toHaveLength(2);
    expect(mine.map((row) => row.find("td").text())).toEqual(["3", "7"]);
    expect(mine.every((row) => row.text().includes("You"))).toBe(true);
    expect(
      wrapper.findAll("tbody tr").filter((row) => row.text().includes("You")),
    ).toHaveLength(2);
  });

  it("never takes a deleted player's hero for mine", () => {
    const wrapper = mount(LeaderboardTable, {
      props: { entries: [entry(1, null)], currentPlayerId: "" },
    });

    expect(wrapper.find('[aria-current="true"]').exists()).toBe(false);
  });
});
