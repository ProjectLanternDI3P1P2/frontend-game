import { describe, expect, it, vi } from "vitest";
import { createPlayerApi } from "../api/playerApi";
import {
  createGatewayClient,
  GatewayError,
  type GatewayClient,
} from "~/shared/utils/gateway";
import {
  PUBLIC_HANDLE,
  PUBLIC_PLAYER_ID,
  publicProfileFixture,
} from "./fixtures/publicProfileFixtures";

function gatewayStub(): GatewayClient {
  return {
    request: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as unknown as GatewayClient;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function anonymousCapableApi(
  fetchImpl: ReturnType<typeof vi.fn>,
  baseUrl = "https://gw.test",
) {
  return createPlayerApi(
    createGatewayClient({
      baseUrl,
      apiVersion: "v1",
      getToken: () => "player-access-token",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      correlationIdFactory: () => "cid-1",
    }),
  );
}

describe("Player API", () => {
  it("uses the Player routes and preserves idempotency keys for writes", async () => {
    const gateway = gatewayStub();
    const api = createPlayerApi(gateway);
    const playerId = "player id";
    const heroId = "hero/id";

    await api.listHeroes(playerId);
    await api.listHeroClasses();
    await api.getHeroSheet(playerId, heroId);
    await api.createHero(playerId, {
      name: "Maëlle",
      classCode: "mage",
      idempotencyKey: "create-key",
    });
    await api.selectHero(playerId, heroId);
    await api.deselectHero(playerId, heroId);
    await api.deleteHero(playerId, heroId);

    expect(gateway.get).toHaveBeenNthCalledWith(1, "player/me/heroes", {
      signal: undefined,
    });
    expect(gateway.get).toHaveBeenNthCalledWith(2, "player/hero-classes", {
      signal: undefined,
    });
    expect(gateway.get).toHaveBeenNthCalledWith(3, "player/me/heroes/hero%2Fid", {
      signal: undefined,
    });
    expect(gateway.post).toHaveBeenNthCalledWith(
      1,
      "player/me/heroes",
      expect.objectContaining({ idempotencyKey: "create-key" }),
    );
    expect(gateway.put).toHaveBeenCalledWith("player/me/heroes/hero%2Fid/selection");
    expect(gateway.delete).toHaveBeenNthCalledWith(
      1,
      "player/me/heroes/hero%2Fid/selection",
    );
    expect(gateway.delete).toHaveBeenNthCalledWith(2, "player/me/heroes/hero%2Fid");
  });
});

describe("Player API — public profile (US-PLAYER-06)", () => {
  it("passes token: null to the gateway for both reads", async () => {
    const gateway = gatewayStub();
    const api = createPlayerApi(gateway);

    await api.getPublicProfileById(PUBLIC_PLAYER_ID);
    await api.getPublicProfileByHandle(PUBLIC_HANDLE);

    expect(gateway.get).toHaveBeenNthCalledWith(
      1,
      `player/players/${PUBLIC_PLAYER_ID}/public-profile`,
      { signal: undefined, token: null },
    );
    expect(gateway.get).toHaveBeenNthCalledWith(
      2,
      `player/players/by-handle/${PUBLIC_HANDLE}/public-profile`,
      { signal: undefined, token: null },
    );
  });

  it("reads a profile by id on the anonymous Player route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(publicProfileFixture()));
    const api = anonymousCapableApi(fetchImpl);

    await api.getPublicProfileById(PUBLIC_PLAYER_ID);

    expect(fetchImpl.mock.calls[0]![0]).toBe(
      `https://gw.test/api/player/v1/players/${PUBLIC_PLAYER_ID}/public-profile`,
    );
    expect(fetchImpl.mock.calls[0]![1].method).toBe("GET");
  });

  it("reads a profile by handle on the anonymous Player route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(publicProfileFixture()));
    const api = anonymousCapableApi(fetchImpl);

    await api.getPublicProfileByHandle(PUBLIC_HANDLE);

    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "https://gw.test/api/player/v1/players/by-handle/maelisrune-00000000/public-profile",
    );
  });

  it("builds a same-origin URL with the default gateway base", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(publicProfileFixture()));
    const api = anonymousCapableApi(fetchImpl, "/");

    await api.getPublicProfileByHandle(PUBLIC_HANDLE);

    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "/api/player/v1/players/by-handle/maelisrune-00000000/public-profile",
    );
  });

  it("encodes the id and the handle in the path", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(publicProfileFixture()));
    const api = anonymousCapableApi(fetchImpl);

    await api.getPublicProfileById("a/b");
    await api.getPublicProfileByHandle("x y");

    expect(fetchImpl.mock.calls[0]![0]).toMatch(/\/players\/a%2Fb\/public-profile$/);
    expect(fetchImpl.mock.calls[1]![0]).toMatch(
      /\/players\/by-handle\/x%20y\/public-profile$/,
    );
  });

  it("sends no Authorization nor any identity header, even when a token exists", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(publicProfileFixture()));
    const api = anonymousCapableApi(fetchImpl);

    await api.getPublicProfileById(PUBLIC_PLAYER_ID);
    await api.getPublicProfileByHandle(PUBLIC_HANDLE);

    expect(fetchImpl.mock.calls).toHaveLength(2);
    for (const [, init] of fetchImpl.mock.calls) {
      expect(Object.keys(init.headers).sort()).toEqual(["Accept", "X-Correlation-Id"]);
    }
  });

  it("passes the abort signal to fetch", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(publicProfileFixture()));
    const api = anonymousCapableApi(fetchImpl);
    const { signal } = new AbortController();

    await api.getPublicProfileById(PUBLIC_PLAYER_ID, signal);

    expect(fetchImpl.mock.calls[0]![1].signal).toBe(signal);
  });

  it("returns the profile body unchanged", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(publicProfileFixture()));
    const api = anonymousCapableApi(fetchImpl);

    await expect(api.getPublicProfileById(PUBLIC_PLAYER_ID)).resolves.toEqual(
      publicProfileFixture(),
    );
  });

  it("propagates a 404 as a GatewayError with status 404", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ title: "Not Found", status: 404 }, 404));
    const api = anonymousCapableApi(fetchImpl);

    await expect(api.getPublicProfileByHandle(PUBLIC_HANDLE)).rejects.toSatisfy(
      (error) => error instanceof GatewayError && error.status === 404,
    );
  });
});
