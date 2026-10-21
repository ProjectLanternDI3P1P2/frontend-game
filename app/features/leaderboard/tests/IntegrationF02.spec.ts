/**
 * Integration of F02 (ranking page) with F03 (row detail) and F04 (public
 * rankings). Interactions only; each feature's own criteria live in its
 * acceptance file.
 */
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSSRApp,
  defineComponent,
  h,
  onMounted,
  onServerPrefetch,
  reactive,
  ref,
  type Component,
} from "vue";
import { renderToString } from "vue/server-renderer";
import { LEADERBOARD_API_KEY } from "../api/leaderboardSource";
import { createSimulatedLeaderboardApi } from "../api/simulatedLeaderboardApi";
import RankingRow from "../components/RankingRow.vue";
import RankingRowDetail from "../components/RankingRowDetail.vue";
import LeaderboardTable from "../components/LeaderboardTable.vue";
import { MockScenario, type LeaderboardApi } from "../types";
import { apiStub, entry, ranking } from "./fixtures/leaderboardFixtures";
import { heroDetail, heroFacts } from "./fixtures/rankingDetailFixtures";
import LeaderboardPage from "~/pages/leaderboard.vue";
import RankingsPage from "~/pages/rankings.vue";
import { SEEDED_PLAYER_ID } from "~/features/player/seededPlayer";

const ME = SEEDED_PLAYER_ID;
const NOW = new Date("2026-10-21T12:00:00Z");

const NuxtLink = defineComponent({
  props: { to: { type: String, required: true } },
  setup(props, { slots }) {
    return () => h("a", { href: props.to }, slots.default?.());
  },
});
const stubs = { NuxtLink, UiIconButton: true };

let route: { params: Record<string, string>; query: Record<string, unknown> };
let navigate: ReturnType<typeof vi.fn>;
const mounted: VueWrapper[] = [];

function fakeUseAsyncData(
  _key: string,
  handler: (app: unknown, o: { signal: AbortSignal }) => Promise<unknown>,
) {
  const data = ref<unknown>(undefined);
  const error = ref<unknown>(undefined);
  const status = ref("idle");
  async function run() {
    status.value = "pending";
    try {
      data.value = await handler(undefined, { signal: new AbortController().signal });
      status.value = "success";
    } catch (cause) {
      error.value = cause;
      status.value = "error";
    }
  }
  onServerPrefetch(run);
  onMounted(run);
  return { data, error, status, refresh: run };
}

beforeEach(() => {
  route = reactive({ params: {}, query: {} });
  navigate = vi.fn((to: unknown) => {
    if (typeof to === "object" && to !== null && "query" in to) {
      route.query = { ...(to as { query: Record<string, unknown> }).query };
    }
  });
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("navigateTo", navigate);
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useHead", vi.fn());
  vi.stubGlobal("useSeoMeta", vi.fn());
  vi.stubGlobal("useAsyncData", fakeUseAsyncData);
  vi.stubGlobal("useRequestEvent", () => undefined);
  vi.stubGlobal("setResponseStatus", vi.fn());
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function simulated(scenario = MockScenario.PLAYED): LeaderboardApi {
  return createSimulatedLeaderboardApi({ scenario, delayMs: 0, now: () => NOW });
}

function mountLeaderboard(api: LeaderboardApi = simulated()) {
  const wrapper = mount(LeaderboardPage, {
    attachTo: document.body,
    global: { stubs, provide: { [LEADERBOARD_API_KEY as symbol]: api } },
  });
  mounted.push(wrapper);
  return wrapper;
}

async function settle(rounds = 3): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    await flushPromises();
  }
}

/** Headings in document order, as `h<level>:text`. */
function outline(root: Element): string[] {
  return [...root.querySelectorAll("h1, h2, h3, h4, h5, h6")].map(
    (el) => `${el.tagName.toLowerCase()}:${el.textContent?.trim()}`,
  );
}

