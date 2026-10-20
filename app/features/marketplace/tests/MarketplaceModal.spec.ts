import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import MarketplaceModal from "../components/MarketplaceModal.vue";

const listing = {
  id: "listing-1",
  itemInstanceId: "item-1",
  itemName: "Iron sword",
  category: "Weapon",
  rarity: "Rare",
  quantity: 2,
  price: 125.5,
  sellerId: "12345678-abcd-1234-abcd-123456789012",
};

function mountModal(
  status: "loading" | "ready" | "error" = "ready",
  listings = [listing],
) {
  return mount(MarketplaceModal, {
    props: { status, listings },
    global: {
      stubs: {
        UiModal: {
          template:
            '<dialog open tabindex="-1"><button>Close</button><slot /><slot name="footer" /></dialog>',
        },
        UiButton: {
          props: ["disabled"],
          template: '<button :disabled="disabled"><slot /></button>',
        },
      },
    },
    attachTo: document.body,
  });
}

describe("MarketplaceModal", () => {
  it("shows every listing field without a purchase action", () => {
    const wrapper = mountModal();
    for (const value of [
      "Iron sword",
      "Weapon",
      "Rare",
      "2",
      "125.5",
      listing.sellerId,
    ]) {
      expect(wrapper.get("li").text()).toContain(value);
    }
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual([
      "Close",
      "Refresh",
    ]);
    wrapper.unmount();
  });

  it("distinguishes loading, empty and failure states and supports retry", async () => {
    const wrapper = mountModal("loading", []);
    expect(wrapper.get('[role="status"]').text()).toContain("Loading");
    expect(wrapper.get(".marketplace").attributes("aria-busy")).toBe("true");
    await wrapper.setProps({ status: "ready" });
    expect(wrapper.get('[role="status"]').text()).toContain("No active listings");
    await wrapper.setProps({ status: "error" });
    expect(wrapper.get('[role="alert"]').text()).toContain("could not be loaded");
    await wrapper.findAll("button")[1]!.trigger("click");
    expect(wrapper.emitted("refresh")).toHaveLength(1);
    wrapper.unmount();
  });

  it("focuses the dialog, keeps Tab inside and closes with M without key repeats", async () => {
    const wrapper = mountModal();
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.element);
    const buttons = wrapper.findAll("button");
    buttons[buttons.length - 1]!.element.focus();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", cancelable: true }),
    );
    expect(document.activeElement).toBe(buttons[0]!.element);
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(buttons[buttons.length - 1]!.element);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyM", repeat: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyM", ctrlKey: true }));
    expect(wrapper.emitted("close")).toBeUndefined();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyM" }));
    expect(wrapper.emitted("close")).toHaveLength(1);
    const removeListener = vi.spyOn(window, "removeEventListener");
    wrapper.unmount();
    expect(removeListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeListener.mockRestore();
  });
});
