/**
 * US-PLAYER-06 — Vue publique du profil (page SSR /profiles/:ref, indexable).
 * Acceptance tests written from the criteria (CA1–CA3).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSSRApp, isRef, ref, type Component } from "vue";
import { renderToString } from "vue/server-renderer";
import { createPlayerApi } from "../api/playerApi";
import {
  PUBLIC_PROFILE_ERROR,
  loadPublicProfile,
  type PublicProfileApi,
} from "../composables/usePublicProfile";
import { PLAYER_NOT_FOUND_MESSAGE, resolveProfileRef } from "../publicProfileRules";
import type { PublicProfile } from "../types";
import {
  PUBLIC_HANDLE,
  PUBLIC_PLAYER_ID,
  publicProfileFixture,
} from "./fixtures/publicProfileFixtures";
import ErrorPage from "~/error.vue";
import ProfilePage from "~/pages/profiles/[ref].vue";
import { createGatewayClient, GatewayError } from "~/shared/utils/gateway";

const fake = vi.hoisted(() => ({ api: undefined as unknown }));
vi.mock("~/features/player/api/playerApi", async (importOriginal) => {
  type Actual = typeof import("~/features/player/api/playerApi");
  const actual = await importOriginal<Actual>();
  return { ...actual, usePlayerApi: () => fake.api };
});

const ROOT = join(__dirname, "../../../..");
const SITE_URL = "https://groupe7.diiage.org/game";
const EMAIL = "maelis@example.test";

type AsyncDataHandler = (
  nuxtApp: unknown,
  options: { signal: AbortSignal },
) => Promise<unknown>;
async function fakeUseAsyncData(_key: string, handler: AsyncDataHandler) {
  const data = ref<unknown>(
    await handler(undefined, { signal: new AbortController().signal }),
  );
  return {
    data,
    error: ref<unknown>(undefined),
    status: ref("success"),
    refresh: vi.fn(),
  };
}

let route: { params: Record<string, string> };
let siteUrl = SITE_URL;
let seo: Record<string, unknown>;
let head: Record<string, unknown>;
let requestEvent: { statusCode: number } | undefined;
const setResponseStatus = vi.fn((event: { statusCode: number }, code: number) => {
  event.statusCode = code;
});
const createError = vi.fn((input: Record<string, unknown>) =>
  Object.assign(new Error(String(input.statusText)), input),
);
const clearError = vi.fn();

function apiAnswering(result: PublicProfile | Error) {
  const answer = (_value: string, _signal?: AbortSignal): Promise<PublicProfile> =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  return {
    getPublicProfileById: vi.fn(answer),
    getPublicProfileByHandle: vi.fn(answer),
  };
}
const resolved = (value: unknown): unknown => (isRef(value) ? value.value : value);

/** Renders the page as the Nuxt server would; captures a thrown setup error. */
async function renderOnServer(refParam: string, api: PublicProfileApi) {
  fake.api = api;
  route = { params: { ref: refParam } };
  const event = { statusCode: 200 };
  requestEvent = event;
  let thrown: unknown;
  const app = createSSRApp(ProfilePage as Component);
  app.component("UiIconButton", { render: () => null });
  app.config.errorHandler = (error) => {
    thrown = error;
  };
  app.config.warnHandler = () => {};
  try {
    const html = await renderToString(app);
    return { html, status: event.statusCode, thrown };
  } finally {
    requestEvent = undefined;
  }
}

function mountErrorPage(error: Record<string, unknown>) {
  return mount(ErrorPage as Component, { props: { error } });
}