/** No heading jumps more than one level down from the previous one. */
function expectNoSkippedLevel(headings: string[]): void {
  let previous = 0;
  for (const heading of headings) {
    const level = Number(heading[1]);
    expect(
      level,
      `skipped level at ${heading} in ${headings.join(" > ")}`,
    ).toBeLessThanOrEqual(previous + 1);
    previous = level;
  }
}

function toggles(wrapper: VueWrapper) {
  return wrapper.findAll("button[data-hero-id]");
}

/** A page of 10 others plus one of my heroes pinned under the table. */
function stubbedApi(
  overrides: Partial<Record<keyof LeaderboardApi, ReturnType<typeof vi.fn>>> = {},
) {
  const entries = Array.from({ length: 10 }, (_, i) =>
    entry(i + 1, `p-${i + 1}`, { heroId: `hero-${i + 1}`, heroName: `Hero ${i + 1}` }),
  );
  const mine = entry(42, ME, { heroId: "my-hero", heroName: "Mine", playerName: "Me" });
  return apiStub({
    // A fresh body per read, as a real Gateway answers.
    getRanking: vi.fn(() =>
      Promise.resolve(ranking({ entries: [...entries], me: [mine], totalCount: 120 })),
    ),
    getRankingHeroDetail: vi.fn((heroId: string) =>
      Promise.resolve(heroDetail({ heroId, heroName: `Detail ${heroId}` })),
    ),
    getRankingHeroFacts: vi.fn((heroId: string) =>
      Promise.resolve(heroFacts({ heroId })),
    ),
    ...overrides,
  });
}

