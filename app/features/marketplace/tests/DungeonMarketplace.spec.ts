import { flushPromises, mount } from "@vue/test-utils";
import { computed, nextTick, onMounted, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import DungeonPage from "~/pages/dungeon/[runId].vue";
import MarketplaceModal from "../components/MarketplaceModal.vue";

const { move, listActiveListings } = vi.hoisted(() => ({
  move: vi.fn(),
  listActiveListings: vi.fn().mockResolvedValue([]),
}));

vi.mock("../api/marketplaceApi", () => ({
  useMarketplaceApi: () => ({ listActiveListings }),
}));
vi.mock("~/features/dungeon/composables/useBoardViewport", () => ({
  useBoardViewport: () => ({}),
}));
vi.mock("~/features/dungeon/composables/useDungeonExplorer", () => ({
  useDungeonExplorer: () => ({
    run: ref({ status: "active", currentFloor: 0, floorCount: 1, turn: 0 }),
    loaded: ref({ floor: { rooms: [] } }),
    status: ref("ready"),
    visitedRoomIds: ref([]),
    start: vi.fn().mockResolvedValue(undefined),
    move,
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Marketplace in the dungeon", () => {
  it("opens once with M, blocks movement, closes with M and restores board focus", async () => {
    for (const [name, value] of Object.entries({
      ref,
      computed,
      onMounted,
      nextTick,
      definePageMeta: vi.fn(),
      useHead: vi.fn(),
      useRoute: () => ({ params: { runId: "run-1" }, query: {} }),
    }))
      vi.stubGlobal(name, value);

    const wrapper = mount(DungeonPage, {
      attachTo: document.body,
      global: {
        stubs: {
          DungeonViewport: { template: "<div />" },
          DungeonMinimap: true,
          DungeonControls: true,
          NuxtLink: true,
          UiButton: { template: "<button><slot /></button>" },
          UiModal: {
            props: ["modelValue"],
            template:
              '<dialog v-if="modelValue" tabindex="-1" open><button>Close</button><slot /><slot name="footer" /></dialog>',
          },
        },
      },
    });
    await flushPromises();
    const board = wrapper.get('[role="application"]');
    await board.trigger("keydown", { code: "KeyM", key: "m" });
    await flushPromises();
    expect(wrapper.findComponent(MarketplaceModal).exists()).toBe(true);
    expect(listActiveListings).toHaveBeenCalledTimes(1);
    await board.trigger("keydown", { code: "KeyM", repeat: true });
    expect(listActiveListings).toHaveBeenCalledTimes(1);
    await board.trigger("keydown", { code: "ArrowRight" });
    expect(move).not.toHaveBeenCalled();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyM" }));
    await flushPromises();
    expect(wrapper.findComponent(MarketplaceModal).exists()).toBe(false);
    expect(document.activeElement).toBe(board.element);
    await board.trigger("keydown", { code: "ArrowRight" });
    expect(move).toHaveBeenCalledWith("east");
    wrapper.unmount();
  });
});
