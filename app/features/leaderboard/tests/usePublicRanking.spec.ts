import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { createSimulatedLeaderboardApi } from "../api/simulatedLeaderboardApi";
import {
  LOADING_PUBLIC_RANKING,
  PUBLIC_RANKING_ERROR,
  PUBLIC_RANKING_ERROR_STATUS,
  PUBLIC_RANKING_KEY,
  formatFreshness,
  formatRankedHeroes,
  isPublicRankingEmpty,
  loadPublicRanking,
  usePublicRanking,
} from "../composables/usePublicRanking";
import { GENERIC_LOAD_ERROR } from "../composables/loadError";
import { LoadStatus, MockScenario, type PublicRankingResponse } from "../types";
import { GatewayError } from "~/shared/utils/gateway";

const NOW = new Date("2026-10-21T12:00:00Z");

function simulated(scenario: MockScenario = MockScenario.PLAYED) {
  return createSimulatedLeaderboardApi({ scenario, delayMs: 0, now: () => NOW });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loadPublicRanking", () => {
  it("resolves READY with the podium, the leaders and the top 10", async () => {
    const state = await loadPublicRanking(simulated());
    expect(state.status).toBe(LoadStatus.READY);
    expect(state.ranking?.podium).toHaveLength(3);
    expect(state.ranking?.top).toHaveLength(10);
    expect(state.errorMessage).toBe("");
  });

  it("resolves EMPTY when no hero is ranked", async () => {
    const state = await loadPublicRanking(simulated(MockScenario.EMPTY));
    expect(state.status).toBe(LoadStatus.EMPTY);
    expect(state.ranking?.season.label).toBe("Season 4");
  });

  it("never rejects: a Gateway failure becomes an ERROR with a fixed message", async () => {
    const api = simulated();
    vi.spyOn(api, "getPublicRanking").mockRejectedValue(
      new GatewayError(503, { code: "DOWN", message: "Leaderboard unavailable" }),
    );
    await expect(loadPublicRanking(api)).resolves.toEqual({
      status: LoadStatus.ERROR,
      ranking: null,
      errorMessage: PUBLIC_RANKING_ERROR,
    });
  });

  it("passes the abort signal to the API", async () => {
    const api = simulated();
    const spy = vi.spyOn(api, "getPublicRanking");
    const { signal } = new AbortController();
    await loadPublicRanking(api, signal);
    expect(spy).toHaveBeenCalledWith(signal);
  });

  it("uses the generic message for an unexpected failure", async () => {
    const api = simulated();
    vi.spyOn(api, "getPublicRanking").mockRejectedValue(
      new TypeError("x is undefined"),
    );
    const state = await loadPublicRanking(api);
    expect(state.errorMessage).toBe(GENERIC_LOAD_ERROR);
  });

  it("reads missing lists and an empty body as empty, never as a crash", async () => {
    const api = simulated();
    const partial = {
      season: { label: "Season 1" },
    } as unknown as PublicRankingResponse;
    vi.spyOn(api, "getPublicRanking").mockResolvedValueOnce(partial);
    const state = await loadPublicRanking(api);
    expect(state.status).toBe(LoadStatus.EMPTY);
    expect(state.ranking).toMatchObject({ totalCount: 0, podium: [], top: [] });

    vi.spyOn(api, "getPublicRanking").mockResolvedValueOnce(
      null as unknown as PublicRankingResponse,
    );
    expect((await loadPublicRanking(api)).status).toBe(LoadStatus.EMPTY);
  });

  it("is serialisable for the Nuxt payload", async () => {
    const state = await loadPublicRanking(simulated());
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe("isPublicRankingEmpty", () => {
  it("is false as soon as one hero is counted or listed", async () => {
    const ranking = await simulated().getPublicRanking();
    expect(isPublicRankingEmpty(ranking)).toBe(false);
    expect(
      isPublicRankingEmpty({ ...ranking, totalCount: 0, podium: [], top: [] }),
    ).toBe(true);
    expect(isPublicRankingEmpty(null)).toBe(true);
  });
});

describe("formatFreshness", () => {
  it("gives an absolute UTC date with its machine-readable form", () => {
    expect(formatFreshness("2026-10-21T11:57:00Z")).toEqual({
      label: "Updated 21 Oct 2026, 11:57 UTC",
      datetime: "2026-10-21T11:57:00.000Z",
    });
  });

  it("reads « Not consolidated yet » for a missing or invalid date (D7)", () => {
    const none = { label: "Not consolidated yet", datetime: null };
    expect(formatFreshness(null)).toEqual(none);
    expect(formatFreshness("not a date")).toEqual(none);
  });
});

describe("formatRankedHeroes", () => {
  it("counts heroes with grouping and plural", () => {
    expect(formatRankedHeroes(1)).toBe("1 ranked hero");
    expect(formatRankedHeroes(1200)).toBe("1,200 ranked heroes");
    expect(formatRankedHeroes(Number.NaN)).toBe("0 ranked heroes");
  });
});

type Handler = (nuxtApp: unknown, options: { signal: AbortSignal }) => Promise<unknown>;

/** Mounts a component using the composable and returns the async data handler. */
function captureHandler(api = simulated(), event?: object) {
  let handler: Handler | undefined;
  vi.stubGlobal("useRequestEvent", () => event);
  vi.stubGlobal("useAsyncData", (_key: string, fn: Handler) => {
    handler = fn;
    return { data: ref(), error: ref(), status: ref("idle"), refresh: vi.fn() };
  });
  mount(
    defineComponent({
      setup() {
        usePublicRanking({ api });
        return () => h("div");
      },
    }),
  );
  return handler!;
}

describe("usePublicRanking on the server", () => {
  it("answers 503 for a failed read, so that swr does not cache it", async () => {
    const setResponseStatus = vi.fn();
    vi.stubGlobal("setResponseStatus", setResponseStatus);
    const event = {};
    const handler = captureHandler(simulated(MockScenario.ERROR), event);
    const state = await handler(undefined, { signal: new AbortController().signal });
    expect(state).toMatchObject({ status: LoadStatus.ERROR });
    expect(setResponseStatus).toHaveBeenCalledWith(event, PUBLIC_RANKING_ERROR_STATUS);
  });

  it("keeps the status of a successful read, and never sets it in the browser", async () => {
    const setResponseStatus = vi.fn();
    vi.stubGlobal("setResponseStatus", setResponseStatus);
    await captureHandler(simulated(), {})(undefined, {
      signal: new AbortController().signal,
    });
    await captureHandler(simulated(MockScenario.ERROR), undefined)(undefined, {
      signal: new AbortController().signal,
    });
    expect(setResponseStatus).not.toHaveBeenCalled();
  });

  it("hands the useAsyncData signal to the API", async () => {
    const api = simulated();
    const spy = vi.spyOn(api, "getPublicRanking");
    const { signal } = new AbortController();
    await captureHandler(api)(undefined, { signal });
    expect(spy).toHaveBeenCalledWith(signal);
  });
});

describe("usePublicRanking", () => {
  function setup(asyncData: { data: unknown; error?: unknown; status?: string }) {
    const refresh = vi.fn();
    const useAsyncData = vi.fn(() => ({
      data: ref(asyncData.data),
      error: ref(asyncData.error),
      status: ref(asyncData.status ?? "success"),
      refresh,
    }));
    vi.stubGlobal("useAsyncData", useAsyncData);
    vi.stubGlobal("useRoute", () => ({ query: {} }));
    vi.stubGlobal("useRequestEvent", () => undefined);
    let result!: ReturnType<typeof usePublicRanking>;
    mount(
      defineComponent({
        setup() {
          result = usePublicRanking({ api: simulated() });
          return () => h("div");
        },
      }),
    );
    return { result, refresh, useAsyncData };
  }

  it("goes through useAsyncData under a stable key", async () => {
    const { useAsyncData } = setup({ data: undefined, status: "pending" });
    expect(useAsyncData).toHaveBeenCalledWith(PUBLIC_RANKING_KEY, expect.any(Function));
  });

  it("is LOADING until the data arrives", () => {
    const { result } = setup({ data: undefined, status: "pending" });
    expect(result.state.value).toEqual(LOADING_PUBLIC_RANKING);
    expect(result.refreshing.value).toBe(false);
  });

  it("exposes the loaded state and re-reads on retry", async () => {
    const loaded = await loadPublicRanking(simulated());
    const { result, refresh } = setup({ data: loaded, status: "pending" });
    expect(result.state.value).toEqual(loaded);
    expect(result.refreshing.value).toBe(true);
    result.retry();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("turns a framework-level error into an ERROR state", () => {
    const { result } = setup({
      data: undefined,
      error: new Error("x"),
      status: "error",
    });
    expect(result.state.value.status).toBe(LoadStatus.ERROR);
    expect(result.state.value.errorMessage).toBe(PUBLIC_RANKING_ERROR);
  });

  it("picks the simulated scenario from ?mock= when no API is given", async () => {
    let handler: Handler | undefined;
    vi.stubGlobal("useRequestEvent", () => undefined);
    vi.stubGlobal("useAsyncData", (_key: string, fn: Handler) => {
      handler = fn;
      return { data: ref(), error: ref(), status: ref("idle"), refresh: vi.fn() };
    });
    vi.stubGlobal("useRoute", () => ({ query: { mock: MockScenario.ERROR } }));
    mount(
      defineComponent({
        setup() {
          usePublicRanking();
          return () => h("div");
        },
      }),
    );
    vi.useFakeTimers();
    const pending = handler!(undefined, { signal: new AbortController().signal });
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await expect(pending).resolves.toMatchObject({ status: LoadStatus.ERROR });
  });
});
