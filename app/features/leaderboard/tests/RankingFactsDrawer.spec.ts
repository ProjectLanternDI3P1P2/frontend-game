import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEADERBOARD_API_KEY } from "../api/leaderboardSource";
import RankingFactsDrawer from "../components/RankingFactsDrawer.vue";
import type { LeaderboardApi } from "../types";
import { apiStub } from "./fixtures/leaderboardFixtures";
import { heroFacts } from "./fixtures/rankingDetailFixtures";

function mountDrawer(api: LeaderboardApi) {
  return mount(RankingFactsDrawer, {
    props: { heroId: "hero-1", now: () => new Date("2026-10-21T12:00:00Z") },
    global: {
      stubs: { UiIconButton: { template: '<button type="button">×</button>' } },
      provide: { [LEADERBOARD_API_KEY as symbol]: api },
    },
    attachTo: document.body,
  });
}

function dialog(): HTMLElement {
  return document.querySelector("dialog") as HTMLElement;
}

function tab(shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey,
    cancelable: true,
  });
  document.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("RankingFactsDrawer", () => {
  it("cycles Tab and Shift+Tab inside the drawer", async () => {
    const api = apiStub({
      getRankingHeroFacts: vi.fn().mockResolvedValue(heroFacts()),
    });
    const wrapper = mountDrawer(api);
    await wrapper.get("button").trigger("click");
    await flushPromises();

    const buttons = Array.from(
      dialog().querySelectorAll<HTMLElement>("button:not([disabled])"),
    );
    const first = buttons[0]!;
    const last = buttons[buttons.length - 1]!;

    last.focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    first.focus();
    expect(tab(true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    wrapper.unmount();
  });

  it("shows a load error with Retry, and retries", async () => {
    const getRankingHeroFacts = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(heroFacts());
    const wrapper = mountDrawer(apiStub({ getRankingHeroFacts }));
    await wrapper.get("button").trigger("click");
    await flushPromises();

    const alert = dialog().querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain("Retry");
    alert.querySelector("button")!.click();
    await flushPromises();

    expect(getRankingHeroFacts).toHaveBeenCalledTimes(2);
    expect(dialog().querySelector('[role="alert"]')).toBeNull();
    expect(dialog().textContent).toContain("Duplicate fact");
    wrapper.unmount();
  });

  it("reads the facts again on every opening", async () => {
    const api = apiStub({
      getRankingHeroFacts: vi.fn().mockResolvedValue(heroFacts()),
    });
    const wrapper = mountDrawer(api);
    await wrapper.get("button").trigger("click");
    await flushPromises();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    await wrapper.get("button").trigger("click");
    await flushPromises();

    expect(api.getRankingHeroFacts).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
});
