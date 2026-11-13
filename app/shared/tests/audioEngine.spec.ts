import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioEngineDependencies } from "../audio/audioEngine";
import {
  AUDIO_PREFERENCES_KEY,
  AudioEngine,
  DEFAULT_AUDIO_PREFERENCES,
  audioBaseUrl,
} from "../audio/audioEngine";

/** Just enough of the Web Audio graph to see what the engine builds and starts. */
class FakeGain {
  gain = { value: 1 };
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeSource {
  buffer: unknown = null;
  loop = false;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeContext {
  state: AudioContextState = "running";
  destination = {};
  gains: FakeGain[] = [];
  sources: FakeSource[] = [];
  resume = vi.fn(async () => {
    this.state = "running";
  });
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  decodeAudioData = vi.fn(async (data: ArrayBuffer) => ({ decoded: data }));
}

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void items.set(key, value)),
  };
}

let context: FakeContext;
let deps: AudioEngineDependencies;
let fetch: ReturnType<typeof vi.fn>;

function engine(overrides: Partial<AudioEngineDependencies> = {}) {
  return new AudioEngine({ ...deps, ...overrides });
}

/** The master gain is the first one built; then sfx, then ambience. */
const master = () => context.gains[0]!;

beforeEach(() => {
  context = new FakeContext();
  fetch = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  }));
  deps = {
    createContext: () => context as unknown as AudioContext,
    fetch: fetch as unknown as AudioEngineDependencies["fetch"],
    storage: memoryStorage(),
    canPlayType: (mime) => (mime.startsWith("audio/webm") ? "probably" : ""),
    baseUrl: "/audio",
  };
});

describe("AudioEngine", () => {
  it("ignores sounds asked for before the first gesture", async () => {
    const audio = engine();
    audio.play("dungeon/step-1");
    await flushPromises();

    expect(fetch).not.toHaveBeenCalled();
    expect(audio.unlocked).toBe(false);
  });

  it("plays a sound once unlocked, in the format the browser supports", async () => {
    const audio = engine();
    audio.unlock();
    audio.play("dungeon/step-1");
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith("/audio/dungeon/step-1.webm");
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]!.start).toHaveBeenCalled();
  });

  it("falls back to AAC where Opus is not supported", async () => {
    const audio = engine({
      canPlayType: (mime) => (mime.startsWith("audio/mp4") ? "maybe" : ""),
    });
    audio.unlock();
    audio.play("dungeon/bump");
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith("/audio/dungeon/bump.m4a");
  });

  it("stays silent when no format is supported", async () => {
    const audio = engine({ canPlayType: () => "" });
    audio.unlock();
    audio.play("dungeon/bump");
    await flushPromises();

    expect(fetch).not.toHaveBeenCalled();
    expect(context.sources).toHaveLength(0);
  });

  it("fetches and decodes each file once", async () => {
    const audio = engine();
    audio.unlock();
    audio.play("dungeon/step-1");
    audio.play("dungeon/step-1");
    await flushPromises();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(context.sources).toHaveLength(2);
  });

  it("stays silent, without throwing, when a file is missing", async () => {
    fetch.mockResolvedValue({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) });
    const audio = engine();
    audio.unlock();
    audio.play("dungeon/missing");
    await flushPromises();

    expect(context.sources).toHaveLength(0);
  });

  it("preloads effects only once the context exists", async () => {
    const audio = engine();
    audio.preload(["dungeon/step-1", "dungeon/bump"]);
    await flushPromises();
    expect(fetch).not.toHaveBeenCalled();

    audio.unlock();
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("starts the ambience asked for before the gesture, looping, after the effects", async () => {
    const audio = engine();
    audio.preload(["dungeon/step-1"]);
    audio.startAmbience("dungeon/ambience");
    audio.unlock();
    await flushPromises();

    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "/audio/dungeon/step-1.webm",
      "/audio/dungeon/ambience.webm",
    ]);
    const loop = context.sources.find((source) => source.loop)!;
    expect(loop.start).toHaveBeenCalled();
  });

  it("stops the ambience, and does not start one stopped while it loaded", async () => {
    const audio = engine();
    audio.unlock();
    audio.startAmbience("dungeon/ambience");
    audio.stopAmbience();
    await flushPromises();
    expect(context.sources).toHaveLength(0);

    audio.startAmbience("dungeon/ambience");
    await flushPromises();
    const loop = context.sources[0]!;
    audio.stopAmbience();
    expect(loop.stop).toHaveBeenCalled();
  });

  it("applies the default levels to the buses", () => {
    engine().unlock();
    const [masterGain, sfx, ambience] = context.gains;
    expect(masterGain!.gain.value).toBe(DEFAULT_AUDIO_PREFERENCES.master);
    expect(sfx!.gain.value).toBe(DEFAULT_AUDIO_PREFERENCES.sfx);
    expect(ambience!.gain.value).toBe(DEFAULT_AUDIO_PREFERENCES.ambience);
  });

  it("mutes through the master bus and plays nothing new while muted", async () => {
    const audio = engine();
    audio.unlock();
    audio.toggleMuted();
    audio.play("dungeon/step-1");
    await flushPromises();

    expect(master().gain.value).toBe(0);
    expect(context.sources).toHaveLength(0);

    audio.toggleMuted();
    expect(master().gain.value).toBe(DEFAULT_AUDIO_PREFERENCES.master);
  });

  it("keeps the player's choice, which wins over the default", () => {
    const storage = memoryStorage();
    engine({ storage }).setMuted(true);
    expect(JSON.parse(storage.setItem.mock.calls.at(-1)![1]).muted).toBe(true);

    const next = engine({ storage });
    expect(next.currentPreferences.muted).toBe(true);
  });

  it("clamps volumes and ignores a corrupted stored choice", () => {
    const audio = engine({
      storage: memoryStorage({ [AUDIO_PREFERENCES_KEY]: "{not json" }),
    });
    expect(audio.currentPreferences).toEqual(DEFAULT_AUDIO_PREFERENCES);

    audio.setVolume("sfx", 3);
    expect(audio.currentPreferences.sfx).toBe(1);
  });

  it("works without storage, and when storage throws", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => engine({ storage: null }).setMuted(true)).not.toThrow();
    const audio = engine({ storage: throwing });
    expect(() => audio.setMuted(true)).not.toThrow();
    expect(audio.currentPreferences.muted).toBe(true);
  });

  it("notifies subscribers of every change", () => {
    const audio = engine();
    const listener = vi.fn();
    const unsubscribe = audio.subscribe(listener);
    audio.setMuted(true);
    unsubscribe();
    audio.setMuted(false);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]![0].muted).toBe(true);
  });

  it("resumes a context the browser suspended", () => {
    context.state = "suspended";
    const audio = engine();
    audio.unlock();
    expect(context.resume).toHaveBeenCalled();
  });

  it("stays silent where Web Audio cannot start", async () => {
    const audio = engine({
      createContext: () => {
        throw new Error("no Web Audio");
      },
    });
    expect(() => audio.unlock()).not.toThrow();
    audio.play("dungeon/step-1");
    await flushPromises();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("serves the files under the app's base URL, without a redirect", () => {
    expect(audioBaseUrl("/game/")).toBe("/game/audio");
    expect(audioBaseUrl("/game")).toBe("/game/audio");
    expect(audioBaseUrl("/")).toBe("/audio");
  });
});
