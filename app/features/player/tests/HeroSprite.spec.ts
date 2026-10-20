import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HeroSprite from "../components/HeroSprite.vue";

describe("HeroSprite", () => {
  it("sizes the canvas to the figure window at the requested scale", () => {
    const wrapper = mount(HeroSprite, { props: { scale: 4 } });
    const canvas = wrapper.get("canvas");

    expect(canvas.attributes("width")).toBe("128");
    expect(canvas.attributes("height")).toBe("160");
  });

  it("draws one layer per sheet: the headwear replaces the hair", async () => {
    const wrapper = mount(HeroSprite, {
      props: {
        classCode: "warrior",
        appearance: { skinTone: 2, hairStyle: "bob1", hairColor: 4 },
      },
    });
    expect(wrapper.get("canvas").attributes("data-layers")).toBe("3");

    await wrapper.setProps({ classCode: "mage" });
    expect(wrapper.get("canvas").attributes("data-layers")).toBe("3");

    await wrapper.setProps({
      classCode: "warrior",
      appearance: { skinTone: 2, hairStyle: "bald", hairColor: null },
    });
    expect(wrapper.get("canvas").attributes("data-layers")).toBe("2");
  });

  it("is labelled only when a label is given", () => {
    expect(mount(HeroSprite).get("canvas").attributes("aria-hidden")).toBe("true");
    expect(
      mount(HeroSprite, { props: { label: "Merlin preview" } })
        .get("canvas")
        .attributes("aria-label"),
    ).toBe("Merlin preview");
  });
});
