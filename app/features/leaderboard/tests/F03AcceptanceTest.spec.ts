import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, onErrorCaptured } from "vue";
import { LEADERBOARD_API_KEY } from "../api/leaderboardSource";
import { createSimulatedLeaderboardApi } from "../api/simulatedLeaderboardApi";
import RankingRowDetail from "../components/RankingRowDetail.vue";
import {
  MockScenario,
  RankingPeriod,
  RankingSort,
  type LeaderboardApi,
} from "../types";
import { apiStub } from "./fixtures/leaderboardFixtures";
import { heroDetail, heroFacts } from "./fixtures/rankingDetailFixtures";

const stubs = {
  NuxtLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
  UiIconButton: {
    template: '<button type="button" aria-label="Close dialog">×</button>',
  },
};

function mountDetail(api: LeaderboardApi) {
  return mount(RankingRowDetail, {
    props: { heroId: "hero-1", currentPlayerId: "me" },
    global: { stubs, provide: { [LEADERBOARD_API_KEY as symbol]: api } },
    attachTo: document.body,
  });
}

function readyApi(overrides: Parameters<typeof apiStub>[0] = {}) {
  return apiStub({
    getRankingHeroDetail: vi.fn().mockResolvedValue(heroDetail()),
    getRankingHeroFacts: vi.fn().mockResolvedValue(heroFacts()),
    ...overrides,
  });
}

function dialog(): HTMLDialogElement | null {
  return document.querySelector("dialog");
}

