import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ChestLootModal from "../components/ChestLootModal.vue";
import type { ChestLootInteraction, ChestLootResult } from "../types";

const result: ChestLootResult = {
  rewardId: "reward-id",
  dungeonRunId: "run-id",
  chestId: "chest-id",
  floor: 1,
  difficulty: "NORMAL",
  alreadyGenerated: false,
  items: [{ itemId: "item-id", name: "Health Potion", rarity: "Common", quantity: 2 }],
};

function interaction(
  overrides: Partial<ChestLootInteraction> = {},
): ChestLootInteraction {
  return {
    chestElementId: 19,
    status: "loading",
    result: null,
    errorMessage: null,
    ...overrides,
  };
}

function mountModal(value: ChestLootInteraction) {
  return mount(ChestLootModal, {
    props: { interaction: value },
    global: {
      stubs: {
        UiModal: {
          props: ["title"],
          emits: ["close"],
          template:
            '<section role="dialog" :aria-label="title"><button aria-label="Close dialog" @click="$emit(\'close\')">×</button><slot/><footer><slot name="footer"/></footer></section>',
        },
        UiButton: {
          emits: ["click"],
          template: "<button @click=\"$emit('click', $event)\"><slot/></button>",
        },
      },
    },
  });
}

describe("ChestLootModal", () => {
  it("renders loading, error/retry, and accessible saved loot states", async () => {
    const wrapper = mountModal(interaction());

    expect(wrapper.get('[role="dialog"]').attributes("aria-label")).toBe(
      "Opening chest",
    );
    expect(wrapper.get('[role="status"]').text()).toContain("Generating loot");
    expect(wrapper.text()).not.toContain("Réessayer");

    await wrapper.setProps({
      interaction: interaction({ status: "error", errorMessage: "Try later." }),
    });
    expect(wrapper.get('[role="alert"]').text()).toContain("Try later.");
    await wrapper.get("footer button").trigger("click");
    expect(wrapper.emitted("retry")).toHaveLength(1);

    await wrapper.setProps({
      interaction: interaction({
        status: "success",
        result: { ...result, alreadyGenerated: true },
      }),
    });
    expect(wrapper.get('[role="dialog"]').attributes("aria-label")).toBe("Chest loot");
    expect(wrapper.get('[aria-label="Chest items"]').text()).toContain("Health Potion");
    expect(wrapper.get('[aria-label="Chest items"]').text()).toContain("×2");
    expect(wrapper.text()).toContain("saved loot");
    await wrapper.get('[aria-label="Close dialog"]').trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
