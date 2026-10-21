/**
 * F02 — Page classement /leaderboard complète. Acceptance tests for CA1 to CA9
 * and CA12 (CA10, CA11: next step), and the points F00 left to F02.
 */
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { LEADERBOARD_API_KEY } from "../api/leaderboardSource";
import { createSimulatedLeaderboardApi } from "../api/simulatedLeaderboardApi";
import RankingRowDetail from "../components/RankingRowDetail.vue";
import { defaultRankingQuery } from "../leaderboardRules";
import {
  HeroClass,
  MockScenario,
  RankingPeriod,
  RankingSort,
  type LeaderboardApi,
} from "../types";
import { apiStub, entry, ranking } from "./fixtures/leaderboardFixtures";
import LeaderboardPage from "~/pages/leaderboard.vue";
import { SEEDED_PLAYER_ID } from "~/features/player/seededPlayer";

const ME = SEEDED_PLAYER_ID;
const stubs = {
  NuxtLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
  UiIconButton: true,
};

let route: { params: Record<string, string>; query: Record<string, unknown> };
let navigate: ReturnType<typeof vi.fn>;
const mounted: VueWrapper[] = [];

beforeEach(() => {
  route = reactive({ params: {}, query: {} });
  // Behaves like the router: a query change updates the route.
  navigate = vi.fn((to: unknown) => {
    if (typeof to === "object" && to !== null && "query" in to) {
      route.query = { ...(to as { query: Record<string, unknown> }).query };
    }
  });
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("navigateTo", navigate);
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useHead", vi.fn());
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function simulated(scenario = MockScenario.PLAYED): LeaderboardApi {
  return createSimulatedLeaderboardApi({ scenario, delayMs: 0 });
}

function mountPage(api: LeaderboardApi = simulated()) {
  const wrapper = mount(LeaderboardPage, {
    attachTo: document.body,
    global: { stubs, provide: { [LEADERBOARD_API_KEY as symbol]: api } },
  });
  mounted.push(wrapper);
  return wrapper;
}

/** Lets the simulated delays (0 ms timers) elapse, then renders. */
async function settle(rounds = 3): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    await flushPromises();
  }
}

function button(wrapper: VueWrapper, label: string | RegExp) {
  return wrapper
    .findAll("button")
    .find((b) =>
      typeof label === "string" ? b.text() === label : label.test(b.text()),
    );
}

function rankOf(row: { findAll: VueWrapper["findAll"] }): string {
  return row.findAll("td, th")[0]!.text();
}

async function myHeroes() {
  return (await simulated().getRanking(defaultRankingQuery(ME))).me;
}

