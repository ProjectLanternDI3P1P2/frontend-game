import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import PublicPodium from "../components/PublicPodium.vue";
import { HeroClass } from "../types";
import { entry } from "./fixtures/leaderboardFixtures";

describe("PublicPodium", () => {
  const podium = [
    entry(1, "p-1", {
      heroName: "Brann",
      heroClass: HeroClass.WARRIOR,
      level: 48,
      totalXp: 98_450,
    }),
    entry(2, null, { heroName: "Ysolde", heroClass: HeroClass.MAGE }),
    entry(3, "p-3", { heroName: "Kael", heroClass: HeroClass.SHAMAN }),
  ];

  it("shows one card per hero, in rank order, as an ordered list", () => {
    const wrapper = mount(PublicPodium, { props: { entries: podium } });
    expect(wrapper.get("h2").text()).toBe("Podium");
    expect(wrapper.get("ol").attributes("role")).toBe("list");
    expect(wrapper.findAll("li h3").map((h) => h.text())).toEqual([
      "Brann",
      "Ysolde",
      "Kael",
    ]);
  });

  it("gives each medal a text label and a matching modifier", () => {
    const wrapper = mount(PublicPodium, { props: { entries: podium } });
    const cards = wrapper.findAll("li");
    expect(cards.map((c) => c.get(".public-podium__medal").text())).toEqual([
      "1st · Gold",
      "2nd · Silver",
      "3rd · Bronze",
    ]);
    expect(cards[0]!.classes()).toContain("public-podium__card--gold");
    expect(cards[2]!.classes()).toContain("public-podium__card--bronze");
  });

  it("lists class, level, total XP and player; a deleted player is anonymous", () => {
    const wrapper = mount(PublicPodium, { props: { entries: podium } });
    const [first, second] = wrapper.findAll("li");
    expect(first!.text()).toContain("Warrior");
    expect(first!.text()).toContain("48");
    expect(first!.text()).toContain("98,450");
    expect(first!.text()).toContain("Player 1");
    expect(second!.get(".public-podium__player").text()).toBe("Anonymous hero");
  });

  it("renders fewer cards when fewer heroes are ranked", () => {
    const wrapper = mount(PublicPodium, { props: { entries: podium.slice(0, 1) } });
    expect(wrapper.findAll("li")).toHaveLength(1);
  });
});
