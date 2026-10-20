import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HeroAppearancePicker from "../components/HeroAppearancePicker.vue";
import type { HeroAppearance } from "../appearance";

function mountPicker(modelValue: HeroAppearance) {
  return mount(HeroAppearancePicker, {
    props: { modelValue },
    global: { stubs: { HeroSprite: true } },
  });
}

function lastEmitted(wrapper: ReturnType<typeof mountPicker>) {
  const events = wrapper.emitted("update:modelValue") ?? [];
  return events.at(-1)?.[0];
}

describe("HeroAppearancePicker", () => {
  it("changes the skin tone", async () => {
    const wrapper = mountPicker({ skinTone: 1, hairStyle: "bob1", hairColor: 1 });

    await wrapper.get('[aria-label="Skin tone Umber"]').trigger("click");

    expect(lastEmitted(wrapper)).toEqual({
      skinTone: 10,
      hairStyle: "bob1",
      hairColor: 1,
    });
  });

  it("clears the hair color for a bald hero and restores it afterwards", async () => {
    const wrapper = mountPicker({ skinTone: 3, hairStyle: "bob1", hairColor: 8 });
    const styles = wrapper.findAll(".hero-appearance-picker__style");

    await styles[0]!.trigger("click");
    expect(lastEmitted(wrapper)).toEqual({
      skinTone: 3,
      hairStyle: "bald",
      hairColor: null,
    });

    await wrapper.setProps({
      modelValue: { skinTone: 3, hairStyle: "bald", hairColor: null },
    });
    expect(wrapper.text()).toContain("A bald hero has no hair color.");

    await wrapper.findAll(".hero-appearance-picker__style")[2]!.trigger("click");
    expect(lastEmitted(wrapper)).toEqual({
      skinTone: 3,
      hairStyle: "dap1",
      hairColor: 8,
    });
  });

  it("marks the current choices as checked", () => {
    const wrapper = mountPicker({ skinTone: 5, hairStyle: "dap1", hairColor: 9 });

    expect(
      wrapper.get('[aria-label="Skin tone Copper"]').attributes("aria-checked"),
    ).toBe("true");
    expect(
      wrapper.get('[aria-label="Hair color Azure"]').attributes("aria-checked"),
    ).toBe("true");
  });
});