describe("F02", () => {
  describe("CA1 — header, tabs and signed-in player", () => {
    it("CA1: one h1, Ranking active, My progression to my best hero, Run history coming soon", async () => {
      const wrapper = mountPage();
      await settle();
      const [warrior] = await myHeroes();

      expect(wrapper.findAll("h1").map((h) => h.text())).toEqual(["Leaderboard"]);
      const tabs = wrapper.findAll('[role="tab"]');
      expect(tabs.map((t) => t.text())).toEqual([
        "Ranking",
        "My progression",
        "Run history (Coming soon)",
      ]);
      expect(tabs[0]!.attributes("aria-selected")).toBe("true");
      expect(tabs[1]!.attributes("disabled")).toBeUndefined();
      expect(tabs[2]!.attributes("disabled")).toBeDefined();
      expect(wrapper.text()).toContain("Signed in as MaelisRune");

      await tabs[1]!.trigger("click");
      expect(navigate).toHaveBeenCalledWith(
        `/players/${ME}/heroes/${warrior!.heroId}/statistics`,
      );
    });

    it("CA1: without any hero of mine, My progression is disabled and the demo name shows", async () => {
      const wrapper = mountPage(
        apiStub({
          getRanking: vi
            .fn()
            .mockResolvedValue(
              ranking({ me: [entry(1, ME, { playerName: "Other" })] }),
            ),
        }),
      );
      await settle();
      expect(wrapper.text()).toContain("Signed in as Other");

      const empty = mountPage(apiStub());
      await settle();
      expect(empty.findAll('[role="tab"]')[1]!.attributes("disabled")).toBeDefined();
      expect(empty.text()).toContain("Signed in as MaelisRune");
    });
  });

  describe("CA2 — the ranking table", () => {
    it("CA2: every column, podium medals with a name, trends with a name, Anonymous hero", async () => {
      const entries = [
        entry(1, "p-1", { rankDelta: 3 }),
        entry(2, "p-2", { rankDelta: -2 }),
        entry(3, "p-3", { rankDelta: 0 }),
        entry(4, null, { rankDelta: null }),
      ];
      const wrapper = mountPage(
        apiStub({ getRanking: vi.fn().mockResolvedValue(ranking({ entries })) }),
      );
      await settle();

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

      const rows = wrapper.findAll("tbody tr");
      expect(rows.map(rankOf)).toEqual(["1", "2", "3", "4"]);
      const medals = rows.map((row) => {
        const medal = row.find('[role="img"][aria-label$="medal"]');
        return medal.exists() ? medal.attributes("aria-label") : null;
      });
      expect(medals).toEqual(["Gold medal", "Silver medal", "Bronze medal", null]);

      const trends = rows.map((row) => row.findAll("td")[1]!.find('[role="img"]'));
      expect(trends.map((t) => t.text())).toEqual(["▲ 3", "▼ 2", "— 0", "NEW"]);
      expect(trends.map((t) => t.attributes("aria-label"))).toEqual([
        "Up 3 places",
        "Down 2 places",
        "No change",
        "New in the ranking",
      ]);
      expect(rows[3]!.text()).toContain("Anonymous hero");
      expect(rows[0]!.text()).toContain("Warrior");
    });
  });

  describe("CA3 — table title and count", () => {
    it("CA3: « Ranking · All classes · All time », then the number of ranked heroes", async () => {
      const wrapper = mountPage();
      await settle();

      expect(wrapper.get("h2").text()).toBe("Ranking · All classes · All time");
      expect(wrapper.text()).toContain("220 heroes ranked");
    });

    it("CA3: the class and the season label show in the title", async () => {
      route.query = { class: "warrior", period: "season" };
      const wrapper = mountPage();
      await settle();

      expect(wrapper.get("h2").text()).toBe("Ranking · Warrior · Season 3");
    });
  });

  describe("CA4 — filters, search and sort, in the URL", () => {
    it("CA4: the controls offer the sheet's choices", async () => {
      const wrapper = mountPage();
      await settle();

      const options = (id: string) =>
        wrapper
          .get(`#${id}`)
          .findAll("option")
          .map((o) => o.text());
      expect(options("ranking-class")).toEqual([
        "All classes",
        "Warrior",
        "Shaman",
        "Mage",
      ]);
      expect(options("ranking-period")).toEqual(["All time", "Season 3", "This week"]);
      expect(options("ranking-sort")).toEqual([
        "Total XP",
        "Level",
        "Win rate",
        "Last activity",
      ]);
      expect(wrapper.text()).toContain("Search a display name");
    });

    it("CA4: a shared link reopens the same ranking", async () => {
      route.query = {
        class: "mage",
        period: "week",
        search: "rune",
        sort: "level",
        page: "2",
      };
      const api = simulated();
      const spy = vi.spyOn(api, "getRanking");
      const wrapper = mountPage(api);
      await settle();

      expect(spy.mock.calls[0]![0]).toEqual({
        ...defaultRankingQuery(ME),
        heroClass: HeroClass.MAGE,
        period: RankingPeriod.WEEK,
        search: "rune",
        sort: RankingSort.LEVEL,
        page: 2,
      });
      expect((wrapper.get("#ranking-class").element as HTMLSelectElement).value).toBe(
        "mage",
      );
      expect((wrapper.get("#ranking-search").element as HTMLInputElement).value).toBe(
        "rune",
      );
    });

    it("CA4: changing a filter writes the URL, keeps ?mock= and goes back to page 1", async () => {
      route.query = { page: "3", mock: "played" };
      const api = simulated();
      const spy = vi.spyOn(api, "getRanking");
      const wrapper = mountPage(api);
      await settle();

      await wrapper.get("#ranking-class").setValue("shaman");
      await settle();

      expect(navigate).toHaveBeenLastCalledWith(
        { query: { mock: "played", class: "shaman" } },
        { replace: true },
      );
      expect(spy.mock.lastCall![0]).toMatchObject({
        heroClass: HeroClass.SHAMAN,
        page: 1,
      });

      await wrapper.get("#ranking-sort").setValue("win-rate");
      await wrapper.get("#ranking-period").setValue("season");
      expect(route.query).toEqual({
        mock: "played",
        class: "shaman",
        period: "season",
        sort: "win-rate",
      });
    });

    it("CA4: the search waits about 300 ms", async () => {
      vi.useFakeTimers();
      const api = apiStub();
      const wrapper = mountPage(api);
      await flushPromises();

      await wrapper.get("#ranking-search").setValue("mae");
      await vi.advanceTimersByTimeAsync(250);
      await wrapper.get("#ranking-search").setValue("maelis");
      await vi.advanceTimersByTimeAsync(299);
      expect(navigate).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(route.query).toEqual({ search: "maelis" });
      await flushPromises();
      expect(api.getRanking.mock.lastCall![0]).toMatchObject({
        search: "maelis",
        page: 1,
      });
    });
  });

  describe("CA5 — pagination by 10", () => {
    it("CA5: summary, Previous / Next disabled at the ends, page in the URL", async () => {
      const wrapper = mountPage();
      await settle();

      expect(wrapper.text()).toContain("10 of 220 · page 1 of 22");
      expect(button(wrapper, "Previous page")!.attributes("disabled")).toBeDefined();
      await button(wrapper, "Next page")!.trigger("click");
      await settle();

      expect(route.query).toEqual({ page: "2" });
      expect(wrapper.text()).toContain("10 of 220 · page 2 of 22");
      expect(rankOf(wrapper.findAll("tbody tr")[0]!)).toBe("11");
      expect(button(wrapper, "Previous page")!.attributes("disabled")).toBeUndefined();

      route.query = { page: "22" };
      await settle();
      expect(wrapper.text()).toContain("page 22 of 22");
      expect(button(wrapper, "Next page")!.attributes("disabled")).toBeDefined();
    });

    it("CA5: a page past the end goes back to the last page", async () => {
      route.query = { page: "99" };
      mountPage();
      await settle();

      expect(route.query).toEqual({ page: "22" });
    });
  });

  describe("CA6 — my heroes: highlighted on the page, pinned otherwise", () => {
    it("CA6: my Warrior #7 carries « You » and aria-current; the others are pinned after the separator", async () => {
      const wrapper = mountPage();
      await settle();

      const current = wrapper.findAll('tbody tr[aria-current="true"]');
      expect(current.map(rankOf)).toEqual(["7"]);
      expect(current[0]!.text()).toContain("You");

      const foot = wrapper.get("tfoot");
      expect(foot.text()).toContain("47 positions between rank 10 and yours");
      expect(
        foot
          .findAll("tr")
          .filter((row) => row.text().includes("You"))
          .map(rankOf),
      ).toEqual(["58", "210"]);
    });

    it("CA6: my heroes stay pinned whatever the page", async () => {
      route.query = { page: "3" };
      const wrapper = mountPage();
      await settle();

      const pinned = wrapper
        .get("tfoot")
        .findAll("tr")
        .filter((row) => row.text().includes("You"));
      expect(pinned.map(rankOf)).toEqual(["7", "58", "210"]);
      expect(wrapper.get("tfoot").text()).toContain(
        "27 positions between rank 30 and yours",
      );
      expect(
        wrapper.findAll("tbody tr").some((row) => row.text().includes("You")),
      ).toBe(false);
    });
  });

  describe("CA7 — Jump to my rank", () => {
    it("CA7: opens the page of my best hero and focuses its line", async () => {
      route.query = { page: "5", sort: "level" };
      const wrapper = mountPage();
      await settle();
      const [warrior] = await myHeroes();

      await button(wrapper, "Jump to my rank")!.trigger("click");
      await settle();

      expect(route.query).toEqual({});
      const focused = document.activeElement as HTMLElement | null;
      expect(focused?.dataset.heroId).toBe(warrior!.heroId);
      expect(focused?.closest("tr")?.getAttribute("aria-current")).toBe("true");
    });

    it("CA7: with a class filter, finds the right filtered page", async () => {
      route.query = { class: "shaman", page: "1" };
      const wrapper = mountPage();
      await settle();
      const shaman = (await myHeroes()).find((h) => h.heroClass === HeroClass.SHAMAN)!;

      // The Shaman is not on the first page of the shamans: the pages are probed.
      expect(wrapper.get("tbody").text()).not.toContain(shaman.heroName);
      await button(wrapper, "Jump to my rank")!.trigger("click");
      // Each probe of the pages is one more simulated read.
      await settle(12);

      expect((document.activeElement as HTMLElement | null)?.dataset.heroId).toBe(
        shaman.heroId,
      );
    });
  });

  describe("CA8 — a line expands in place", () => {
    it("CA8: click or toggle button expands one line at a time with RankingRowDetail, never a profile", async () => {
      const wrapper = mountPage();
      await settle();
      const rows = () => wrapper.findAll("tbody tr");

      await rows()[0]!.trigger("click");
      const detail = wrapper.getComponent(RankingRowDetail);
      expect(detail.props()).toEqual({
        heroId: expect.any(String),
        currentPlayerId: ME,
      });
      const toggle = rows()[0]!.get("button");
      expect(toggle.attributes("type")).toBe("button");
      expect(toggle.attributes("aria-expanded")).toBe("true");

      await rows()[3]!.get("button").trigger("click");
      expect(wrapper.findAllComponents(RankingRowDetail)).toHaveLength(1);
      expect(rows()[0]!.get("button").attributes("aria-expanded")).toBe("false");

      await wrapper.find('[aria-expanded="true"]').trigger("click");
      expect(wrapper.findAllComponents(RankingRowDetail)).toHaveLength(0);
      expect(navigate).not.toHaveBeenCalled();
      expect(wrapper.find("tbody a").exists()).toBe(false);
    });
  });

  describe("CA9 — freshness and Refresh view", () => {
    it("CA9: « Updated … ago », Refresh view and a new read at each opening", async () => {
      const api = simulated();
      const spy = vi.spyOn(api, "getRanking");
      const wrapper = mountPage(api);
      await settle();

      expect(wrapper.text()).toMatch(/Updated \d+ min ago/);
      await button(wrapper, "Refresh view")!.trigger("click");
      await settle();
      expect(spy).toHaveBeenCalledTimes(2);

      mountPage(api);
      await settle();
      expect(spy).toHaveBeenCalledTimes(3);
    });
  });

  describe("CA12 — Public rankings", () => {
    it("CA12: a « Public rankings » link leads to /rankings", async () => {
      const wrapper = mountPage();
      await settle();

      const link = wrapper.findAll("a").find((a) => a.text() === "Public rankings");
      expect(link?.attributes("href")).toBe("/rankings");
    });
  });

  describe("Edge cases (tester)", () => {
    it("CA1: Ranking and Run history tabs never navigate", async () => {
      const wrapper = mountPage();
      await settle();
      const tabs = wrapper.findAll('[role="tab"]');

      await tabs[0]!.trigger("click");
      await tabs[2]!.trigger("click");
      expect(navigate).not.toHaveBeenCalled();
      expect(tabs[2]!.text()).toContain("Coming soon");
    });

    it("CA1: My progression targets me[0]'s player and hero, not another hero of mine", async () => {
      const me = [
        entry(4, ME, { heroId: "best", playerName: "Kael" }),
        entry(90, ME, { heroId: "second", playerName: "Kael" }),
      ];
      const wrapper = mountPage(
        apiStub({ getRanking: vi.fn().mockResolvedValue(ranking({ me })) }),
      );
      await settle();

      await wrapper.findAll('[role="tab"]')[1]!.trigger("click");
      expect(navigate).toHaveBeenCalledWith(`/players/${ME}/heroes/best/statistics`);
      expect(wrapper.text()).toContain("Signed in as Kael");
    });

    it("CA2: each column shows its value (class, level, XP, runs, win rate, last activity)", async () => {
      vi.useFakeTimers({ now: new Date("2026-10-21T12:00:00Z"), toFake: ["Date"] });
      const entries = [
        entry(12, "p-12", {
          heroName: "Brann",
          heroClass: HeroClass.SHAMAN,
          level: 27,
          totalXp: 12450,
          runs: 31,
          winRate: 0.43,
          lastActivityAt: "2026-10-21T11:57:00Z",
          playerName: "Ilya",
        }),
        entry(13, "p-13", { lastActivityAt: null }),
      ];
      const wrapper = mountPage(
        apiStub({ getRanking: vi.fn().mockResolvedValue(ranking({ entries })) }),
      );
      await settle();

      const cells = wrapper
        .findAll("tbody tr")[0]!
        .findAll("td, th")
        .map((c) => c.text());
      expect(cells[0]).toBe("12");
      expect(cells.slice(2)).toEqual([
        "Ilya",
        "Brann",
        "Shaman",
        "27",
        "12,450",
        "31",
        "43%",
        "3 min ago",
      ]);
      // No medal outside the podium.
      expect(wrapper.find('tbody [aria-label$="medal"]').exists()).toBe(false);
    });

    it("CA3: the count follows the filters, and the week title reads « This week »", async () => {
      route.query = { class: "warrior", period: "week" };
      const api = simulated();
      const wrapper = mountPage(api);
      await settle();
      const expected = (
        await api.getRanking({
          ...defaultRankingQuery(ME),
          heroClass: HeroClass.WARRIOR,
          period: RankingPeriod.WEEK,
        })
      ).totalCount;

      expect(wrapper.get("h2").text()).toBe("Ranking · Warrior · This week");
      expect(expected).toBeLessThan(220);
      expect(wrapper.text()).toContain(`${expected} heroes ranked`);
    });

    it("CA4: invalid URL values fall back to the defaults", async () => {
      route.query = { class: "paladin", period: "decade", sort: "luck", page: "-4" };
      const api = simulated();
      const spy = vi.spyOn(api, "getRanking");
      const wrapper = mountPage(api);
      await settle();

      expect(spy.mock.calls[0]![0]).toEqual(defaultRankingQuery(ME));
      expect(wrapper.get("h2").text()).toBe("Ranking · All classes · All time");
      expect(wrapper.text()).toContain("page 1 of 22");
    });

    it("CA4: changing the sort or the period from page 3 goes back to page 1", async () => {
      route.query = { page: "3" };
      const wrapper = mountPage();
      await settle();

      await wrapper.get("#ranking-sort").setValue("level");
      expect(route.query).toEqual({ sort: "level" });

      route.query = { sort: "level", page: "3" };
      await settle();
      await wrapper.get("#ranking-period").setValue("week");
      expect(route.query).toEqual({ sort: "level", period: "week" });
    });

    it("CA4: the search really narrows the table to matching display names", async () => {
      vi.useFakeTimers();
      const wrapper = mountPage();
      await vi.advanceTimersByTimeAsync(10);
      await flushPromises();

      await wrapper.get("#ranking-search").setValue("MaelisRune");
      await vi.advanceTimersByTimeAsync(300);
      await vi.advanceTimersByTimeAsync(10);
      await flushPromises();

      const rows = wrapper.findAll("tbody tr");
      expect(rows.map(rankOf)).toEqual(["7", "58", "210"]);
      expect(wrapper.text()).toContain("3 heroes ranked");
    });

    it("CA4: a URL change (back to a shared link) updates the search field", async () => {
      const wrapper = mountPage();
      await settle();

      route.query = { search: "rune" };
      await settle();
      expect((wrapper.get("#ranking-search").element as HTMLInputElement).value).toBe(
        "rune",
      );
    });

    it("CA5: Previous page from page 2 goes back to page 1 (no page in the URL)", async () => {
      route.query = { page: "2" };
      const wrapper = mountPage();
      await settle();

      await button(wrapper, "Previous page")!.trigger("click");
      await settle();
      expect(route.query).toEqual({});
      expect(rankOf(wrapper.findAll("tbody tr")[0]!)).toBe("1");
      expect(wrapper.findAll("tbody tr")).toHaveLength(10);
    });

    it("CA6: several of my heroes on the page all carry « You »; aria-current stays on one line", async () => {
      route.query = { search: "MaelisRune" };
      const wrapper = mountPage();
      await settle();

      const rows = wrapper.findAll("tbody tr");
      expect(rows.map(rankOf)).toEqual(["7", "58", "210"]);
      expect(rows.every((row) => row.text().includes("You"))).toBe(true);
      expect(wrapper.findAll('[aria-current="true"]').map(rankOf)).toEqual(["7"]);
      expect(wrapper.find("tfoot").exists()).toBe(false);
    });

    it("CA6: on the Shaman's page, it is highlighted and only the others are pinned", async () => {
      route.query = { page: "6" };
      const wrapper = mountPage();
      await settle();

      const mine = wrapper
        .findAll("tbody tr")
        .filter((row) => row.text().includes("You"));
      expect(mine.map(rankOf)).toEqual(["58"]);
      const foot = wrapper.get("tfoot");
      expect(
        foot
          .findAll("tr")
          .filter((row) => row.text().includes("You"))
          .map(rankOf),
      ).toEqual(["7", "210"]);
      expect(foot.text()).toContain("149 positions between rank 60 and yours");
    });

    it("CA6: the separator « between rank X and yours » is directly followed by that hero of mine", async () => {
      route.query = { page: "3" };
      const wrapper = mountPage();
      await settle();

      const rows = wrapper.get("tfoot").findAll("tr");
      const index = rows.findIndex((row) =>
        /positions between rank 30 and yours/.test(row.text()),
      );
      expect(index).toBeGreaterThanOrEqual(0);
      // "yours" is the next row: my Shaman #58, 27 positions after rank 30.
      expect(rankOf(rows[index + 1]!)).toBe("58");
    });

    it("CA7: scrolls to the line it focuses", async () => {
      route.query = { page: "4" };
      const scroll = vi.fn();
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        value: scroll,
        configurable: true,
        writable: true,
      });
      const wrapper = mountPage();
      await settle();

      await button(wrapper, "Jump to my rank")!.trigger("click");
      await settle();

      const focused = document.activeElement as HTMLElement | null;
      expect(focused?.dataset.heroId).toBe("simulated-hero-007");
      expect(scroll).toHaveBeenCalled();
      expect(scroll.mock.contexts.at(-1)).toBe(focused);
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    });

    it("CA7: already on my best hero's page, it focuses the line without changing the URL", async () => {
      const wrapper = mountPage();
      await settle();

      await button(wrapper, "Jump to my rank")!.trigger("click");
      await settle();
      expect(navigate).not.toHaveBeenCalled();
      expect((document.activeElement as HTMLElement | null)?.dataset.heroId).toBe(
        "simulated-hero-007",
      );
    });

    it("CA7: without any hero of mine, Jump to my rank is disabled", async () => {
      const wrapper = mountPage(apiStub());
      await settle();
      expect(button(wrapper, "Jump to my rank")!.attributes("disabled")).toBeDefined();
    });

    it("CA8: a pinned hero of mine expands in place too, with RankingRowDetail", async () => {
      const wrapper = mountPage();
      await settle();

      const pinned = wrapper
        .get("tfoot")
        .findAll("tr")
        .find((row) => rankOf(row) === "58")!;
      await pinned.trigger("click");
      const detail = wrapper.getComponent(RankingRowDetail);
      expect(detail.props()).toEqual({
        heroId: "simulated-hero-058",
        currentPlayerId: ME,
      });
      expect(navigate).not.toHaveBeenCalled();
    });

    it("CA8: the toggle button controls the detail it shows", async () => {
      const wrapper = mountPage();
      await settle();

      const toggle = wrapper.findAll("tbody tr")[0]!.get("button");
      expect(toggle.attributes("aria-expanded")).toBe("false");
      await toggle.trigger("click");
      const controls = wrapper
        .findAll("tbody tr")[0]!
        .get("button")
        .attributes("aria-controls");
      expect(controls).toBeTruthy();
      expect(
        wrapper.find(`#${controls}`).findComponent(RankingRowDetail).exists(),
      ).toBe(true);
    });

    it("CA9: Refresh view shows the freshness of the new reading", async () => {
      const recent = new Date(Date.now() - 5 * 60_000).toISOString();
      const older = new Date(Date.now() - 42 * 60_000).toISOString();
      const getRanking = vi
        .fn()
        .mockResolvedValueOnce(ranking({ consolidatedAt: older }))
        .mockResolvedValueOnce(ranking({ consolidatedAt: recent }));
      const wrapper = mountPage(apiStub({ getRanking }));
      await settle();
      expect(wrapper.text()).toContain("Updated 42 min ago");

      await button(wrapper, "Refresh view")!.trigger("click");
      await settle();
      expect(getRanking).toHaveBeenCalledTimes(2);
      expect(wrapper.text()).toContain("Updated 5 min ago");
      expect(wrapper.text()).not.toContain("Updated 42 min ago");
    });
  });

  describe("Points left by F00", () => {
    it("F00: a route change that leaves the query unchanged (?mock=) does not read again", async () => {
      const api = simulated();
      const spy = vi.spyOn(api, "getRanking");
      mountPage(api);
      await settle();

      route.query = { mock: "lagging" };
      await settle();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("F00: no hero matching the filters is not « nobody ranked », and Clear filters resets them", async () => {
      route.query = { class: "mage", search: "zzzz-nobody", sort: "level" };
      const wrapper = mountPage();
      await settle();

      expect(wrapper.text()).toContain("No hero matches your filters");
      expect(wrapper.text()).not.toContain("No hero has been ranked yet");
      await button(wrapper, "Clear filters")!.trigger("click");
      await settle();

      expect(route.query).toEqual({ sort: "level" });
      expect(wrapper.findAll("tbody tr")).toHaveLength(10);
    });

    it("F00: nobody ranked keeps its own message", async () => {
      const wrapper = mountPage(simulated(MockScenario.EMPTY));
      await settle();

      expect(wrapper.text()).toContain("No hero has been ranked yet");
      expect(wrapper.text()).not.toContain("No hero matches your filters");
    });

    it("F00: no line carries tabindex=-1", async () => {
      const wrapper = mountPage();
      await settle();

      expect(wrapper.find('tr[tabindex="-1"]').exists()).toBe(false);
    });
  });
});