describe("Integration F02 x F03 — expanded line with RankingRowDetail", () => {
  it("heading outline: one h1, the table h2, then the detail h3 and its h4", async () => {
    const wrapper = mountLeaderboard();
    await settle();

    await toggles(wrapper)[0]!.trigger("click");
    await settle();

    const headings = outline(wrapper.element);
    expect(headings.filter((x) => x.startsWith("h1:"))).toEqual(["h1:Leaderboard"]);
    const h2 = headings.findIndex((x) => x.startsWith("h2:Ranking"));
    const h3 = headings.findIndex((x) => x.startsWith("h3:Hero ·"));
    expect(h2).toBeGreaterThan(0);
    expect(h3).toBeGreaterThan(h2);
    expect(headings[h3 + 1]).toBe("h4:Last 4 runs");
    expectNoSkippedLevel(headings);
  });

  it("heading outline holds for a pinned hero of mine expanded in the table foot", async () => {
    const api = stubbedApi();
    const wrapper = mountLeaderboard(api);
    await settle();

    await wrapper.get('tfoot button[data-hero-id="my-hero"]').trigger("click");
    await settle();

    expect(wrapper.find("tfoot").text()).toContain("Hero · Detail my-hero");
    const headings = outline(wrapper.element);
    expect(headings.filter((x) => x.startsWith("h1:"))).toHaveLength(1);
    expectNoSkippedLevel(headings);
  });

  it("the facts drawer (UiModal h2) opened from the detail keeps one h1 on the page", async () => {
    const api = stubbedApi();
    const wrapper = mountLeaderboard(api);
    await settle();
    await toggles(wrapper)[0]!.trigger("click");
    await settle();

    const facts = wrapper
      .findAll("button")
      .find((b) => b.text() === "Facts behind this row");
    expect(facts).toBeDefined();
    await facts!.trigger("click");
    await settle();

    expect(api.getRankingHeroFacts).toHaveBeenCalledWith("hero-1", expect.anything());
    expect(document.body.querySelectorAll("h1")).toHaveLength(1);
    expect(outline(document.body)).toContain("h2:Facts behind this row");
    // The line it was opened from stays expanded.
    expect(wrapper.findAllComponents(RankingRowDetail)).toHaveLength(1);
  });

  it("one line at a time: the detail follows the expanded line and reads its hero", async () => {
    const api = stubbedApi();
    const wrapper = mountLeaderboard(api);
    await settle();

    await toggles(wrapper)[0]!.trigger("click");
    await settle();
    await toggles(wrapper)[4]!.trigger("click");
    await settle();

    const details = wrapper.findAllComponents(RankingRowDetail);
    expect(details).toHaveLength(1);
    expect(details[0]!.props("heroId")).toBe("hero-5");
    expect(details[0]!.text()).toContain("Hero · Detail hero-5");
    expect(wrapper.text()).not.toContain("Hero · Detail hero-1");
    expect(api.getRankingHeroDetail).toHaveBeenLastCalledWith(
      "hero-5",
      expect.anything(),
    );
    expect(wrapper.findAll('[aria-expanded="true"]')).toHaveLength(1);

    // A pinned hero expands too, and closes the line of the page.
    await wrapper.get('tfoot button[data-hero-id="my-hero"]').trigger("click");
    await settle();
    expect(wrapper.findAllComponents(RankingRowDetail)).toHaveLength(1);
    expect(wrapper.getComponent(RankingRowDetail).props("heroId")).toBe("my-hero");
    expect(wrapper.find("tbody .ranking-row__detail").exists()).toBe(false);
  });

  it("aria-controls of the toggle points at the row holding the F03 detail", async () => {
    const wrapper = mountLeaderboard(stubbedApi());
    await settle();
    await toggles(wrapper)[2]!.trigger("click");
    await settle();

    const toggle = toggles(wrapper)[2]!;
    const target = document.getElementById(toggle.attributes("aria-controls")!);
    expect(target?.querySelector(".ranking-row-detail")).not.toBeNull();
    expect(target?.textContent).toContain("Hero · Detail hero-3");
  });

  it("clicks inside the detail (links, facts, retry) never fold the line", async () => {
    const getRankingHeroDetail = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockImplementation((heroId: string) => Promise.resolve(heroDetail({ heroId })));
    const api = stubbedApi({ getRankingHeroDetail });
    const wrapper = mountLeaderboard(api);
    await settle();

    await toggles(wrapper)[1]!.trigger("click");
    await settle();

    const detail = wrapper.getComponent(RankingRowDetail);
    expect(detail.find('[role="alert"]').exists()).toBe(true);
    await detail
      .findAll("button")
      .find((b) => b.text() === "Retry")!
      .trigger("click");
    await settle();
    expect(wrapper.findAllComponents(RankingRowDetail)).toHaveLength(1);
    expect(getRankingHeroDetail).toHaveBeenCalledTimes(2);

    const link = wrapper
      .getComponent(RankingRowDetail)
      .findAll("a")
      .find((a) => a.text() === "View public profile");
    expect(link?.attributes("href")).toBe("/players/player-1/heroes");
    await link!.trigger("click");
    await wrapper.get(".ranking-row-detail").trigger("click");
    expect(wrapper.findAllComponents(RankingRowDetail)).toHaveLength(1);
    expect(toggles(wrapper)[1]!.attributes("aria-expanded")).toBe("true");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("an error of the detail stays in the detail: the table, pagination and page state stay", async () => {
    const api = stubbedApi({
      getRankingHeroDetail: vi.fn().mockRejectedValue(new Error("detail down")),
    });
    const wrapper = mountLeaderboard(api);
    await settle();
    await toggles(wrapper)[0]!.trigger("click");
    await settle();

    const alerts = wrapper.findAll('[role="alert"]');
    expect(alerts).toHaveLength(1);
    expect(wrapper.getComponent(RankingRowDetail).find('[role="alert"]').exists()).toBe(
      true,
    );
    expect(wrapper.text()).not.toContain("The leaderboard could not be loaded");
    expect(toggles(wrapper)).toHaveLength(11);
    expect(wrapper.text()).toMatch(/page 1 of 12/);
  });

  it("Jump to my rank focuses the line toggle, not a control of an open detail", async () => {
    const api = stubbedApi();
    const wrapper = mountLeaderboard(api);
    await settle();
    await wrapper.get('tfoot button[data-hero-id="my-hero"]').trigger("click");
    await settle();

    const jump = wrapper.findAll("button").find((b) => b.text() === "Jump to my rank")!;
    await jump.trigger("click");
    await settle();

    const active = document.activeElement as HTMLElement | null;
    expect(active?.dataset.heroId).toBe("my-hero");
    expect(active?.getAttribute("aria-expanded")).not.toBeNull();
  });

  it("Refresh view keeps the open detail without reading it again", async () => {
    const api = stubbedApi();
    const wrapper = mountLeaderboard(api);
    await settle();
    await toggles(wrapper)[0]!.trigger("click");
    await settle();
    expect(api.getRankingHeroDetail).toHaveBeenCalledTimes(1);

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Refresh view")!
      .trigger("click");
    await settle();

    expect(api.getRanking).toHaveBeenCalledTimes(2);
    expect(wrapper.findAllComponents(RankingRowDetail)).toHaveLength(1);
    expect(wrapper.getComponent(RankingRowDetail).text()).toContain(
      "Hero · Detail hero-1",
    );
  });
});

describe("Integration F02 x F04 — public rankings next to the ranking page", () => {
  async function mountRankings(api: LeaderboardApi = simulated()) {
    const wrapper = mount(RankingsPage as Component, {
      attachTo: document.body,
      global: {
        components: { NuxtLink },
        stubs: { UiIconButton: true },
        provide: { [LEADERBOARD_API_KEY as symbol]: api },
      },
    });
    mounted.push(wrapper);
    await settle();
    return wrapper;
  }

  it("CA12 round trip: « Public rankings » → /rankings, « Claim your place » → /leaderboard", async () => {
    const board = mountLeaderboard();
    await settle();
    const toPublic = board.findAll("a").find((a) => a.text() === "Public rankings");
    expect(toPublic?.attributes("href")).toBe("/rankings");
    board.unmount();
    mounted.splice(mounted.indexOf(board), 1);

    const page = await mountRankings();
    const back = page.findAll("a").find((a) => a.text() === "Claim your place");
    expect(back?.attributes("href")).toBe("/leaderboard");
  });

  it("/rankings renders its own content, without the F02 table, rows or detail", async () => {
    const page = await mountRankings();

    expect(page.findAll("h1").map((x) => x.text())).toEqual([
      expect.stringMatching(/^Rankings · /),
    ]);
    expect(page.text()).toContain("Podium");
    expect(page.text()).toContain("Top 10");
    expect(page.findComponent(LeaderboardTable).exists()).toBe(false);
    expect(page.findComponent(RankingRow).exists()).toBe(false);
    expect(page.findComponent(RankingRowDetail).exists()).toBe(false);
    expect(page.find("[aria-expanded]").exists()).toBe(false);
    expect(page.text()).not.toContain("Jump to my rank");
    expectNoSkippedLevel(outline(page.element));
  });

  it("/rankings server render still holds one h1, the podium and the top 10", async () => {
    const app = createSSRApp(RankingsPage as Component);
    app.component("NuxtLink", NuxtLink);
    app.provide(LEADERBOARD_API_KEY, simulated());
    const html = await renderToString(app);

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Podium");
    expect(html).toContain("Top 10");
    expect(html).toContain('href="/leaderboard"');
    expect(html).not.toContain("ranking-row");
  });

  it("the public page and the ranking page read the same top hero", async () => {
    const api = simulated();
    const board = mountLeaderboard(api);
    await settle();
    const firstOnBoard = board.get("tbody th[scope='row']").text();

    const page = await mountRankings(api);
    expect(page.text()).toContain(firstOnBoard);
  });
});
