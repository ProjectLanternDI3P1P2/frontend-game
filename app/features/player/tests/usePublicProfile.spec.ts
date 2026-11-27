import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import {
  LOADING_PUBLIC_PROFILE,
  PUBLIC_PROFILE_ERROR,
  PUBLIC_PROFILE_ERROR_STATUS,
  PublicProfileStatus,
  loadPublicProfile,
  playerNotFoundError,
  publicProfileKey,
  usePublicProfile,
  type PublicProfileState,
} from "../composables/usePublicProfile";
import { PLAYER_NOT_FOUND_MESSAGE, resolveProfileRef } from "../publicProfileRules";
import type { PublicProfile } from "../types";
import {
  PUBLIC_HANDLE,
  PUBLIC_PLAYER_ID,
  publicProfileFixture,
} from "./fixtures/publicProfileFixtures";
import { GatewayError } from "~/shared/utils/gateway";

function fakeApi(result: PublicProfile | Error = publicProfileFixture()) {
  const answer = (_value: string, _signal?: AbortSignal): Promise<PublicProfile> =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  return {
    getPublicProfileById: vi.fn(answer),
    getPublicProfileByHandle: vi.fn(answer),
  };
}

const gatewayError = (status: number) =>
  new GatewayError(status, {
    code: "REQUEST_REJECTED",
    message: "pg: connection refused",
  });

const readyState = (): PublicProfileState => ({
  status: PublicProfileStatus.READY,
  profile: publicProfileFixture(),
  errorMessage: "",
});

const errorState = (): PublicProfileState => ({
  status: PublicProfileStatus.ERROR,
  profile: null,
  errorMessage: PUBLIC_PROFILE_ERROR,
});

type Handler = (
  nuxtApp: unknown,
  options: { signal: AbortSignal },
) => Promise<PublicProfileState>;

/** Without preset: runs the handler once (as the server render does). */
function stubAsyncData(preset?: {
  data?: PublicProfileState;
  error?: unknown;
  status?: string;
}) {
  const harness = {
    key: "",
    handler: undefined as Handler | undefined,
    data: ref<PublicProfileState | undefined>(preset?.data),
    error: ref<unknown>(preset?.error),
    status: ref(preset?.status ?? "success"),
    refresh: vi.fn(async () => {}),
  };
  vi.stubGlobal("useAsyncData", async (key: string, handler: Handler) => {
    harness.key = key;
    harness.handler = handler;
    if (!preset) {
      harness.data.value = await handler(undefined, {
        signal: new AbortController().signal,
      });
    }
    return {
      data: harness.data,
      error: harness.error,
      status: harness.status,
      refresh: harness.refresh,
    };
  });
  return harness;
}

const createError = vi.fn((input: Record<string, unknown>) =>
  Object.assign(new Error(String(input.statusText)), input),
);
const showError = vi.fn();
const setResponseStatus = vi.fn();
let requestEvent: object | undefined;

beforeEach(() => {
  requestEvent = undefined;
  createError.mockClear();
  showError.mockClear();
  setResponseStatus.mockClear();
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("showError", showError);
  vi.stubGlobal("setResponseStatus", setResponseStatus);
  vi.stubGlobal("useRequestEvent", () => requestEvent);
});

afterEach(() => vi.unstubAllGlobals());

