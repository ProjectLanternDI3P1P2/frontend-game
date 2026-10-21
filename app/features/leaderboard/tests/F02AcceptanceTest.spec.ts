/**
 * F02 — Page classement /leaderboard complète. Acceptance tests for CA1 to
 * CA13, and the points F00 left to F02.
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

      // #7 (above the page) first, then the separator, then #58 and #210.
      const rows = wrapper.get("tfoot").findAll("tr");
      const labels = rows.map((row) =>
        /positions between/.test(row.text()) ? "separator" : rankOf(row),
      );
      expect(labels).toEqual(["7", "separator", "58", "210"]);
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

  describe("CA10 — page states", () => {
    it("CA10: loading shows skeleton lines, announced by aria-live", async () => {
      const api = apiStub({
        getRanking: vi.fn().mockReturnValue(new Promise(() => {})),
      });
      const wrapper = mountPage(api);
      await flushPromises();

      const skeleton = wrapper.get('[data-testid="ranking-skeleton"]');
      expect(skeleton.attributes("aria-hidden")).toBe("true");
      expect(skeleton.findAll(".ranking-skeleton__row")).toHaveLength(10);
      expect(wrapper.get('[aria-live="polite"]').text()).toMatch(/loading/i);
      expect(wrapper.find("table").exists()).toBe(false);
    });

    it("CA10: an error shows role=alert with Retry, which reads again", async () => {
      const api = simulated(MockScenario.ERROR);
      const read = vi.spyOn(api, "getRanking");
      const wrapper = mountPage(api);
      await settle();

      expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="ranking-skeleton"]').exists()).toBe(false);
      await button(wrapper, "Retry")!.trigger("click");
      await settle();
      expect(read).toHaveBeenCalledTimes(2);
    });

    it("CA10: a new empty season offers Enter a dungeon and the previous season's board", async () => {
      route.query = { period: "season" };
      const wrapper = mountPage(simulated(MockScenario.EMPTY));
      await settle();

      expect(wrapper.text()).toContain("No ranked run in Season 4 yet");
      expect(wrapper.text()).toMatch(/no hero/i);
      expect(wrapper.get('a[href="/dungeon"]').text()).toBe("Enter a dungeon");
      await button(wrapper, "Season 3 final board")!.trigger("click");
      await settle();
      expect(route.query.period).toBeUndefined();
    });

    it("CA10: a class filter without any hero of mine shows a banner with Clear class filter", async () => {
      const api = apiStub({
        getRanking: vi
          .fn()
          .mockResolvedValue(
            ranking({ entries: [entry(1, "p-1")], totalCount: 1, me: [] }),
          ),
      });
      route.query = { class: "mage", period: "season" };
      const wrapper = mountPage(api);
      await settle();

      expect(wrapper.text()).toContain("You have no Mage hero ranked in Season 3");
      await button(wrapper, "Clear class filter")!.trigger("click");
      await settle();
      expect(route.query.class).toBeUndefined();
      expect(route.query.period).toBe("season");
    });
  });

  describe("CA11 — ranking status", () => {
    it("CA11: LAGGING shows Ranking is behind in three columns, and XP pending lines", async () => {
      const wrapper = mountPage(simulated(MockScenario.LAGGING));
      await settle();

      const banner = wrapper.get('[data-status="lagging"]');
      expect(banner.text()).toContain("Ranking is behind");
      expect(banner.findAll("dt").map((dt) => dt.text())).toEqual([
        "Certain",
        "Still uncertain",
        "What you can do",
      ]);
      expect(banner.text()).toContain("7 min");
      expect(banner.find("time[datetime]").exists()).toBe(true);
      expect(wrapper.get("tbody").text()).toContain("XP pending");
      expect(wrapper.findAll("tbody tr")).toHaveLength(10);
    });

    it("CA11: REBUILDING shows a progress bar and « as of »", async () => {
      const wrapper = mountPage(simulated(MockScenario.REBUILDING));
      await settle();

      const banner = wrapper.get('[data-status="rebuilding"]');
      expect(banner.text()).toContain("Ranking is being rebuilt from facts");
      expect(banner.get("progress").attributes("value")).toBe("62");
      expect(banner.text()).toMatch(/as of .*UTC/);
      expect(wrapper.findAll("tbody tr")).toHaveLength(10);
    });

    it("CA11: FROZEN shows when and why", async () => {
      const wrapper = mountPage(simulated(MockScenario.FROZEN));
      await settle();

      const banner = wrapper.get('[data-status="frozen"]');
      expect(banner.text()).toContain("Ranking is frozen");
      expect(banner.text()).toMatch(/Frozen since .*UTC/);
      expect(banner.text()).toContain("rewards are being audited");
      expect(wrapper.findAll("tbody tr")).toHaveLength(10);
    });

    it("CA11: LIVE shows no status banner", async () => {
      const wrapper = mountPage();
      await settle();

      expect(wrapper.find("[data-status]").exists()).toBe(false);
    });
  });

  describe("CA13 — accessibility and mobile", () => {
    it("CA13: one h1, scope=col headers, a focusable scroll container around the table only", async () => {
      const wrapper = mountPage();
      await settle();

      expect(wrapper.findAll("h1")).toHaveLength(1);
      const headers = wrapper.findAll("thead th");
      expect(headers.every((th) => th.attributes("scope") === "col")).toBe(true);
      // The table scrolls inside its own region, keyboard reachable.
      const region = wrapper.get(".leaderboard-table");
      expect(region.element.firstElementChild?.tagName).toBe("TABLE");
      expect(region.attributes("role")).toBe("region");
      expect(region.attributes("tabindex")).toBe("0");
      expect(region.attributes("aria-label")).toBeTruthy();
      // The filters and pagination are outside the scroll container.
      expect(region.find(".ranking-pagination").exists()).toBe(false);
      expect(wrapper.find(".ranking-pagination").exists()).toBe(true);
    });

    it("CA13: my lines and medals never rely on colour alone", async () => {
      const wrapper = mountPage();
      await settle();

      const mine = wrapper.findAll("tbody tr.ranking-row--me");
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((row) => row.text().includes("You"))).toBe(true);
      expect(wrapper.find('tbody [aria-label="Gold medal"]').exists()).toBe(true);
    });

    it("CA13: Jump to my rank does not animate the scroll under reduced motion", async () => {
      vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") }));
      route.query = { page: "3" };
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
      expect(scroll).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: "auto" }),
      );
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    });
  });

  describe("Step 1 fixes", () => {
    it("CA7: a jump whose page fails to load never steals the focus later", async () => {
      const api = simulated();
      route.query = { page: "3" };
      const wrapper = mountPage(api);
      await settle();
      vi.spyOn(api, "getRanking").mockRejectedValueOnce(new Error("page down"));

      await button(wrapper, "Jump to my rank")!.trigger("click");
      await settle();
      expect(wrapper.find('[role="alert"]').exists()).toBe(true);

      await button(wrapper, "Retry")!.trigger("click");
      await settle();
      expect(wrapper.findAll("tbody tr").map(rankOf)).toContain("7");
      expect((document.activeElement as HTMLElement | null)?.dataset.heroId).toBe(
        undefined,
      );
    });

    it("CA7: a filter changed during the search of my page cancels the jump", async () => {
      const api = simulated();
      route.query = { class: "warrior", page: "3" };
      const wrapper = mountPage(api);
      await settle();

      await button(wrapper, "Jump to my rank")!.trigger("click");
      route.query = { class: "shaman" };
      await settle(6);
      expect(route.query).toEqual({ class: "shaman" });
      expect((document.activeElement as HTMLElement | null)?.dataset.heroId).toBe(
        undefined,
      );
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

  describe("Pass 2 (tester): CA6 separator, CA10, CA11, CA13 through ?mock=", () => {
    /** Mounts the page without an injected API: `?mock=` picks the scenario. */
    function mountFromUrl() {
      const wrapper = mount(LeaderboardPage, {
        attachTo: document.body,
        global: { stubs },
      });
      mounted.push(wrapper);
      return wrapper;
    }

    /** The simulated delay is about 300 ms. */
    async function settleSimulated(): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve, 450));
      await settle();
    }

    function footLabels(wrapper: VueWrapper): string[] {
      return wrapper
        .get("tfoot")
        .findAll("tr")
        .map((row) =>
          /positions? between/.test(row.text()) ? row.text().trim() : rankOf(row),
        );
    }

    it("CA6: on every page, the separator directly precedes the hero it counts to", async () => {
      const wrapper = mountPage();
      await settle();
      for (let page = 1; page <= 22; page += 1) {
        route.query = page === 1 ? {} : { page: String(page) };
        await settle();
        const ranks = wrapper.findAll("tbody tr").map((row) => Number(rankOf(row)));
        const firstRank = ranks[0]!;
        const lastRank = ranks.at(-1)!;
        if (!wrapper.find("tfoot").exists()) continue;
        const labels = footLabels(wrapper);
        const index = labels.findIndex((label) => /between/.test(label));
        const pinned = labels.filter((label) => !/between/.test(label)).map(Number);
        // Pinned heroes stay in rank order.
        expect(pinned, `page ${page}`).toEqual([...pinned].sort((a, b) => a - b));
        if (index === -1) {
          // No separator only when none of my pinned heroes is below the page
          // (or the next one directly follows it).
          expect(
            pinned.every((rank) => rank < firstRank || rank === lastRank + 1),
            `page ${page}`,
          ).toBe(true);
          continue;
        }
        const match = /^(\d+) positions? between rank (\d+) and yours$/.exec(
          labels[index]!,
        );
        expect(match, `page ${page}: ${labels[index]}`).not.toBeNull();
        const [, n, x] = match!;
        expect(Number(x), `page ${page}`).toBe(lastRank);
        const yours = Number(labels[index + 1]);
        expect(yours - lastRank - 1, `page ${page}`).toBe(Number(n));
        // Everything before the separator is above the page, everything after below.
        expect(
          labels
            .slice(0, index)
            .map(Number)
            .every((r) => r < firstRank),
        ).toBe(true);
        expect(
          labels
            .slice(index + 1)
            .map(Number)
            .every((r) => r > lastRank),
        ).toBe(true);
      }
    });

    it("CA6: on the last page (#211-#220), all my heroes are above: no misleading separator", async () => {
      route.query = { page: "22" };
      const wrapper = mountPage();
      await settle();

      expect(footLabels(wrapper)).toEqual(["7", "58", "210"]);
    });

    it("CA6: sorted by Level, pinned heroes split on the page's rank range, no separator", async () => {
      route.query = { sort: "level" };
      const wrapper = mountPage();
      await settle();

      const ranks = wrapper.findAll("tbody tr").map((row) => Number(rankOf(row)));
      const min = Math.min(...ranks);
      const max = Math.max(...ranks);
      expect(wrapper.find("tfoot").exists()).toBe(true);
      const labels = footLabels(wrapper);
      // Ranks are not contiguous on a re-sorted page: no "positions between".
      expect(labels.some((label) => /between/.test(label))).toBe(false);
      const pinned = labels.map(Number);
      expect(pinned).toEqual([...pinned].sort((a, b) => a - b));
      expect(pinned.every((rank) => rank < min || rank > max)).toBe(true);
    });

    it("CA6: with a class filter, the separator still precedes my hero below the page", async () => {
      route.query = { class: "shaman" };
      const wrapper = mountPage();
      await settle();

      const labels = footLabels(wrapper);
      const index = labels.findIndex((label) => /between/.test(label));
      expect(index).toBeGreaterThanOrEqual(0);
      expect(labels[index + 1]).toBe("58");
    });

    it("CA10: ?mock=empty, a new season: both actions are offered on opening the page", async () => {
      route.query = { mock: "empty" };
      const wrapper = mountFromUrl();
      await settleSimulated();

      expect(wrapper.text()).toContain("No ranked run in Season 4 yet");
      expect(wrapper.get('a[href="/dungeon"]').text()).toBe("Enter a dungeon");
      // All time already holds past seasons: the action is shown, disabled, explained.
      const previous = button(wrapper, "Season 3 final board")!;
      expect(previous).toBeDefined();
      expect(previous.attributes("disabled")).toBeDefined();
      const hint = previous.attributes("aria-describedby")!;
      expect(document.getElementById(hint)?.textContent).toContain(
        "Already showing the all-time board",
      );
    });

    it("CA10: ?mock=empty, period Season: the previous season action switches the period", async () => {
      route.query = { mock: "empty", period: "season" };
      const wrapper = mountFromUrl();
      await settleSimulated();

      await button(wrapper, "Season 3 final board")!.trigger("click");
      await settleSimulated();
      expect(route.query).toEqual({ mock: "empty" });
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    });

    it("CA10: ?mock=error shows role=alert holding Retry, and no table", async () => {
      route.query = { mock: "error" };
      const wrapper = mountFromUrl();
      await settleSimulated();

      const alert = wrapper.get('[role="alert"]');
      expect(alert.findAll("button").map((b) => b.text())).toContain("Retry");
      expect(wrapper.find("table").exists()).toBe(false);
      expect(wrapper.find('[data-testid="ranking-skeleton"]').exists()).toBe(false);
    });

    it("CA10: while the simulated read runs, skeleton lines and a live announcement show", async () => {
      route.query = { mock: "played" };
      const wrapper = mountFromUrl();
      await flushPromises();

      expect(wrapper.find('[data-testid="ranking-skeleton"]').exists()).toBe(true);
      const live = wrapper.get('[aria-live="polite"]');
      expect(live.text()).toMatch(/loading/i);
      await settleSimulated();
      expect(wrapper.find('[data-testid="ranking-skeleton"]').exists()).toBe(false);
      // The live region stays in the tree, so the next loading is announced.
      expect(wrapper.find('[aria-live="polite"]').exists()).toBe(true);
      expect(wrapper.findAll("tbody tr")).toHaveLength(10);
    });

    it("CA10: the live region is in the page before the read starts (announced, not created)", async () => {
      const wrapper = mountPage(
        apiStub({ getRanking: vi.fn().mockReturnValue(new Promise(() => {})) }),
      );
      expect(wrapper.find('[aria-live="polite"]').exists()).toBe(true);
    });

    it("CA10: simulated data, Mage over Season 3 (my Mage is absent): banner and Clear class filter", async () => {
      route.query = { class: "mage", period: "season" };
      const wrapper = mountPage();
      await settle();

      expect(wrapper.text()).toContain("You have no Mage hero ranked in Season 3");
      // The table of other Mages stays readable under the banner.
      expect(wrapper.findAll("tbody tr").length).toBeGreaterThan(0);
      await button(wrapper, "Clear class filter")!.trigger("click");
      await settle();

      expect(route.query).toEqual({ period: "season" });
      expect(wrapper.text()).not.toContain("You have no");
      expect(
        wrapper.findAll("tbody tr.ranking-row--me, tfoot tr.ranking-row--me").length,
      ).toBeGreaterThan(0);
    });

    it("CA10: no banner when a class filter still holds one of my heroes", async () => {
      route.query = { class: "warrior" };
      const wrapper = mountPage();
      await settle();

      expect(wrapper.text()).not.toContain("You have no");
      expect(button(wrapper, "Clear class filter")).toBeUndefined();
    });

    it("CA10: the week period names the period in the banner", async () => {
      const api = apiStub({
        getRanking: vi
          .fn()
          .mockResolvedValue(ranking({ entries: [entry(1)], totalCount: 1, me: [] })),
      });
      route.query = { class: "shaman", period: "week" };
      const wrapper = mountPage(api);
      await settle();

      expect(wrapper.text()).toContain("You have no Shaman hero ranked in This week");
    });

    it("CA11: ?mock=lagging shows lagSeconds and correctUpTo, and XP pending exactly on isPending lines", async () => {
      vi.useFakeTimers({ now: new Date("2026-10-21T12:00:00Z"), toFake: ["Date"] });
      route.query = { mock: "lagging" };
      const wrapper = mountFromUrl();
      await settleSimulated();
      const response = await simulated(MockScenario.LAGGING).getRanking(
        defaultRankingQuery(ME),
      );

      const banner = wrapper.get('[data-status="lagging"]');
      expect(banner.text()).toContain("Ranking is behind");
      expect(banner.text()).toContain("7 min");
      expect(banner.get("time").attributes("datetime")).toBe(
        response.statusDetail.correctUpTo,
      );
      const flagged = wrapper
        .findAll("tbody tr.ranking-row")
        .filter((row) => row.text().includes("XP pending"))
        .map(rankOf);
      const expected = response.entries
        .filter((e) => e.isPending)
        .map((e) => String(e.rank));
      expect(expected.length).toBeGreaterThan(0);
      expect(flagged).toEqual(expected);
      // Readable: the table, pagination and my pinned heroes are all there.
      expect(wrapper.findAll("tbody tr")).toHaveLength(10);
      expect(wrapper.text()).toContain("10 of 220 · page 1 of 22");
      expect(wrapper.find("tfoot").exists()).toBe(true);
    });

    it("CA11: ?mock=rebuilding: progress bar at 62 and « as of » the snapshot", async () => {
      vi.useFakeTimers({ now: new Date("2026-10-21T12:00:00Z"), toFake: ["Date"] });
      route.query = { mock: "rebuilding" };
      const wrapper = mountFromUrl();
      await settleSimulated();
      const response = await simulated(MockScenario.REBUILDING).getRanking(
        defaultRankingQuery(ME),
      );

      const banner = wrapper.get('[data-status="rebuilding"]');
      expect(banner.text()).toContain("Ranking is being rebuilt from facts");
      const bar = banner.get("progress");
      expect(bar.attributes("value")).toBe("62");
      expect(banner.text()).toMatch(/as of/);
      expect(banner.get("time").attributes("datetime")).toBe(
        response.statusDetail.snapshotAt,
      );
      expect(wrapper.findAll("tbody tr")).toHaveLength(10);
    });

    it("CA11: ?mock=frozen shows frozenAt and the reason, the table stays usable", async () => {
      vi.useFakeTimers({ now: new Date("2026-10-21T12:00:00Z"), toFake: ["Date"] });
      route.query = { mock: "frozen" };
      const wrapper = mountFromUrl();
      await settleSimulated();
      const response = await simulated(MockScenario.FROZEN).getRanking(
        defaultRankingQuery(ME),
      );

      const banner = wrapper.get('[data-status="frozen"]');
      expect(banner.text()).toContain("Ranking is frozen");
      expect(banner.get("time").attributes("datetime")).toBe(
        response.statusDetail.frozenAt,
      );
      expect(banner.text()).toContain(response.statusDetail.reason!);
      await button(wrapper, "Next page")!.trigger("click");
      await settleSimulated();
      expect(rankOf(wrapper.findAll("tbody tr")[0]!)).toBe("11");
      expect(wrapper.find('[data-status="frozen"]').exists()).toBe(true);
    });

    it("CA11: missing details never print null/undefined/NaN", async () => {
      for (const status of ["lagging", "rebuilding", "frozen"] as const) {
        const api = apiStub({
          getRanking: vi
            .fn()
            .mockResolvedValue(
              ranking({ entries: [entry(1)], totalCount: 1, status } as never),
            ),
        });
        const wrapper = mountPage(api);
        await settle();
        const banner = wrapper.get(`[data-status="${status}"]`);
        expect(banner.text(), status).not.toMatch(/null|undefined|NaN|Invalid/);
      }
    });

    it("CA11: an out-of-range rebuild progress is clamped", async () => {
      const api = apiStub({
        getRanking: vi.fn().mockResolvedValue(
          ranking({
            entries: [entry(1)],
            totalCount: 1,
            status: "rebuilding",
            statusDetail: {
              lagSeconds: null,
              pendingCount: null,
              correctUpTo: null,
              rebuildProgress: 3,
              snapshotAt: null,
              frozenAt: null,
              reason: null,
            },
          } as never),
        ),
      });
      const wrapper = mountPage(api);
      await settle();

      expect(wrapper.get("progress").attributes("value")).toBe("100");
    });

    it("CA13: every state keeps exactly one h1 (loading, error, empty, statuses)", async () => {
      for (const mock of ["empty", "error", "lagging", "rebuilding", "frozen"]) {
        route.query = { mock };
        const wrapper = mountFromUrl();
        expect(wrapper.findAll("h1"), `${mock} loading`).toHaveLength(1);
        await settleSimulated();
        expect(wrapper.findAll("h1"), mock).toHaveLength(1);
        wrapper.unmount();
        mounted.splice(mounted.indexOf(wrapper), 1);
      }
    });

    it("CA13: status banners and the pending badge carry text, never colour alone", async () => {
      route.query = { mock: "lagging" };
      const wrapper = mountFromUrl();
      await settleSimulated();

      const banner = wrapper.get('[data-status="lagging"]');
      expect(banner.attributes("role")).toBe("status");
      expect(banner.text().trim().length).toBeGreaterThan(20);
      const progress = await (async () => {
        route.query = { mock: "rebuilding" };
        const rebuilding = mountFromUrl();
        await settleSimulated();
        return rebuilding.get("progress");
      })();
      const name =
        progress.attributes("aria-label") ??
        progress.attributes("aria-labelledby") ??
        (progress.element.id
          ? document.querySelector(`label[for="${progress.element.id}"]`)?.textContent
          : null);
      expect(name).toBeTruthy();
    });

    it("CA13: in the empty state, Enter a dungeon and the previous-season action are keyboard reachable", async () => {
      route.query = { mock: "empty", period: "season" };
      const wrapper = mountFromUrl();
      await settleSimulated();

      const link = wrapper.get('a[href="/dungeon"]');
      expect(link.attributes("tabindex")).not.toBe("-1");
      const previous = button(wrapper, "Season 3 final board")!;
      expect(previous.attributes("type")).toBe("button");
      expect(previous.attributes("disabled")).toBeUndefined();
    });
  });

  describe("Pass 3 (tester): CA6 other sorts, CA10 empty season", () => {
    function mountFromUrl() {
      const wrapper = mount(LeaderboardPage, {
        attachTo: document.body,
        global: { stubs },
      });
      mounted.push(wrapper);
      return wrapper;
    }

    async function settleSimulated(): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve, 450));
      await settle();
    }

    function pinnedRanks(wrapper: VueWrapper): number[] {
      const foot = wrapper.find("tfoot");
      if (!foot.exists()) return [];
      return foot
        .findAll("tr")
        .filter((row) => !/positions? between/.test(row.text()))
        .map((row) => Number(rankOf(row)));
    }

    for (const sort of [
      RankingSort.LEVEL,
      RankingSort.WIN_RATE,
      RankingSort.LAST_ACTIVITY,
    ]) {
      it(`CA6: sorted by ${sort}, on every page: no separator, pinned = my heroes off the page, by rank`, async () => {
        const me = await myHeroes();
        const myIds = new Set(me.map((hero) => hero.heroId));
        route.query = { sort };
        const wrapper = mountPage();
        await settle();
        for (let page = 1; page <= 22; page += 1) {
          route.query = page === 1 ? { sort } : { sort, page: String(page) };
          await settle();
          const rows = wrapper.findAll("tbody tr");
          expect(rows.length, `${sort} page ${page}`).toBeGreaterThan(0);
          expect(wrapper.text(), `${sort} page ${page}`).not.toMatch(/between rank/);
          const onPage = rows.map((row) => Number(rankOf(row)));
          const myOnPage = me.filter((hero) => onPage.includes(hero.rank));
          const expected = me
            .filter((hero) => !onPage.includes(hero.rank))
            .map((hero) => hero.rank)
            .sort((a, b) => a - b);
          expect(pinnedRanks(wrapper), `${sort} page ${page}`).toEqual(expected);
          // My heroes on the page are highlighted in the body, not pinned.
          const youRows = rows.filter((row) => row.text().includes("You"));
          expect(youRows.length, `${sort} page ${page}`).toBe(myOnPage.length);
          expect(myIds.size).toBe(me.length);
        }
      });
    }

    it("CA6: switching the sort from Level back to Total XP brings the separator back", async () => {
      route.query = { sort: RankingSort.LEVEL };
      const wrapper = mountPage();
      await settle();
      expect(wrapper.text()).not.toMatch(/between rank/);
      route.query = {};
      await settle();
      expect(wrapper.text()).toMatch(/\d+ positions? between rank 10 and yours/);
    });

    it("CA10: ?mock=empty&period=season: enabled action, click shows All time, then disabled and explained", async () => {
      route.query = { mock: "empty", period: "season" };
      const wrapper = mountFromUrl();
      await settleSimulated();

      expect(wrapper.text()).toContain("No ranked run in Season 4 yet");
      expect(wrapper.get('a[href="/dungeon"]').text()).toBe("Enter a dungeon");
      const previous = button(wrapper, "Season 3 final board")!;
      expect(previous).toBeDefined();
      expect(previous.attributes("disabled")).toBeUndefined();
      expect(wrapper.find("#ranking-empty-previous-hint").exists()).toBe(false);

      await previous.trigger("click");
      await settleSimulated();
      expect(route.query).toEqual({ mock: "empty" });
      const after = button(wrapper, "Season 3 final board")!;
      expect(after).toBeDefined();
      expect(after.attributes("disabled")).toBeDefined();
      expect(
        document.getElementById(after.attributes("aria-describedby")!)?.textContent,
      ).toContain("Already showing the all-time board");
    });

    it("CA10: ?mock=empty&period=week: the action is offered and switches to All time", async () => {
      route.query = { mock: "empty", period: "week" };
      const wrapper = mountFromUrl();
      await settleSimulated();

      const previous = button(wrapper, "Season 3 final board")!;
      expect(previous).toBeDefined();
      expect(previous.attributes("disabled")).toBeUndefined();
      await previous.trigger("click");
      expect(route.query).toEqual({ mock: "empty" });
    });

    it("CA10: ?mock=empty (All time): the disabled action is inert and the hint is unique", async () => {
      route.query = { mock: "empty" };
      const wrapper = mountFromUrl();
      await settleSimulated();

      const previous = button(wrapper, "Season 3 final board")!;
      expect((previous.element as HTMLButtonElement).disabled).toBe(true);
      navigate.mockClear();
      await previous.trigger("click");
      await settleSimulated();
      expect(navigate).not.toHaveBeenCalled();
      expect(route.query).toEqual({ mock: "empty" });
      expect(document.querySelectorAll("#ranking-empty-previous-hint")).toHaveLength(1);
      expect(wrapper.findAll("h1")).toHaveLength(1);
    });

    it("CA10: without a previous season, no previous-season action nor hint", async () => {
      const api = apiStub({
        getRanking: vi.fn().mockResolvedValue(
          ranking({
            entries: [],
            me: [],
            totalCount: 0,
            season: {
              seasonId: "season-1",
              label: "Season 1",
              previousSeasonId: null,
            } as never,
          }),
        ),
      });
      const wrapper = mountPage(api);
      await settle();

      expect(wrapper.text()).toContain("No ranked run in Season 1 yet");
      expect(wrapper.findAll("button").some((b) => /final board/.test(b.text()))).toBe(
        false,
      );
      expect(wrapper.find("#ranking-empty-previous-hint").exists()).toBe(false);
    });
  });
});
