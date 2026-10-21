import { describe, expect, it, vi } from "vitest";
import { useRankingHeroFacts } from "../composables/useRankingHeroFacts";
import { LoadStatus } from "../types";
import { GatewayError } from "~/shared/utils/gateway";
import { apiStub } from "./fixtures/leaderboardFixtures";
import { heroFacts } from "./fixtures/rankingDetailFixtures";

describe("useRankingHeroFacts", () => {
  it("does not read before load()", () => {
    const api = apiStub();
    useRankingHeroFacts("hero-1", { api });

    expect(api.getRankingHeroFacts).not.toHaveBeenCalled();
  });

  it("loads the facts; no fact is EMPTY", async () => {
    const api = apiStub({
      getRankingHeroFacts: vi
        .fn()
        .mockResolvedValueOnce(heroFacts())
        .mockResolvedValueOnce(heroFacts({ facts: [] })),
    });
    const state = useRankingHeroFacts("hero-1", { api });

    await state.load();
    expect(state.status.value).toBe(LoadStatus.READY);
    await state.load();
    expect(state.status.value).toBe(LoadStatus.EMPTY);
  });

  it("reports the gateway message, and cancel() drops a pending answer", async () => {
    const api = apiStub({
      getRankingHeroFacts: vi
        .fn()
        .mockRejectedValue(
          new GatewayError(503, { code: "unavailable", message: "Down" }),
        ),
    });
    const state = useRankingHeroFacts("hero-1", { api });

    await state.load();
    expect(state.status.value).toBe(LoadStatus.ERROR);
    expect(state.errorMessage.value).toBe("Down");

    const pending = state.load();
    state.cancel();
    await pending;
    expect(state.status.value).toBe(LoadStatus.LOADING);
  });

  it("forgets the previous facts while re-reading", async () => {
    const api = apiStub({
      getRankingHeroFacts: vi
        .fn()
        .mockResolvedValueOnce(heroFacts())
        .mockImplementationOnce(() => new Promise(() => {})),
    });
    const state = useRankingHeroFacts("hero-1", { api });

    await state.load();
    void state.load();

    expect(state.status.value).toBe(LoadStatus.LOADING);
    expect(state.facts.value).toBeNull();
  });
});
