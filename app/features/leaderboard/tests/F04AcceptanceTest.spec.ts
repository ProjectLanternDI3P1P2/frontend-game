/**
 * F04 — Page publique /rankings (rendue côté serveur, indexable).
 * Acceptance tests written from the feature sheet's criteria (CA1–CA9).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSSRApp,
  defineComponent,
  h,
  isRef,
  onMounted,
  onServerPrefetch,
  ref,
  type Component,
} from "vue";
import { renderToString } from "vue/server-renderer";
import { LEADERBOARD_API_KEY } from "../api/leaderboardSource";
import { GENERIC_LOAD_ERROR } from "../composables/loadError";
import { createSimulatedLeaderboardApi } from "../api/simulatedLeaderboardApi";
import { ANONYMOUS_HERO, HERO_CLASS_LABELS } from "../leaderboardRules";
import {
  HeroClass,
  MockScenario,
  type LeaderboardApi,
  type PublicRankingResponse,
  type RankingEntry,
} from "../types";
import RankingsPage from "~/pages/rankings.vue";
import { GatewayError } from "~/shared/utils/gateway";

const ROOT = join(__dirname, "../../../..");
const NOW = new Date("2026-10-21T12:00:00Z");

const NuxtLink = defineComponent({
  props: { to: { type: String, required: true } },
  setup(props, { slots }) {
    return () => h("a", { href: props.to }, slots.default?.());
  },
});

let route: { query: Record<string, unknown> };
let seo: Record<string, unknown>;
/** The H3 event of the request being rendered; undefined in the browser. */
let requestEvent: { statusCode: number } | undefined;
const setResponseStatus = vi.fn((event: { statusCode: number }, code: number) => {
  event.statusCode = code;
});

/** Nuxt-like: read during the server render, or after mounting in the browser. */
type AsyncDataHandler = (
  nuxtApp: unknown,
  options: { signal: AbortSignal },
) => Promise<unknown>;