describe("loadPublicProfile", () => {
  it("reads by id for a GUID ref", async () => {
    const api = fakeApi();
    const { signal } = new AbortController();
    const state = await loadPublicProfile(
      api,
      resolveProfileRef(PUBLIC_PLAYER_ID),
      signal,
    );
    expect(api.getPublicProfileById).toHaveBeenCalledWith(PUBLIC_PLAYER_ID, signal);
    expect(state).toEqual({
      status: PublicProfileStatus.READY,
      profile: publicProfileFixture(),
      errorMessage: "",
    });
  });

  it("reads by handle for a handle ref", async () => {
    const api = fakeApi();
    await loadPublicProfile(api, resolveProfileRef("MaelisRune-00000000"));
    expect(api.getPublicProfileByHandle).toHaveBeenCalledWith(PUBLIC_HANDLE, undefined);
  });

  it("turns a 404 into NOT_FOUND", async () => {
    const state = await loadPublicProfile(
      fakeApi(gatewayError(404)),
      resolveProfileRef(PUBLIC_HANDLE),
    );
    expect(state).toEqual({
      status: PublicProfileStatus.NOT_FOUND,
      profile: null,
      errorMessage: "",
    });
  });

  it("answers NOT_FOUND for an invalid ref without any call", async () => {
    const api = fakeApi();
    const state = await loadPublicProfile(api, resolveProfileRef("not_a_handle!"));
    expect(state.status).toBe(PublicProfileStatus.NOT_FOUND);
    expect(api.getPublicProfileById).not.toHaveBeenCalled();
    expect(api.getPublicProfileByHandle).not.toHaveBeenCalled();
  });

  it.each([500, 503, 0])(
    "turns status %i into ERROR with the fixed message",
    async (status) => {
      const state = await loadPublicProfile(
        fakeApi(gatewayError(status)),
        resolveProfileRef(PUBLIC_HANDLE),
      );
      expect(state).toEqual({
        status: PublicProfileStatus.ERROR,
        profile: null,
        errorMessage: PUBLIC_PROFILE_ERROR,
      });
    },
  );

  it("turns an unexpected failure into ERROR", async () => {
    const state = await loadPublicProfile(
      fakeApi(new TypeError("x is undefined")),
      resolveProfileRef(PUBLIC_HANDLE),
    );
    expect(state.status).toBe(PublicProfileStatus.ERROR);
  });

  it("keeps only the contract fields (no e-mail in the payload)", async () => {
    const api = fakeApi({
      ...publicProfileFixture(),
      email: "maelis@example.test",
    } as PublicProfile);
    const state = await loadPublicProfile(api, resolveProfileRef(PUBLIC_HANDLE));
    expect(JSON.stringify(state)).not.toContain("maelis@example.test");
  });

  it("is serialisable for the Nuxt payload", async () => {
    const state = await loadPublicProfile(fakeApi(), resolveProfileRef(PUBLIC_HANDLE));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe("publicProfileKey", () => {
  it("gives one key per profile", () => {
    expect(publicProfileKey(resolveProfileRef(PUBLIC_PLAYER_ID))).toBe(
      `player-public-profile:id:${PUBLIC_PLAYER_ID}`,
    );
    expect(publicProfileKey(resolveProfileRef(PUBLIC_HANDLE))).toBe(
      "player-public-profile:handle:maelisrune-00000000",
    );
    expect(publicProfileKey(resolveProfileRef("not_a_handle!"))).toBe(
      "player-public-profile:invalid",
    );
  });
});

describe("usePublicProfile", () => {
  it("goes through useAsyncData under the profile's key", async () => {
    const harness = stubAsyncData();
    await usePublicProfile(PUBLIC_HANDLE, { api: fakeApi() });
    expect(harness.key).toBe("player-public-profile:handle:maelisrune-00000000");
  });

  it("exposes the READY profile", async () => {
    stubAsyncData();
    const { state, refreshing } = await usePublicProfile(PUBLIC_HANDLE, {
      api: fakeApi(),
    });
    expect(state.value.status).toBe(PublicProfileStatus.READY);
    expect(state.value.profile).toEqual(publicProfileFixture());
    expect(refreshing.value).toBe(false);
  });

  it("answers 503 on the server for a failed read, so that swr does not cache it", async () => {
    requestEvent = {};
    stubAsyncData();
    const { state } = await usePublicProfile(PUBLIC_HANDLE, {
      api: fakeApi(gatewayError(503)),
    });
    expect(setResponseStatus).toHaveBeenCalledWith(
      requestEvent,
      PUBLIC_PROFILE_ERROR_STATUS,
    );
    expect(state.value.status).toBe(PublicProfileStatus.ERROR);
    expect(createError).not.toHaveBeenCalled();
  });

  it("keeps the status of a found profile, and never sets it in the browser", async () => {
    requestEvent = {};
    stubAsyncData();
    await usePublicProfile(PUBLIC_HANDLE, { api: fakeApi() });

    requestEvent = undefined;
    stubAsyncData();
    await usePublicProfile(PUBLIC_HANDLE, { api: fakeApi(gatewayError(503)) });

    expect(setResponseStatus).not.toHaveBeenCalled();
  });

  it("throws a real 404 « Player not found » for an unknown player", async () => {
    stubAsyncData();
    await expect(
      usePublicProfile(PUBLIC_HANDLE, { api: fakeApi(gatewayError(404)) }),
    ).rejects.toMatchObject({
      status: 404,
      statusText: PLAYER_NOT_FOUND_MESSAGE,
      fatal: false,
    });
    expect(createError).toHaveBeenCalledWith(playerNotFoundError(false));
  });

  it("answers 404 for a malformed ref without any API call", async () => {
    const api = fakeApi();
    stubAsyncData();
    await expect(usePublicProfile("not_a_handle!", { api })).rejects.toMatchObject({
      status: 404,
    });
    expect(api.getPublicProfileById).not.toHaveBeenCalled();
    expect(api.getPublicProfileByHandle).not.toHaveBeenCalled();
  });

  it("never turns a network failure into a 404", async () => {
    stubAsyncData();
    await usePublicProfile(PUBLIC_HANDLE, { api: fakeApi(gatewayError(0)) });
    expect(createError).not.toHaveBeenCalled();
  });

  it("hands the useAsyncData signal to the API", async () => {
    const api = fakeApi();
    const harness = stubAsyncData({
      data: LOADING_PUBLIC_PROFILE as PublicProfileState,
    });
    await usePublicProfile(PUBLIC_HANDLE, { api });
    const { signal } = new AbortController();
    await harness.handler!(undefined, { signal });
    expect(api.getPublicProfileByHandle).toHaveBeenCalledWith(PUBLIC_HANDLE, signal);
  });

  it("is LOADING until the data arrives", async () => {
    stubAsyncData({ status: "pending" });
    const { state } = await usePublicProfile(PUBLIC_HANDLE, { api: fakeApi() });
    expect(state.value).toEqual(LOADING_PUBLIC_PROFILE);
  });

  it("turns a framework-level error into ERROR", async () => {
    stubAsyncData({ error: new Error("x"), status: "error" });
    const { state } = await usePublicProfile(PUBLIC_HANDLE, { api: fakeApi() });
    expect(state.value.errorMessage).toBe(PUBLIC_PROFILE_ERROR);
  });

  it("is refreshing while re-reading over a state on screen", async () => {
    stubAsyncData({ data: readyState(), status: "pending" });
    const { refreshing } = await usePublicProfile(PUBLIC_HANDLE, { api: fakeApi() });
    expect(refreshing.value).toBe(true);
  });

  it("re-reads on retry", async () => {
    const harness = stubAsyncData({ data: errorState() });
    const result = await usePublicProfile(PUBLIC_HANDLE, { api: fakeApi() });
    await result.retry();
    expect(harness.refresh).toHaveBeenCalledTimes(1);
    expect(showError).not.toHaveBeenCalled();
  });

  it("shows the 404 page when a retry finds the player gone", async () => {
    const harness = stubAsyncData({ data: errorState() });
    harness.refresh.mockImplementation(async () => {
      harness.data.value = {
        status: PublicProfileStatus.NOT_FOUND,
        profile: null,
        errorMessage: "",
      };
    });
    const result = await usePublicProfile(PUBLIC_HANDLE, { api: fakeApi() });
    await result.retry();
    expect(showError).toHaveBeenCalledWith(playerNotFoundError(true));
  });
});
