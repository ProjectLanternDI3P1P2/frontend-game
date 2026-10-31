import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUDIO_PREFERENCES_KEY } from "../audio/audioEngine";

/** Just enough Web Audio for the shared engine to be created in happy-dom. */
class FakeAudioContext {
  state = "running";
  destination = {};
  createGain() {
    return { gain: { value: 1 }, connect() {}, disconnect() {} };
  }
}

async function mountToggle() {
  // A fresh module per test: the engine is shared for the whole client.
  vi.resetModules();
  const { default: AudioMuteToggle } = await import("../audio/AudioMuteToggle.vue");
  return mount(AudioMuteToggle);
}

describe("AudioMuteToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("AudioContext", FakeAudioContext);
  });

  it("is a real button, not pressed while the sound plays", async () => {
    const wrapper = await mountToggle();
    const button = wrapper.get("button");

    expect(button.text()).toContain("Mute sound");
    expect(button.attributes("aria-pressed")).toBe("false");
    expect(button.attributes("aria-keyshortcuts")).toBe("M");
  });

  it("mutes on click and keeps the choice", async () => {
    const wrapper = await mountToggle();
    await wrapper.get("button").trigger("click");

    expect(wrapper.get("button").attributes("aria-pressed")).toBe("true");
    expect(JSON.parse(window.localStorage.getItem(AUDIO_PREFERENCES_KEY)!).muted).toBe(
      true,
    );
  });

  it("starts pressed when the player muted the sound before", async () => {
    window.localStorage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify({ muted: true }));
    const wrapper = await mountToggle();

    expect(wrapper.get("button").attributes("aria-pressed")).toBe("true");
  });
});
