import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ActiveSessionNotice from "../components/ActiveSessionNotice.vue";

const stubs = {
  UiNotice: {
    props: ["title"],
    emits: ["dismiss"],
    template:
      '<section><strong>{{ title }}</strong><slot /><button class="dismiss" @click="$emit(\'dismiss\')">×</button></section>',
  },
  UiButton: {
    props: ["busy"],
    emits: ["click"],
    template: '<button :disabled="busy" @click="$emit(\'click\')"><slot /></button>',
  },
};

function mountNotice(props: { resuming?: boolean; error?: string } = {}) {
  return mount(ActiveSessionNotice, {
    props: { resuming: false, error: "", ...props },
    global: { stubs },
  });
}

describe("ActiveSessionNotice", () => {
  it("explains that the hero is already in a game and offers to resume it", () => {
    const wrapper = mountNotice();

    expect(wrapper.text()).toContain("This hero is already in a game");
    expect(wrapper.text()).toContain("Resume game");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("asks the page to resume, or to dismiss the notice", async () => {
    const wrapper = mountNotice();

    await wrapper.get("button:not(.dismiss)").trigger("click");
    await wrapper.get(".dismiss").trigger("click");

    expect(wrapper.emitted("resume")).toHaveLength(1);
    expect(wrapper.emitted("dismiss")).toHaveLength(1);
  });

  it("shows the progress and disables the button while resuming", () => {
    const wrapper = mountNotice({ resuming: true });

    const button = wrapper.get("button:not(.dismiss)");
    expect(button.text()).toBe("Resuming…");
    expect(button.attributes("disabled")).toBeDefined();
  });

  it("announces a resume failure", () => {
    const wrapper = mountNotice({ error: "The session was not found." });

    expect(wrapper.get('[role="alert"]').text()).toBe("The session was not found.");
  });
});