function fakeUseAsyncData(_key: string, handler: AsyncDataHandler) {
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

function simulated(scenario: MockScenario = MockScenario.PLAYED): LeaderboardApi {
  return createSimulatedLeaderboardApi({ scenario, delayMs: 0, now: () => NOW });
}

/** Renders the page as the Nuxt server would, to an HTML string. */
async function renderOnServer(api?: LeaderboardApi): Promise<string> {
  const app = createSSRApp(RankingsPage as Component);
  app.component("NuxtLink", NuxtLink);
  if (api) app.provide(LEADERBOARD_API_KEY, api);
  requestEvent = { statusCode: 200 };
  try {
    return await renderToString(app);
  } finally {
    lastStatus = requestEvent.statusCode;
    requestEvent = undefined;
  }
}

/** The HTTP status the last server render answered with. */
let lastStatus = 0;

async function mountPage(api: LeaderboardApi) {
  const wrapper = mount(RankingsPage as Component, {
    global: {
      components: { NuxtLink },
      stubs: { UiIconButton: true },
      provide: { [LEADERBOARD_API_KEY as symbol]: api },
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 1));
  await flushPromises();
  return wrapper;
}

async function publicRanking(): Promise<PublicRankingResponse> {
  return simulated().getPublicRanking();
}

function seoValue(key: string): unknown {
  const value = seo[key];
  return isRef(value) ? value.value : value;
}

beforeEach(() => {
  route = { query: {} };
  seo = {};
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useAsyncData", fakeUseAsyncData);
  vi.stubGlobal("useRequestEvent", () => requestEvent);
  vi.stubGlobal("setResponseStatus", setResponseStatus);
  setResponseStatus.mockClear();
  lastStatus = 0;
  vi.stubGlobal("useSeoMeta", (input: Record<string, unknown>) => {
    seo = input;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("F04", () => {
  describe("CA1 — SSR with swr: 60, podium and top 10 in the server HTML", () => {
    it("CA1: /rankings is declared SSR with swr: 60, /leaderboard stays CSR", () => {
      const config = readFileSync(join(ROOT, "nuxt.config.ts"), "utf8");
      const rule = (path: string) =>
        config.match(
          new RegExp(`"${path.replace(/[*/]/g, "\\$&")}":\\s*(\\{[^}]*\\})`),
        )?.[1];
      expect(rule("/rankings")).toBe("{ ssr: true, prerender: false, swr: 60 }");
      expect(rule("/leaderboard")).toBe("{ ssr: false }");
      expect(rule("/players/*/heroes/*/statistics")).toBe("{ ssr: false }");
    });

    it("CA1: the route is justified in docs/rendering-modes.md", () => {
      const doc = readFileSync(join(ROOT, "docs/rendering-modes.md"), "utf8");
      const row = doc.split("\n").find((line) => line.startsWith("| `/rankings`"));
      expect(row).toBeDefined();
      expect(row).toContain("swr: 60");
      expect(row).toContain("D11");
    });

    it("CA1: the server-rendered HTML already holds the podium and the top 10", async () => {
      const expected = await publicRanking();
      const html = await renderOnServer(simulated());

      expect(html).toContain("Podium");
      for (const hero of expected.podium) expect(html).toContain(hero.heroName);
      expect(html).toContain("Top 10");
      expect(html.match(/<tr/g)?.length).toBe(11); // header + 10 heroes
      for (const hero of expected.top) expect(html).toContain(hero.heroName);
    });

    it("CA1: on the server, ?mock= is read from the route (no window)", async () => {
      route.query = { mock: MockScenario.EMPTY };
      const html = await renderOnServer();
      expect(html).toContain("No ranked run yet");
    });
  });

  describe("CA2 — heading, freshness and ranked heroes", () => {
    it("CA2: h1 « Rankings · <season> », the freshness date and the total", async () => {
      const expected = await publicRanking();
      const wrapper = await mountPage(simulated());

      expect(wrapper.get("h1").text()).toBe(`Rankings · ${expected.season.label}`);
      const time = wrapper.get("time");
      expect(time.attributes("datetime")).toBe(
        new Date(expected.consolidatedAt!).toISOString(),
      );
      expect(time.text()).toMatch(/^Updated \d{1,2} \w{3} \d{4}, \d{2}:\d{2} UTC$/);
      expect(wrapper.text()).toContain(`${expected.totalCount} ranked heroes`);
    });
  });

  describe("CA3 — podium cards", () => {
    it("CA3: three cards with medal text, hero, class, level, XP and player", async () => {
      const expected = await publicRanking();
      const wrapper = await mountPage(simulated());
      const cards = wrapper.findAll(".public-podium__card");

      expect(cards).toHaveLength(3);
      const medals = ["1st · Gold", "2nd · Silver", "3rd · Bronze"];
      cards.forEach((card, index) => {
        const hero = expected.podium[index]!;
        expect(card.text()).toContain(medals[index]);
        expect(card.get("h3").text()).toBe(hero.heroName);
        expect(card.text()).toContain(HERO_CLASS_LABELS[hero.heroClass]);
        expect(card.text()).toContain(String(hero.level));
        expect(card.text()).toContain(hero.totalXp.toLocaleString("en-GB"));
        expect(card.text()).toContain(hero.playerName ?? ANONYMOUS_HERO);
      });
    });

    it("CA3: a deleted player reads « Anonymous hero »", async () => {
      const api = simulated();
      const real = await api.getPublicRanking();
      const podium = real.podium.map((hero, index) =>
        index === 1 ? { ...hero, playerId: null, playerName: null } : hero,
      );
      vi.spyOn(api, "getPublicRanking").mockResolvedValue({ ...real, podium });
      const wrapper = await mountPage(api);

      const card = wrapper.findAll(".public-podium__card")[1]!;
      expect(card.text()).toContain("Anonymous hero");
      expect(wrapper.text()).not.toMatch(/null|undefined/);
    });
  });

  describe("CA4 — leaders by class", () => {
    it("CA4: « <season> leaders by class » with one card per class", async () => {
      const expected = await publicRanking();
      const wrapper = await mountPage(simulated());
      const section = wrapper.get(".public-class-leaders");

      expect(section.get("h2").text()).toBe(
        `${expected.season.label} leaders by class`,
      );
      const cards = section.findAll("li");
      expect(cards.map((card) => card.get("h3").text())).toEqual(
        expected.leadersByClass.map((leader) => HERO_CLASS_LABELS[leader.heroClass]),
      );
      expected.leadersByClass.forEach((leader, index) => {
        expect(cards[index]!.text()).toContain(leader.entry!.heroName);
      });
    });

    it("CA4: a class without leader reads « No ranked hero yet »", async () => {
      const api = simulated();
      const real = await api.getPublicRanking();
      vi.spyOn(api, "getPublicRanking").mockResolvedValue({
        ...real,
        leadersByClass: real.leadersByClass.map((leader) =>
          leader.heroClass === HeroClass.MAGE ? { ...leader, entry: null } : leader,
        ),
      });
      const wrapper = await mountPage(api);
      const mage = wrapper
        .findAll(".public-class-leaders li")
        .find((card) => card.get("h3").text() === "Mage")!;
      expect(mage.text()).toContain("No ranked hero yet");
    });
  });

  describe("CA3/CA4/CA5 — edge cases from the criteria", () => {
    it("CA3: a podium of a single hero shows one gold card, no crash", async () => {
      const api = simulated();
      const real = await api.getPublicRanking();
      vi.spyOn(api, "getPublicRanking").mockResolvedValue({
        ...real,
        podium: real.podium.slice(0, 1),
      });
      const wrapper = await mountPage(api);
      const cards = wrapper.findAll(".public-podium__card");
      expect(cards).toHaveLength(1);
      expect(cards[0]!.text()).toContain("1st · Gold");
    });

    it("CA3: hero names are escaped in the server HTML", async () => {
      const api = simulated();
      const real = await api.getPublicRanking();
      const evil = '<img src=x onerror="alert(1)">';
      vi.spyOn(api, "getPublicRanking").mockResolvedValue({
        ...real,
        podium: real.podium.map((hero, i) =>
          i === 0 ? { ...hero, heroName: evil } : hero,
        ),
      });
      const html = await renderOnServer(api);
      expect(html).not.toContain(evil);
      expect(html).toContain("&lt;img");
    });

    it("CA4: one card per class, even when a class is missing from the response", async () => {
      const api = simulated();
      const real = await api.getPublicRanking();
      vi.spyOn(api, "getPublicRanking").mockResolvedValue({
        ...real,
        leadersByClass: real.leadersByClass.filter(
          (leader) => leader.heroClass !== HeroClass.SHAMAN,
        ),
      });
      const wrapper = await mountPage(api);
      const cards = wrapper.findAll(".public-class-leaders li");
      expect(cards.map((card) => card.get("h3").text()).sort()).toEqual(
        Object.values(HeroClass)
          .map((c) => HERO_CLASS_LABELS[c])
          .sort(),
      );
      const shaman = cards.find((card) => card.get("h3").text() === "Shaman")!;
      expect(shaman.text()).toContain("No ranked hero yet");
    });

    it.each([
      ["an empty list", []],
      ["a missing list", undefined],
    ])(
      "CA4: one « No ranked hero yet » card per class with %s of leaders",
      async (_label, leadersByClass) => {
        const api = simulated();
        const real = await api.getPublicRanking();
        vi.spyOn(api, "getPublicRanking").mockResolvedValue({
          ...real,
          leadersByClass: leadersByClass as PublicRankingResponse["leadersByClass"],
        });
        const wrapper = await mountPage(api);
        const section = wrapper.get(".public-class-leaders");
        const cards = section.findAll("li");
        expect(cards.map((card) => card.get("h3").text())).toEqual(
          Object.values(HeroClass).map((c) => HERO_CLASS_LABELS[c]),
        );
        for (const card of cards) expect(card.text()).toContain("No ranked hero yet");
        // The rest of the page still renders.
        expect(wrapper.findAll(".public-podium__card")).toHaveLength(3);
        expect(wrapper.findAll(".public-top-table tbody tr")).toHaveLength(10);
      },
    );

    it("CA4: an empty list of leaders is in the server HTML too", async () => {
      const api = simulated();
      const real = await api.getPublicRanking();
      vi.spyOn(api, "getPublicRanking").mockResolvedValue({
        ...real,
        leadersByClass: [],
      });
      const html = await renderOnServer(api);
      expect(html.match(/No ranked hero yet/g)).toHaveLength(
        Object.values(HeroClass).length,
      );
      expect(lastStatus).toBe(200);
    });

    it("CA4: a deleted leader reads « Anonymous hero »", async () => {
      const api = simulated();
      const real = await api.getPublicRanking();
      vi.spyOn(api, "getPublicRanking").mockResolvedValue({
        ...real,
        leadersByClass: real.leadersByClass.map((leader) =>
          leader.entry
            ? {
                ...leader,
                entry: { ...leader.entry, playerId: null, playerName: null },
              }
            : leader,
        ),
      });
      const wrapper = await mountPage(api);
      const text = wrapper.get(".public-class-leaders").text();
      expect(text).toContain("Anonymous hero");
      expect(text).not.toMatch(/null|undefined/);
    });

    it("CA5: a top shorter than 10 lists only the ranked heroes", async () => {
      const api = simulated();
      const real = await api.getPublicRanking();
      vi.spyOn(api, "getPublicRanking").mockResolvedValue({
        ...real,
        top: real.top.slice(0, 4),
      });
      const wrapper = await mountPage(api);
      expect(wrapper.findAll(".public-top-table tbody tr")).toHaveLength(4);
    });
  });

  describe("CA5 — top 10 table", () => {
    it("CA5: Rank, Trend, Player, Hero, Class, Level, Total XP for the 10 best", async () => {
      const expected = await publicRanking();
      const wrapper = await mountPage(simulated());
      const table = wrapper.get(".public-top-table table");

      expect(table.findAll("thead th").map((th) => th.text())).toEqual([
        "Rank",
        "Trend",
        "Player",
        "Hero",
        "Class",
        "Level",
        "Total XP",
      ]);
      const rows = table.findAll("tbody tr");
      expect(rows).toHaveLength(10);
      rows.forEach((row, index) => {
        const hero: RankingEntry = expected.top[index]!;
        const cells = row.findAll("td, th");
        expect(cells[0]!.text()).toBe(String(hero.rank));
        expect(cells[2]!.text()).toBe(hero.playerName ?? ANONYMOUS_HERO);
        expect(cells[3]!.text()).toBe(hero.heroName);
        expect(cells[4]!.text()).toBe(HERO_CLASS_LABELS[hero.heroClass]);
        expect(cells[5]!.text()).toBe(String(hero.level));
        expect(cells[6]!.text()).toBe(hero.totalXp.toLocaleString("en-GB"));
      });
    });
  });

  describe("CA6 — call to action", () => {
    it("CA6: « Claim your place » leads to /leaderboard", async () => {
      const wrapper = await mountPage(simulated());
      const cta = wrapper.findAll("a").find((a) => a.text() === "Claim your place");
      expect(cta?.attributes("href")).toBe("/leaderboard");
    });

    it("CA6: the call to action stays available when nothing is ranked", async () => {
      const wrapper = await mountPage(simulated(MockScenario.EMPTY));
      const cta = wrapper.findAll("a").find((a) => a.text() === "Claim your place");
      expect(cta?.attributes("href")).toBe("/leaderboard");
    });
  });

  describe("CA7 — SEO metadata", () => {
    it("CA7: title, description, og:title and og:description", async () => {
      const expected = await publicRanking();
      await mountPage(simulated());

      const title = `Rankings · ${expected.season.label}`;
      expect(seoValue("title")).toBe(title);
      expect(seoValue("ogTitle")).toBe(title);
      const description = seoValue("description") as string;
      expect(description).toContain(expected.season.label);
      expect(description.length).toBeGreaterThan(50);
      expect(seoValue("ogDescription")).toBe(description);
    });

    it("CA7: the metadata is in place even when the read failed", async () => {
      await mountPage(simulated(MockScenario.ERROR));
      expect(seoValue("title")).toBe("Rankings");
      expect(seoValue("description")).toBeTruthy();
      expect(seoValue("ogTitle")).toBe("Rankings");
    });
  });

  describe("CA8 — empty and error states", () => {
    it("CA8: a failed server read answers 503 so that swr never caches it", async () => {
      const api = simulated();
      vi.spyOn(api, "getPublicRanking").mockRejectedValue(new Error("boom"));
      const html = await renderOnServer(api);
      expect(html).toContain("The rankings could not be loaded");
      expect(lastStatus).toBe(503);
    });

    it("CA8: a successful or empty server read keeps 200 (cacheable)", async () => {
      await renderOnServer(simulated());
      expect(lastStatus).toBe(200);
      await renderOnServer(simulated(MockScenario.EMPTY));
      expect(lastStatus).toBe(200);
      expect(setResponseStatus).not.toHaveBeenCalled();
    });

    it("CA8: the public page shows a fixed message, never the Gateway's wording", async () => {
      const api = simulated();
      vi.spyOn(api, "getPublicRanking").mockRejectedValue(
        new GatewayError(503, { code: "DOWN", message: "pg: connection refused" }),
      );
      const wrapper = await mountPage(api);
      const alert = wrapper.get('[role="alert"]');
      expect(alert.text()).toContain(GENERIC_LOAD_ERROR);
      expect(alert.text()).not.toContain("connection refused");
    });

    it("CA8: no data reads « No ranked run yet », without error", async () => {
      const wrapper = await mountPage(simulated(MockScenario.EMPTY));
      expect(wrapper.text()).toContain("No ranked run yet");
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.find("table").exists()).toBe(false);
      expect(wrapper.get("h1").text()).toBe("Rankings · Season 4");
    });

    it("CA8: a failed read shows an explicit message and a Retry", async () => {
      const api = simulated(MockScenario.ERROR);
      const spy = vi.spyOn(api, "getPublicRanking");
      const wrapper = await mountPage(api);

      const alert = wrapper.get('[role="alert"]');
      expect(alert.text()).toContain("The rankings could not be loaded");
      expect(alert.text().length).toBeGreaterThan(
        "The rankings could not be loaded".length,
      );
      await wrapper
        .findAll("button")
        .find((b) => b.text() === "Retry")!
        .trigger("click");
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("CA8: a failed read never breaks the server render", async () => {
      const api = simulated();
      vi.spyOn(api, "getPublicRanking").mockRejectedValue(new Error("boom"));
      const html = await renderOnServer(api);
      expect(html).toContain("The rankings could not be loaded");
      expect(html).toContain("<h1");
    });

    it("CA8: ?mock=error renders the error on the server", async () => {
      route.query = { mock: MockScenario.ERROR };
      const html = await renderOnServer();
      expect(html).toContain('role="alert"');
      expect(html).toContain("The rankings could not be loaded");
      expect(lastStatus).toBe(503);
    });
  });

  describe("CA9 — accessibility (RGAA) and project rules", () => {
    it("CA9: one h1, a main landmark, column headers with scope=col", async () => {
      const wrapper = await mountPage(simulated());
      expect(wrapper.findAll("h1")).toHaveLength(1);
      expect(wrapper.findAll("main")).toHaveLength(1);
      const headers = wrapper.findAll("thead th");
      expect(headers.every((th) => th.attributes("scope") === "col")).toBe(true);
      expect(wrapper.find("table caption").exists()).toBe(true);
      expect(wrapper.findAll('ol[role="list"], ul[role="list"]')).toHaveLength(2);
    });

    it("CA9: trend and medals are spelled out, never colour alone", async () => {
      const api = simulated();
      const real = await api.getPublicRanking();
      const top = real.top.map((hero, index) => ({
        ...hero,
        rankDelta: [3, -2, 0, null][index % 4]!,
      }));
      vi.spyOn(api, "getPublicRanking").mockResolvedValue({ ...real, top });
      const wrapper = await mountPage(api);

      const trends = wrapper
        .findAll(".public-top-table__trend .visually-hidden")
        .map((t) => t.text());
      expect(trends.slice(0, 4)).toEqual([
        "Up 3 places",
        "Down 2 places",
        "No change",
        "New in the ranking",
      ]);
      const medals = wrapper.findAll(".public-podium__medal").map((m) => m.text());
      expect(medals).toEqual(["1st · Gold", "2nd · Silver", "3rd · Bronze"]);
    });

    it("CA9: visible focus and reduced motion are honoured in the styles", () => {
      const view = readFileSync(
        join(ROOT, "app/features/leaderboard/components/PublicRankingView.vue"),
        "utf8",
      );
      expect(view).toContain(":focus-visible");
      expect(view).toContain("outline: 2px solid var(--color-focus-ring)");
      // Any transition is wrapped in the reduced-motion guard.
      expect(view).toMatch(/motion-safe\s*\{\s*transition/);
    });

    it("CA9: the trend text reaches a 4.5:1 contrast on the table surface", () => {
      // RGAA 3.2: visible text (here « ▼ 2 », « NEW », 12px) needs 4.5:1, even
      // when its spoken form is in a visually-hidden twin.
      const tokens = readFileSync(join(ROOT, "app/assets/styles/_tokens.scss"), "utf8");
      const table = readFileSync(
        join(ROOT, "app/features/leaderboard/components/PublicTopTable.vue"),
        "utf8",
      );
      const resolve = (name: string, depth = 0): string => {
        const value = tokens.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();
        if (!value || depth > 5) throw new Error(`unresolved ${name}`);
        const ref = value.match(/^var\((--[\w-]+)\)$/)?.[1];
        return ref ? resolve(ref, depth + 1) : value;
      };
      const luminance = (hex: string) => {
        const [r, g, b] = [1, 3, 5].map((i) => {
          const c = parseInt(hex.slice(i, i + 2), 16) / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
      };
      const contrast = (a: string, b: string) => {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (hi! + 0.05) / (lo! + 0.05);
      };
      const surface = resolve("--color-surface-raised");
      const trendBlock = table.slice(table.indexOf("&__trend"));
      const failures: string[] = [];
      const checked: string[] = [];
      for (const [, modifier, token] of trendBlock.matchAll(
        /&--(\w+)\s*\{\s*color:\s*var\((--color-[\w-]+)\)/g,
      )) {
        const ratio = contrast(resolve(token!), surface);
        checked.push(modifier!);
        if (ratio < 4.5) failures.push(`${modifier} (${token}): ${ratio.toFixed(2)}:1`);
      }
      expect(failures).toEqual([]);
      // Every direction has its own colour rule, so none is left unchecked.
      expect(checked.sort()).toEqual(["down", "new", "stable", "up"]);
    });

    it("CA9: no mocks/ import and no external dependency in the F04 sources", () => {
      const files = [
        "app/pages/rankings.vue",
        "app/features/leaderboard/composables/usePublicRanking.ts",
        "app/features/leaderboard/components/PublicRankingView.vue",
        "app/features/leaderboard/components/PublicPodium.vue",
        "app/features/leaderboard/components/PublicClassLeaders.vue",
        "app/features/leaderboard/components/PublicTopTable.vue",
      ];
      for (const file of files) {
        const source = readFileSync(join(ROOT, file), "utf8");
        expect(source, file).not.toMatch(/from\s+["'][^"']*mocks\//);
        expect(source, file).not.toMatch(/\bwindow\./);
        for (const [, spec] of source.matchAll(/from\s+["']([^"']+)["']/g)) {
          const external = !spec!.startsWith(".") && !spec!.startsWith("~");
          if (external) expect(["vue"], `${file}: ${spec}`).toContain(spec);
        }
      }
    });
  });
});
