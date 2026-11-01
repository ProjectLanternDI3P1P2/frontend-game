/**
 * ADR-FE-016 — The Vue face of the shared `AudioEngine`: one engine for the
 * whole client, its preferences as reactive state, and the listeners that
 * unlock it on the player's first gesture.
 *
 * Client-only: on the server (or without Web Audio) every call is a no-op.
 */
import { readonly, ref } from "vue";
import type { AudioBus, AudioPreferences, PlayOptions } from "./audioEngine";
import { AudioEngine, DEFAULT_AUDIO_PREFERENCES, audioBaseUrl } from "./audioEngine";

let engine: AudioEngine | null = null;
let baseUrl = audioBaseUrl("/");

/**
 * Set once at start by `plugins/audio.client.ts` from the app's base URL,
 * before any engine exists.
 */
export function setAudioAppBaseUrl(appBaseUrl: string): void {
  baseUrl = audioBaseUrl(appBaseUrl);
}
const preferences = ref<AudioPreferences>({ ...DEFAULT_AUDIO_PREFERENCES });

const GESTURES = ["pointerdown", "keydown", "touchstart"] as const;

function createEngine(): AudioEngine | null {
  if (typeof window === "undefined" || typeof window.AudioContext !== "function") {
    return null;
  }
  const probe = document.createElement("audio");
  const created = new AudioEngine({
    createContext: () => new window.AudioContext(),
    fetch: (url) => window.fetch(url),
    storage: safeLocalStorage(),
    canPlayType: (mime) => probe.canPlayType(mime),
    baseUrl,
  });
  preferences.value = created.currentPreferences;
  created.subscribe((next) => (preferences.value = next));

  // The first gesture anywhere unlocks audio; then the listeners go away.
  const unlock = () => {
    created.unlock();
    for (const gesture of GESTURES) window.removeEventListener(gesture, unlock, true);
  };
  for (const gesture of GESTURES) window.addEventListener(gesture, unlock, true);
  return created;
}

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function useAudio() {
  engine ??= createEngine();
  const current = engine;

  return {
    preferences: readonly(preferences),
    preload: (names: readonly string[]) => current?.preload(names),
    play: (name: string, options?: PlayOptions) => current?.play(name, options),
    startAmbience: (name: string, volume?: number) =>
      current?.startAmbience(name, volume),
    stopAmbience: () => current?.stopAmbience(),
    setMuted: (muted: boolean) => current?.setMuted(muted),
    toggleMuted: () => current?.toggleMuted(),
    setVolume: (bus: AudioBus | "master", volume: number) =>
      current?.setVolume(bus, volume),
  };
}