function factsButton(wrapper: ReturnType<typeof mountDetail>) {
  const button = wrapper
    .findAll("button")
    .find((b) => b.text() === "Facts behind this row");
  if (!button) throw new Error("no facts button");
  return button;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("F03", () => {
  it("CA1: shows Hero · name, class, level, NG+ tier, creation date and XP progress", async () => {
    const wrapper = mountDetail(readyApi());
    expect(wrapper.text()).toContain("Loading hero detail…");
    await flushPromises();

    expect(wrapper.get("h3").text()).toBe("Hero · Brakka");
    const facts = wrapper.get(".ranking-row-detail__facts").text();
    expect(facts).toContain("Warrior");
    expect(facts).toContain("12");
    expect(facts).toContain("NG+2");
    expect(facts).toContain("4 Mar 2026");
    const progress = wrapper.get("progress");
    expect(progress.attributes("aria-label")).toBe("1,200 / 3,000 XP");
    expect(progress.attributes("value")).toBe("40");
    expect(wrapper.text()).toContain("1,200 / 3,000 XP");
    expect(wrapper.text()).toContain("40%");
    wrapper.unmount();
  });

  it("CA2: lists the last runs with outcome as text, room, boss, XP and relative date", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-21T12:00:00Z") });
    const wrapper = mountDetail(readyApi());
    await flushPromises();

    expect(wrapper.text()).toContain("Last 4 runs");
    const runs = wrapper.findAll("ul[role='list'] li").map((li) => li.text());
    expect(runs).toHaveLength(3);
    expect(runs[0]).toContain("Victory");
    expect(runs[0]).toContain("12 / 12");
    expect(runs[0]).toContain("Lich King");
    expect(runs[0]).toContain("+340 XP");
    expect(runs[0]).toContain("3 min ago");
    expect(runs[1]).toContain("Defeat");
    expect(runs[1]).toContain("7 / 12");
    expect(runs[2]).toContain("Abandoned");
    wrapper.unmount();
  });

  it("CA2: says 'No run yet' when the hero never played", async () => {
    const wrapper = mountDetail(
      readyApi({
        getRankingHeroDetail: vi.fn().mockResolvedValue(heroDetail({ lastRuns: [] })),
      }),
    );
    await flushPromises();

    expect(wrapper.text()).toContain("No run yet");
    wrapper.unmount();
  });

  it("CA3: shows Bosses defeated and Deepest room as UiStat", async () => {
    const wrapper = mountDetail(readyApi());
    await flushPromises();

    const stats = wrapper.findAll(".ui-stat").map((s) => s.text());
    expect(stats).toEqual(["9Bosses defeated", "12Deepest room"]);
    wrapper.unmount();
  });

  it("CA4: links to the public profile, and hides it for a deleted player", async () => {
    const wrapper = mountDetail(readyApi());
    await flushPromises();
    const link = wrapper.findAll("a").find((a) => a.text() === "View public profile");
    expect(link?.attributes("href")).toBe("/players/player-1/heroes");
    wrapper.unmount();

    const deleted = mountDetail(
      readyApi({
        getRankingHeroDetail: vi.fn().mockResolvedValue(heroDetail({ playerId: null })),
      }),
    );
    await flushPromises();
    expect(deleted.text()).not.toContain("View public profile");
    deleted.unmount();
  });

  it("CA5: the drawer loads the facts only when opened and shows them", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-21T12:00:00Z") });
    const api = readyApi();
    const wrapper = mountDetail(api);
    await flushPromises();
    expect(api.getRankingHeroFacts).not.toHaveBeenCalled();

    await factsButton(wrapper).trigger("click");
    await flushPromises();

    expect(api.getRankingHeroFacts).toHaveBeenCalledWith(
      "hero-1",
      expect.any(AbortSignal),
    );
    const drawer = dialog()!;
    expect(drawer.getAttribute("aria-label")).toBe("Facts behind this row");
    const items = Array.from(drawer.querySelectorAll("li")).map(
      (li) => li.textContent ?? "",
    );
    expect(items).toHaveLength(3);
    expect(items[0]).toContain("RunCompleted");
    expect(items[0]).toContain("fact-1");
    expect(items[0]).toContain("3 min ago");
    expect(items[0]).toContain("Applied");
    expect(items[0]).toContain("+340 XP");
    expect(items[1]).toContain("Pending");
    expect(items[2]).toContain("Rejected");
    expect(items[2]).toContain("Duplicate fact");
    expect(drawer.textContent).toContain("XP from facts");
    expect(drawer.textContent).toContain("15,400 XP");
    expect(drawer.textContent).toContain("hero-1:v42");
    const rebuild = Array.from(drawer.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Rebuild from facts",
    )!;
    expect(rebuild.disabled).toBe(true);
    expect(drawer.textContent).toContain("Operators only");
    const note = document.getElementById(rebuild.getAttribute("aria-describedby")!);
    expect(note?.textContent).toBe("Operators only");
    wrapper.unmount();
  });

  it("CA5: traps the focus, closes on Escape and gives the focus back to the opener", async () => {
    const wrapper = mountDetail(readyApi());
    await flushPromises();
    const opener = factsButton(wrapper);
    (opener.element as HTMLElement).focus();
    await opener.trigger("click");
    await flushPromises();

    const drawer = dialog()!;
    expect(drawer.contains(document.activeElement)).toBe(true);

    const enabled = Array.from(
      drawer.querySelectorAll<HTMLElement>("button:not([disabled])"),
    );
    enabled[enabled.length - 1]!.focus();
    const tab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(drawer.contains(document.activeElement)).toBe(true);

    (opener.element as HTMLElement).focus();
    expect(drawer.contains(document.activeElement)).toBe(true);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener.element);
    wrapper.unmount();
  });

  it("CA6: a detail failure is an alert with Retry, confined to the row", async () => {
    const getRankingHeroDetail = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(heroDetail());
    const wrapper = mountDetail(readyApi({ getRankingHeroDetail }));
    await flushPromises();

    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain("Retry");
    expect(wrapper.find("h3").exists()).toBe(false);
    await alert.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.get("h3").text()).toBe("Hero · Brakka");
    wrapper.unmount();
  });

  it("CA6: the facts have their own loading and error states", async () => {
    let fail: (reason: unknown) => void = () => {};
    const getRankingHeroFacts = vi
      .fn()
      .mockImplementationOnce(() => new Promise((_, reject) => (fail = reject)))
      .mockResolvedValue(heroFacts());
    const wrapper = mountDetail(readyApi({ getRankingHeroFacts }));
    await flushPromises();
    await factsButton(wrapper).trigger("click");
    await flushPromises();

    expect(dialog()!.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "Loading facts…",
    );
    fail(new Error("boom"));
    await flushPromises();

    const alert = dialog()!.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("Retry");
    expect(wrapper.get("h3").text()).toBe("Hero · Brakka");
    expect(wrapper.find('.ranking-row-detail > div [role="alert"]').exists()).toBe(
      false,
    );
    alert.querySelector("button")!.click();
    await flushPromises();
    expect(dialog()!.textContent).toContain("Duplicate fact");
    wrapper.unmount();
  });

  it("CA7: text labels, a list role and a heading below the page h1, on simulated data", async () => {
    const api = createSimulatedLeaderboardApi({
      scenario: MockScenario.PLAYED,
      delayMs: 0,
    });
    const top = await api.getRanking({
      playerId: "me",
      heroClass: null,
      period: RankingPeriod.ALL_TIME,
      search: "",
      sort: RankingSort.TOTAL_XP,
      page: 1,
      pageSize: 10,
    });
    const wrapper = mountDetail(api);
    await wrapper.setProps({ heroId: top.entries[0]!.heroId });
    await new Promise((resolve) => setTimeout(resolve, 1));
    await flushPromises();

    expect(wrapper.findAll("h1")).toHaveLength(0);
    expect(wrapper.get("h3").text()).toMatch(/^Hero · /);
    expect(wrapper.get("ul").attributes("role")).toBe("list");
    expect(wrapper.get("progress").attributes("aria-label")).toMatch(/XP$/);
    wrapper.unmount();
  });

  describe("edge cases (tester)", () => {
    it("CA1: the XP progress never shows NaN nor exceeds 100% on odd data", async () => {
      const wrapper = mountDetail(
        readyApi({
          getRankingHeroDetail: vi
            .fn()
            .mockResolvedValue(heroDetail({ xpIntoLevel: 500, xpForNextLevel: 0 })),
        }),
      );
      await flushPromises();
      expect(wrapper.text()).not.toContain("NaN");
      expect(wrapper.text()).not.toContain("Infinity");
      expect(wrapper.text()).toContain("500 / 0 XP");
      const over = mountDetail(
        readyApi({
          getRankingHeroDetail: vi
            .fn()
            .mockResolvedValue(heroDetail({ xpIntoLevel: 4000, xpForNextLevel: 3000 })),
        }),
      );
      await flushPromises();
      expect(over.get("progress").attributes("value")).toBe("100");
      expect(over.text()).toContain("100%");
      wrapper.unmount();
      over.unmount();
    });

    it("CA1: a late answer for a previous hero never overwrites the current one", async () => {
      let resolveFirst: (value: unknown) => void = () => {};
      const getRankingHeroDetail = vi
        .fn()
        .mockImplementationOnce(
          () => new Promise((resolve) => (resolveFirst = resolve)),
        )
        .mockResolvedValue(heroDetail({ heroId: "hero-2", heroName: "Second" }));
      const wrapper = mountDetail(readyApi({ getRankingHeroDetail }));
      await wrapper.setProps({ heroId: "hero-2" });
      await flushPromises();
      resolveFirst(heroDetail());
      await flushPromises();
      expect(wrapper.get("h3").text()).toBe("Hero · Second");
      wrapper.unmount();
    });

    it("CA2: never shows more than 4 runs", async () => {
      const run = heroDetail().lastRuns[0]!;
      const wrapper = mountDetail(
        readyApi({
          getRankingHeroDetail: vi
            .fn()
            .mockResolvedValue(heroDetail({ lastRuns: Array(6).fill(run) })),
        }),
      );
      await flushPromises();
      expect(wrapper.findAll("ul[role='list'] li")).toHaveLength(4);
      wrapper.unmount();
    });

    it("CA4: the deleted player has no profile anchor at all", async () => {
      const wrapper = mountDetail(
        readyApi({
          getRankingHeroDetail: vi
            .fn()
            .mockResolvedValue(heroDetail({ playerId: null })),
        }),
      );
      await flushPromises();
      expect(
        wrapper.findAll("a").filter((a) => a.attributes("href")?.includes("/players/")),
      ).toHaveLength(0);
      // the facts remain reachable for a deleted player
      expect(factsButton(wrapper).exists()).toBe(true);
      wrapper.unmount();
    });

    it("CA5: Shift+Tab on the first control wraps to the last one", async () => {
      const wrapper = mountDetail(readyApi());
      await flushPromises();
      await factsButton(wrapper).trigger("click");
      await flushPromises();
      const drawer = dialog()!;
      const focusables = Array.from(
        drawer.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]"),
      );
      focusables[0]!.focus();
      const tab = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        cancelable: true,
      });
      document.dispatchEvent(tab);
      expect(tab.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(focusables[focusables.length - 1]);
      wrapper.unmount();
    });

    it("CA5: closing with the close button also returns the focus to the opener", async () => {
      const wrapper = mount(RankingRowDetail, {
        props: { heroId: "hero-1", currentPlayerId: "me" },
        global: {
          stubs: {
            ...stubs,
            UiIconButton: {
              emits: ["click"],
              template:
                '<button type="button" aria-label="Close dialog" @click="$emit(\'click\')">×</button>',
            },
          },
          provide: { [LEADERBOARD_API_KEY as symbol]: readyApi() },
        },
        attachTo: document.body,
      });
      await flushPromises();
      const opener = factsButton(wrapper);
      await opener.trigger("click");
      await flushPromises();
      const close = Array.from(dialog()!.querySelectorAll("button")).find(
        (b) => b.getAttribute("aria-label") === "Close dialog",
      )!;
      close.click();
      await flushPromises();
      expect(dialog()).toBeNull();
      expect(document.activeElement).toBe(opener.element);
      wrapper.unmount();
    });

    it("CA5: reopening reloads the facts; Rebuild stays disabled with no fact", async () => {
      const getRankingHeroFacts = vi
        .fn()
        .mockResolvedValueOnce(heroFacts())
        .mockResolvedValue(heroFacts({ facts: [] }));
      const wrapper = mountDetail(readyApi({ getRankingHeroFacts }));
      await flushPromises();
      await factsButton(wrapper).trigger("click");
      await flushPromises();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await flushPromises();
      await factsButton(wrapper).trigger("click");
      await flushPromises();
      expect(getRankingHeroFacts).toHaveBeenCalledTimes(2);
      const drawer = dialog()!;
      expect(drawer.textContent).not.toContain("Duplicate fact");
      const rebuild = Array.from(drawer.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Rebuild from facts",
      )!;
      expect(rebuild.disabled).toBe(true);
      expect(drawer.textContent).toContain("Operators only");
      wrapper.unmount();
    });

    it("CA5: while reopening, the previous facts are not shown as current", async () => {
      let resolveSecond: (value: unknown) => void = () => {};
      const getRankingHeroFacts = vi
        .fn()
        .mockResolvedValueOnce(heroFacts())
        .mockImplementationOnce(
          () => new Promise((resolve) => (resolveSecond = resolve)),
        );
      const wrapper = mountDetail(readyApi({ getRankingHeroFacts }));
      await flushPromises();
      await factsButton(wrapper).trigger("click");
      await flushPromises();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await flushPromises();
      await factsButton(wrapper).trigger("click");
      await flushPromises();
      try {
        const drawer = dialog()!;
        expect(drawer.querySelector('[aria-live="polite"]')?.textContent).toBe(
          "Loading facts…",
        );
        expect(drawer.textContent).not.toContain("Duplicate fact");
      } finally {
        resolveSecond(heroFacts());
        await flushPromises();
        wrapper.unmount();
      }
    });

    it("CA5: while reopening, the drawer is announced busy and the summary is hidden", async () => {
      let resolveSecond: (value: unknown) => void = () => {};
      const getRankingHeroFacts = vi
        .fn()
        .mockResolvedValueOnce(heroFacts())
        .mockImplementationOnce(
          () => new Promise((resolve) => (resolveSecond = resolve)),
        );
      const wrapper = mountDetail(readyApi({ getRankingHeroFacts }));
      await flushPromises();
      await factsButton(wrapper).trigger("click");
      await flushPromises();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await flushPromises();
      await factsButton(wrapper).trigger("click");
      await flushPromises();
      try {
        const drawer = dialog()!;
        expect(drawer.querySelector("[aria-busy='true']")).not.toBeNull();
        expect(drawer.textContent).not.toContain("XP from facts");
        expect(drawer.textContent).not.toContain("hero-1:v42");
      } finally {
        resolveSecond(heroFacts());
        await flushPromises();
      }
      expect(dialog()!.querySelector("[aria-busy='true']")).toBeNull();
      expect(dialog()!.textContent).toContain("XP from facts");
      wrapper.unmount();
    });

    it("CA6: reopening after a success then failing shows only the alert, not the old facts", async () => {
      const getRankingHeroFacts = vi
        .fn()
        .mockResolvedValueOnce(heroFacts())
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValue(heroFacts());
      const wrapper = mountDetail(readyApi({ getRankingHeroFacts }));
      await flushPromises();
      await factsButton(wrapper).trigger("click");
      await flushPromises();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await flushPromises();
      await factsButton(wrapper).trigger("click");
      await flushPromises();
      const drawer = dialog()!;
      const alert = drawer.querySelector('[role="alert"]')!;
      expect(alert.textContent).toContain("Retry");
      expect(drawer.textContent).not.toContain("Duplicate fact");
      expect(drawer.textContent).not.toContain("XP from facts");
      (alert.querySelector("button") as HTMLButtonElement).click();
      await flushPromises();
      expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
      expect(dialog()!.textContent).toContain("Duplicate fact");
      wrapper.unmount();
    });

    it("CA5: an answer arriving after closing does not leak into the next opening", async () => {
      let resolveFirst: (value: unknown) => void = () => {};
      let resolveSecond: (value: unknown) => void = () => {};
      const getRankingHeroFacts = vi
        .fn()
        .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
        .mockImplementationOnce(() => new Promise((r) => (resolveSecond = r)));
      const wrapper = mountDetail(readyApi({ getRankingHeroFacts }));
      await flushPromises();
      await factsButton(wrapper).trigger("click");
      await flushPromises();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await flushPromises();
      await factsButton(wrapper).trigger("click");
      await flushPromises();
      resolveFirst(heroFacts());
      await flushPromises();
      expect(dialog()!.querySelector('[aria-live="polite"]')?.textContent).toBe(
        "Loading facts…",
      );
      expect(dialog()!.textContent).not.toContain("Duplicate fact");
      resolveSecond(heroFacts({ facts: [] }));
      await flushPromises();
      expect(dialog()!.textContent).toContain("No fact yet");
      wrapper.unmount();
    });

    it("CA5: on simulated data, pending and rejected facts are labelled in text", async () => {
      const api = createSimulatedLeaderboardApi({
        scenario: MockScenario.LAGGING,
        delayMs: 0,
      });
      const top = await api.getRanking({
        playerId: "me",
        heroClass: null,
        period: RankingPeriod.ALL_TIME,
        search: "",
        sort: RankingSort.TOTAL_XP,
        page: 1,
        pageSize: 10,
      });
      const target =
        top.entries.find((e) => e.isPending && e.rank % 5 === 0) ??
        top.entries.find((e) => e.rank % 5 === 0)!;
      const wrapper = mount(RankingRowDetail, {
        props: { heroId: target.heroId, currentPlayerId: "me" },
        global: { stubs, provide: { [LEADERBOARD_API_KEY as symbol]: api } },
        attachTo: document.body,
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await flushPromises();
      await factsButton(wrapper).trigger("click");
      await new Promise((resolve) => setTimeout(resolve, 5));
      await flushPromises();
      const text = dialog()!.textContent ?? "";
      expect(text).toContain("Applied");
      expect(text).toContain("Rejected");
      expect(text).toMatch(/rebuild:/);
      wrapper.unmount();
    });

    it("CA6: in the error scenario, detail shows an alert with Retry", async () => {
      const api = createSimulatedLeaderboardApi({
        scenario: MockScenario.ERROR,
        delayMs: 0,
      });
      const wrapper = mountDetail(api);
      await new Promise((resolve) => setTimeout(resolve, 5));
      await flushPromises();
      const alert = wrapper.get('[role="alert"]');
      expect(alert.text()).toContain("Retry");
      expect(wrapper.text()).not.toContain("Loading hero detail…");
      wrapper.unmount();
    });

    it("CA6: a failing row detail leaves the sibling rows and the page intact", async () => {
      const getRankingHeroDetail = vi.fn((heroId: string) =>
        heroId === "broken"
          ? Promise.reject(new Error("boom"))
          : Promise.resolve(heroDetail({ heroId, heroName: `Name ${heroId}` })),
      );
      const captured: unknown[] = [];
      const Host = defineComponent({
        components: { RankingRowDetail },
        setup() {
          onErrorCaptured((error) => {
            captured.push(error);
            return false;
          });
        },
        template: `<div><h1>Leaderboard</h1><table><tbody>
          <tr><td>row A</td></tr>
          <tr><td><RankingRowDetail hero-id="broken" current-player-id="me" /></td></tr>
          <tr><td><RankingRowDetail hero-id="ok" current-player-id="me" /></td></tr>
          </tbody></table></div>`,
      });
      const wrapper = mount(Host, {
        global: {
          stubs,
          provide: {
            [LEADERBOARD_API_KEY as symbol]: readyApi({ getRankingHeroDetail }),
          },
        },
        attachTo: document.body,
      });
      await flushPromises();
      expect(captured).toEqual([]);
      expect(wrapper.findAll('[role="alert"]')).toHaveLength(1);
      expect(wrapper.text()).toContain("row A");
      expect(wrapper.text()).toContain("Hero · Name ok");
      expect(wrapper.findAll("h1")).toHaveLength(1);
      wrapper.unmount();
    });

    it("CA6: unmounting with the drawer open removes it and stops trapping focus", async () => {
      const wrapper = mountDetail(readyApi());
      await flushPromises();
      await factsButton(wrapper).trigger("click");
      await flushPromises();
      wrapper.unmount();
      expect(dialog()).toBeNull();
      const outside = document.createElement("button");
      document.body.appendChild(outside);
      outside.focus();
      const tab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
      document.dispatchEvent(tab);
      expect(tab.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(outside);
    });

    it("CA7: the outcome and fact status are text, the progress has an accessible name", async () => {
      const wrapper = mountDetail(readyApi());
      await flushPromises();
      expect(wrapper.find("[aria-busy='true']").exists()).toBe(false);
      const badges = wrapper.findAll("ul[role='list'] li").map((li) => li.text());
      for (const label of ["Victory", "Defeat", "Abandoned"]) {
        expect(badges.some((t) => t.includes(label))).toBe(true);
      }
      expect(factsButton(wrapper).attributes("aria-haspopup")).toBe("dialog");
      wrapper.unmount();
    });
  });
});
