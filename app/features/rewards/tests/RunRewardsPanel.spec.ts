import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayError } from "~/shared/utils/gateway";
import RunRewardsPanel from "../components/RunRewardsPanel.vue";

const getRunRewards = vi.hoisted(() => vi.fn());
vi.mock("../api/rewardsApi", () => ({
  useRewardsApi: () => ({ getRunRewards }),
}));

function mountPanel(runId: string | null = "run-1") {
  return mount(RunRewardsPanel, {
    props: {
      runId,
      heroNames: new Map([
        ["hero-1", "Aria"],
        ["hero-2", "Bran"],
      ]),
    },
  });
}

describe("RunRewardsPanel", () => {
  beforeEach(() => {
    getRunRewards.mockReset();
  });

  it("waits for a run ID, announces loading and shows an empty distribution", async () => {
    let finish!: (value: unknown) => void;
    getRunRewards.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const wrapper = mountPanel(null);
    expect(getRunRewards).not.toHaveBeenCalled();
    expect(wrapper.find("section").exists()).toBe(false);

    await wrapper.setProps({ runId: "run-1" });
    expect(getRunRewards).toHaveBeenCalledWith("run-1", expect.any(AbortSignal));
    expect(wrapper.get('[role="status"]').text()).toBe("Loading rewards…");

    finish({ dungeonRunId: "run-1", viewerPlayerId: null, distributions: [] });
    await flushPromises();
    expect(wrapper.text()).toContain("No group rewards for this run.");
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it.each([401, 403, 404])("hides details and retry for HTTP %i", async (status) => {
    getRunRewards.mockRejectedValue(
      new GatewayError(status, { code: "DENIED", message: "Private server detail" }),
    );
    const wrapper = mountPanel();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Récompenses indisponibles");
    expect(wrapper.text()).not.toContain("Private server detail");
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("explains a participation check outage and lets the player retry", async () => {
    getRunRewards
      .mockRejectedValueOnce(
        new GatewayError(503, {
          code: "UNAVAILABLE",
          message: "Private server detail",
        }),
      )
      .mockResolvedValueOnce({
        dungeonRunId: "run-1",
        viewerPlayerId: null,
        distributions: [],
      });
    const wrapper = mountPanel();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Impossible de vérifier votre participation pour le moment.",
    );
    expect(wrapper.text()).not.toContain("Private server detail");
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(getRunRewards).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("No group rewards for this run.");
  });

  it("retries a transient error and displays the distribution and recipient", async () => {
    getRunRewards
      .mockRejectedValueOnce(new Error("Private server detail"))
      .mockResolvedValueOnce({
        dungeonRunId: "run-1",
        viewerPlayerId: "player-1",
        distributions: [
          {
            causeId: "chest-1",
            sourceType: "CHEST",
            rewards: [
              {
                itemId: "potion",
                kind: "UNIQUE",
                name: "Health Potion",
                rarity: "Common",
                quantity: 2,
                recipients: [
                  { heroId: "hero-1", playerId: "player-1", itemInstanceId: null },
                  { heroId: "hero-2", playerId: "player-2", itemInstanceId: null },
                  { heroId: "hero-9", playerId: null, itemInstanceId: null },
                ],
              },
              {
                itemId: "gold",
                kind: "SHARED_PER_PARTICIPANT",
                name: "Gold Coin",
                rarity: "Common",
                quantity: 5,
                recipients: [
                  { heroId: "hero-1", playerId: "player-1", itemInstanceId: null },
                ],
              },
            ],
          },
        ],
      });
    const wrapper = mountPanel();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Impossible de charger les récompenses.",
    );
    expect(wrapper.text()).not.toContain("Private server detail");
    const retry = wrapper.get("button");
    expect(retry.text()).toBe("Réessayer");
    await retry.trigger("click");
    await flushPromises();
    expect(getRunRewards).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Health Potion");
    expect(wrapper.text()).toContain("Aria");
    expect(wrapper.text()).toContain("You");
    expect(wrapper.text()).toContain("Unknown hero");
    expect(wrapper.text()).toContain("Bran");
    expect(wrapper.text()).toContain("Teammate");
    expect(wrapper.text()).toContain("Shared per participant");
  });
});