beforeEach(() => {
  route = { params: {} };
  siteUrl = SITE_URL;
  seo = {};
  head = {};
  setResponseStatus.mockClear();
  createError.mockClear();
  clearError.mockClear();
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("useRuntimeConfig", () => ({ public: { siteUrl } }));
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useAsyncData", fakeUseAsyncData);
  vi.stubGlobal("useRequestEvent", () => requestEvent);
  vi.stubGlobal("setResponseStatus", setResponseStatus);
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("showError", vi.fn());
  vi.stubGlobal("clearError", clearError);
  vi.stubGlobal("useSeoMeta", (input: Record<string, unknown>) => {
    seo = { ...seo, ...input };
  });
  vi.stubGlobal("useHead", (input: Record<string, unknown>) => {
    head = input;
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("US-PLAYER-06", () => {
  describe("CA1 — the SSR page shows the public profile, never more", () => {
    it("CA1: a GUID ref reads the profile by id", async () => {
      const api = apiAnswering(publicProfileFixture());
      const { thrown } = await renderOnServer(PUBLIC_PLAYER_ID.toUpperCase(), api);

      expect(thrown).toBeUndefined();
      expect(api.getPublicProfileById).toHaveBeenCalledWith(
        PUBLIC_PLAYER_ID,
        expect.any(AbortSignal),
      );
      expect(api.getPublicProfileByHandle).not.toHaveBeenCalled();
    });

    it("CA1: a handle ref reads the profile by handle, case-insensitively", async () => {
      const api = apiAnswering(publicProfileFixture());
      await renderOnServer("MaelisRune-00000000", api);

      expect(api.getPublicProfileByHandle).toHaveBeenCalledWith(
        PUBLIC_HANDLE,
        expect.any(AbortSignal),
      );
    });

    it("CA1: the server HTML holds the name (h1), NG+, counters and every hero in order", async () => {
      const { html, status } = await renderOnServer(
        PUBLIC_HANDLE,
        apiAnswering(publicProfileFixture()),
      );

      expect(html.match(/<h1/g)).toHaveLength(1);
      for (const text of [
        "Maelis Rune",
        "New Game+ level",
        "Highest hero level",
        "Completed sessions",
        "Warrior",
        "Level 12",
        "Aldric",
        "Sylwen",
        "Mage",
        "Level 9",
      ]) {
        expect(html).toContain(text);
      }
      expect(html.indexOf("Aldric")).toBeLessThan(html.indexOf("Sylwen"));
      expect(status).toBe(200);
    });

    it("CA1: an empty hero list is in the HTML as an explicit empty state", async () => {
      const { html } = await renderOnServer(
        PUBLIC_HANDLE,
        apiAnswering(
          publicProfileFixture({
            heroes: [],
            counters: { heroCount: 0, highestHeroLevel: 0, completedSessionCount: 0 },
          }),
        ),
      );

      expect(html).toContain("This player has no hero yet.");
    });

    it("CA1: never an e-mail — not rendered, not kept in the payload state", async () => {
      const profile = { ...publicProfileFixture(), email: EMAIL } as PublicProfile;
      const { html } = await renderOnServer(PUBLIC_HANDLE, apiAnswering(profile));

      expect(html).not.toContain(EMAIL);
      const state = await loadPublicProfile(
        apiAnswering(profile),
        resolveProfileRef(PUBLIC_HANDLE),
      );
      expect(JSON.stringify(state)).not.toContain(EMAIL);
    });

    it("CA1: names are escaped in the server HTML", async () => {
      const evil = '<img src=x onerror="alert(1)">';
      const { html } = await renderOnServer(
        PUBLIC_HANDLE,
        apiAnswering(publicProfileFixture({ displayName: evil })),
      );

      expect(html).not.toContain(evil);
      expect(html).toContain("&lt;img");
    });

    it("CA1: title, description, og and a canonical URL on the handle form", async () => {
      await renderOnServer(PUBLIC_PLAYER_ID, apiAnswering(publicProfileFixture()));

      expect(resolved(seo.title)).toBe("Maelis Rune — profile");
      expect(resolved(seo.ogTitle)).toBe("Maelis Rune — profile");
      const description = resolved(seo.description) as string;
      expect(description).toContain("Maelis Rune");
      expect(resolved(seo.ogDescription)).toBe(description);
      expect(seo.ogType).toBe("profile");
      expect(resolved(seo.ogUrl)).toBe(`${SITE_URL}/profiles/${PUBLIC_HANDLE}`);
      expect(resolved(head.link)).toEqual([
        { rel: "canonical", href: `${SITE_URL}/profiles/${PUBLIC_HANDLE}` },
      ]);
      expect(seo.robots).toBeUndefined();
    });

    it("CA1: no canonical link when the site URL is not configured", async () => {
      siteUrl = "";
      await renderOnServer(PUBLIC_PLAYER_ID, apiAnswering(publicProfileFixture()));

      expect(resolved(head.link)).toEqual([]);
    });
  });

  describe("CA2 — anonymous, cacheable endpoint", () => {
    it("CA2: the profile is read without Authorization nor identity header, even for a signed-in visitor", async () => {
      const fetchImpl = vi.fn().mockImplementation(
        async () =>
          new Response(JSON.stringify(publicProfileFixture()), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      );
      const api = createPlayerApi(
        createGatewayClient({
          baseUrl: "https://gw.test",
          apiVersion: "v1",
          getToken: () => "player-access-token",
          fetchImpl: fetchImpl as unknown as typeof fetch,
        }),
      );

      await api.getPublicProfileById(PUBLIC_PLAYER_ID);
      await api.getPublicProfileByHandle(PUBLIC_HANDLE);

      const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>;
      expect(calls[0]![0]).toBe(
        `https://gw.test/api/player/v1/players/${PUBLIC_PLAYER_ID}/public-profile`,
      );
      expect(calls[1]![0]).toBe(
        `https://gw.test/api/player/v1/players/by-handle/${PUBLIC_HANDLE}/public-profile`,
      );
      for (const [, init] of calls) {
        expect(Object.keys(init.headers as Record<string, string>).sort()).toEqual([
          "Accept",
          "X-Correlation-Id",
        ]);
      }
    });

    it("CA2: /profiles/** is declared SSR with swr: 60", () => {
      const config = readFileSync(join(ROOT, "nuxt.config.ts"), "utf8");
      expect(config.match(/"\/profiles\/\*\*":\s*(\{[^}]*\})/)?.[1]).toBe(
        "{ ssr: true, prerender: false, swr: 60 }",
      );
    });

    it("CA2: Traefik routes only the two read routes to Player, without authentication", () => {
      const routes = readFileSync(
        join(ROOT, "deploy/traefik/backend/routes.yaml"),
        "utf8",
      );
      const block = routes.slice(
        routes.indexOf("    player-public-profile-api:"),
        routes.indexOf("    combat-api:"),
      );

      expect(routes.indexOf("    player-public-profile-api:")).toBeGreaterThan(0);
      expect(block).toContain("(Method(`GET`) || Method(`HEAD`) || Method(`OPTIONS`))");
      expect(block).not.toMatch(/Method\(`(POST|PUT|PATCH|DELETE)`\)/);
      expect(block).toContain(
        "^/api/player/v1/players/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/public-profile$",
      );
      expect(block).toContain(
        "^/api/player/v1/players/by-handle/[A-Za-z0-9-]{1,32}/public-profile$",
      );
      expect(block).toContain("priority: 200");
      expect(block).toContain("middlewares: [remove-external-identity]");
      expect(block).toContain("service: player");
      expect(block).not.toContain("authenticated");
    });

    it("CA2: a failed read answers 503 (never cached by swr) with a fixed message", async () => {
      const { html, status, thrown } = await renderOnServer(
        PUBLIC_HANDLE,
        apiAnswering(
          new GatewayError(503, { code: "DOWN", message: "pg: connection refused" }),
        ),
      );

      expect(status).toBe(503);
      expect(thrown).toBeUndefined();
      expect(html).toContain("The profile could not be loaded");
      expect(html).toContain(PUBLIC_PROFILE_ERROR);
      expect(html).not.toContain("connection refused");
    });

    it("CA2: a network failure is an error, never a 404", async () => {
      const { status } = await renderOnServer(
        PUBLIC_HANDLE,
        apiAnswering(
          new GatewayError(0, { code: "NETWORK_UNAVAILABLE", message: "x" }),
        ),
      );

      expect(status).toBe(503);
      expect(createError).not.toHaveBeenCalled();
    });

    it("CA2: a found profile keeps 200, so swr may cache it", async () => {
      const { status } = await renderOnServer(
        PUBLIC_HANDLE,
        apiAnswering(publicProfileFixture()),
      );

      expect(status).toBe(200);
      expect(setResponseStatus).not.toHaveBeenCalled();
    });
  });

  describe("CA3 — unknown or deleted player: real 404 « Player not found »", () => {
    it("CA3: a 404 from the API becomes a real 404 « Player not found »", async () => {
      const { thrown } = await renderOnServer(
        PUBLIC_HANDLE,
        apiAnswering(
          new GatewayError(404, { code: "REQUEST_REJECTED", message: "Not Found" }),
        ),
      );

      expect(thrown).toMatchObject({
        status: 404,
        statusText: PLAYER_NOT_FOUND_MESSAGE,
      });
      expect(createError).toHaveBeenCalledWith({
        status: 404,
        statusText: PLAYER_NOT_FOUND_MESSAGE,
        fatal: false,
      });
    });

    it("CA3: a malformed ref is a 404 without any API call", async () => {
      const api = apiAnswering(publicProfileFixture());
      const { thrown } = await renderOnServer("not_a_handle!", api);

      expect(thrown).toMatchObject({ status: 404 });
      expect(api.getPublicProfileById).not.toHaveBeenCalled();
      expect(api.getPublicProfileByHandle).not.toHaveBeenCalled();
    });

    it("CA3: the error page reads « Player not found » with a way back to the rankings", async () => {
      const wrapper = mountErrorPage({
        statusCode: 404,
        statusMessage: PLAYER_NOT_FOUND_MESSAGE,
      });

      expect(wrapper.findAll("h1")).toHaveLength(1);
      expect(wrapper.get("h1").text()).toBe("Player not found");
      expect(wrapper.findAll("main")).toHaveLength(1);

      await wrapper
        .findAll("button")
        .find((button) => button.text() === "See the rankings")!
        .trigger("click");
      expect(clearError).toHaveBeenCalledWith({ redirect: "/rankings" });

      expect(resolved(seo.robots)).toBe("noindex");
      expect(resolved(seo.title)).toBe("Player not found · Project Lantern");
    });

    it("CA3: the SSR error shape (status/statusText) is recognised too", () => {
      const wrapper = mountErrorPage({
        status: 404,
        statusText: PLAYER_NOT_FOUND_MESSAGE,
      });

      expect(wrapper.get("h1").text()).toBe("Player not found");
    });

    it("CA3: an unknown route still reads « Page not found »", () => {
      const wrapper = mountErrorPage({
        statusCode: 404,
        statusMessage: "Page not found: /nope",
      });

      expect(wrapper.get("h1").text()).toBe("Page not found");
      expect(resolved(seo.robots)).toBe("noindex");
    });

    it("CA3: any other fatal error reads a generic message", () => {
      const wrapper = mountErrorPage({
        statusCode: 500,
        statusMessage: "Server Error",
      });

      expect(wrapper.get("h1").text()).toBe("Something went wrong");
      expect(wrapper.text()).not.toContain("Player not found");
    });
  });
});
