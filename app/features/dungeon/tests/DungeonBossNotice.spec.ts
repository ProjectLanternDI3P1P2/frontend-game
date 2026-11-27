import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import DungeonBossNotice from "../components/DungeonBossNotice.vue";

describe("DungeonBossNotice", () => {
  it("says the boss could not be located, as an alert", () => {
    const wrapper = mount(DungeonBossNotice, { props: { loading: false } });
    expect(wrapper.attributes("role")).toBe("alert");
    expect(wrapper.text()).toContain(
      "The final boss of this floor could not be located.",
    );
  });

  it("asks for a reload", async () => {
    const wrapper = mount(DungeonBossNotice, { props: { loading: false } });
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("reload")).toHaveLength(1);
  });

  it("disables the button while a reload is in flight", async () => {
    const wrapper = mount(DungeonBossNotice, { props: { loading: true } });
    const button = wrapper.get("button");
    expect(button.attributes("disabled")).toBeDefined();
    await button.trigger("click");
    expect(wrapper.emitted("reload")).toBeUndefined();
  });
});
