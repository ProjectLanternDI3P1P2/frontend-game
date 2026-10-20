import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HeroDeletionModal from "../components/HeroDeletionModal.vue";
import { HeroDeletionStep } from "../types";

const stubs = {
  UiModal: {
    props: ["modelValue"],
    template: '<div v-if="modelValue"><slot /></div>',
  },
  UiInput: {
    props: ["modelValue", "hint", "error", "disabled"],
    emits: ["update:modelValue"],
    template:
      '<label><input :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" /><small>{{ error || hint }}</small><slot name="suffix" /></label>',
  },
  UiButton: {
    props: ["disabled", "busy", "type"],
    emits: ["click"],
    template:
      '<button :type="type || \'button\'" :disabled="disabled || busy" @click="$emit(\'click\')"><slot /></button>',
  },
  UiNotice: { template: '<p class="notice"><slot /></p>' },
  UiBadge: { template: "<span><slot /></span>" },
};

function mountModal(props: Record<string, unknown> = {}) {
  return mount(HeroDeletionModal, {
    props: {
      modelValue: true,
      step: HeroDeletionStep.CONFIRM,
      heroName: "Brann",
      heroClassLabel: "Warrior",
      heroCount: 3,
      ...props,
    },
    global: { stubs },
  });
}

function deleteButton(wrapper: ReturnType<typeof mountModal>) {
  return wrapper.findAll("button").find((button) => button.text().includes("Delete"))!;
}

describe("HeroDeletionModal", () => {
  it("only enables the destructive action once the exact name is typed", async () => {
    const wrapper = mountModal();

    expect(deleteButton(wrapper).attributes("disabled")).toBeDefined();
    await wrapper.get("input").setValue("brann");
    expect(deleteButton(wrapper).attributes("disabled")).toBeDefined();
    await wrapper.get("input").setValue("Brann");
    expect(deleteButton(wrapper).attributes("disabled")).toBeUndefined();
    expect(wrapper.text()).toContain("5/5");

    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("confirm")).toEqual([[]]);
  });

  it("does not confirm while the name does not match", async () => {
    const wrapper = mountModal();

    await wrapper.get("input").setValue("Bran");
    await wrapper.get("form").trigger("submit");

    expect(wrapper.emitted("confirm")).toBeUndefined();
  });

  it("warns that a lobby will be closed for every member", () => {
    const wrapper = mountModal({ closesLobby: true });

    expect(wrapper.get(".notice").text()).toContain("close that lobby");
  });

  it("locks the dialog while the deletion is in progress", () => {
    const wrapper = mountModal({ deleting: true });

    expect(wrapper.get("input").attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("Deleting…");
    wrapper.findAll("button").forEach((button) => {
      expect(button.attributes("disabled")).toBeDefined();
    });
  });

  it("explains why a hero in a running session cannot be deleted", async () => {
    const wrapper = mountModal({
      step: HeroDeletionStep.BLOCKED,
      sessionId: "k7q2abcd-0000",
    });

    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.text()).toContain("Brann is in session");
    expect(wrapper.text()).toContain("session_K7Q2");

    const viewSession = wrapper
      .findAll("button")
      .find((button) => button.text().includes("View session"))!;
    await viewSession.trigger("click");
    expect(wrapper.emitted("view-session")).toEqual([[]]);
  });
});
