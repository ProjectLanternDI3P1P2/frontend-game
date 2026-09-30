import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HeroCreationPreview from "../components/HeroCreationPreview.vue";

describe("HeroCreationPreview", () => {
  it("emits cancel when its cancel button is clicked", async () => {
    const wrapper = mount(HeroCreationPreview, {
      props: {
        name: "Maëlle",
        heroClass: null,
        canConfirm: false,
        busy: false,
      },
      global: {
        stubs: {
          UiButton: {
            emits: ["click"],
            template:
              '<button type="button" @click="$emit(\'click\')"><slot /></button>',
          },
          HeroPortraitPlaceholder: true,
        },
      },
    });

    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("cancel")).toEqual([[]]);
  });
});
