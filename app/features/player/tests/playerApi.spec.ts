import { describe, expect, it, vi } from "vitest";
import { createPlayerApi } from "../api/playerApi";
import type { GatewayClient } from "~/shared/utils/gateway";

function gatewayStub(): GatewayClient {
  return {
    request: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as unknown as GatewayClient;
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
    expect(gateway.get).toHaveBeenNthCalledWith(
      3,
      "player/me/heroes/hero%2Fid",
      { signal: undefined },
    );
    expect(gateway.post).toHaveBeenNthCalledWith(
      1,
      "player/me/heroes",
      expect.objectContaining({ idempotencyKey: "create-key" }),
    );
    expect(gateway.put).toHaveBeenCalledWith(
      "player/me/heroes/hero%2Fid/selection",
    );
    expect(gateway.delete).toHaveBeenNthCalledWith(
      1,
      "player/me/heroes/hero%2Fid/selection",
    );
    expect(gateway.delete).toHaveBeenNthCalledWith(
      2,
      "player/me/heroes/hero%2Fid",
    );
  });
});
