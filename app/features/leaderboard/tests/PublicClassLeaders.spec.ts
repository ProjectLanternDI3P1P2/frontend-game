import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import PublicClassLeaders from "../components/PublicClassLeaders.vue";
import { HeroClass } from "../types";
import { entry } from "./fixtures/leaderboardFixtures";

describe("PublicClassLeaders", () => {
  const leaders = [
    {
      heroClass: HeroClass.WARRIOR,
      entry: entry(1, "p-1", { heroName: "Brann", level: 48, totalXp: 98_450 }),
    },
    {
      heroClass: HeroClass.SHAMAN,
      entry: entry(4, null, { heroName: "Kael", heroClass: HeroClass.SHAMAN }),
    },
    { heroClass: HeroClass.MAGE, entry: null },
  ];

  function render() {
    return mount(PublicClassLeaders, { props: { seasonLabel: "Season 3", leaders } });
  }

  it("titles the section with the season", () => {
    expect(render().get("h2").text()).toBe("Season 3 leaders by class");
  });

  it("shows one card per class with its leader", () => {
    const cards = render().findAll('ul[role="list"] > li');
    expect(cards.map((c) => c.get("h3").text())).toEqual(["Warrior", "Shaman", "Mage"]);
    expect(cards[0]!.text()).toContain("Brann");
    expect(cards[0]!.text()).toContain("Player 1 · Rank 1 · Level 48");
    expect(cards[0]!.text()).toContain("98,450 XP");
    expect(cards[1]!.text()).toContain("Anonymous hero");
  });

  it("reads « No ranked hero yet » for a class without leader", () => {
    const mage = render().findAll("li")[2]!;
    expect(mage.text()).toContain("No ranked hero yet");
    expect(mage.text()).not.toMatch(/null|undefined/);
  });

  it("still shows every class when the response leaves one out, or all", () => {
    for (const partial of [leaders.slice(0, 1), []]) {
      const cards = mount(PublicClassLeaders, {
        props: { seasonLabel: "Season 3", leaders: partial },
      }).findAll("li");
      expect(cards.map((c) => c.get("h3").text())).toEqual([
        "Warrior",
        "Shaman",
        "Mage",
      ]);
      expect(cards.at(-1)!.text()).toContain("No ranked hero yet");
    }
  });
});
