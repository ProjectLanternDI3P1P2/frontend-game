/**
 * ADR-FE-016 — The one way the game client plays sound: the Web Audio API behind
 * a thin wrapper, no dependency.
 *
 * - One `AudioContext`, created on the first user gesture (`unlock`): browsers
 *   refuse to start audio before one. Anything asked before is ignored, not queued.
 * - Three gain buses: `master`, and under it `sfx` and `ambience`.
 * - Sounds are named after their file in `public/audio/` without extension; the
 *   engine picks Opus/WebM or the AAC fallback the browser can play.
 * - A sound that fails to load stays silent: sound is never the only carrier of
 *   information (docs/accessibility.md), so a missing file must not break a run.
 *
 * Framework-free, so it can be tested against a fake `AudioContext`; `useAudio`
 * is the Vue face of it.
 */

export type AudioBus = "sfx" | "ambience";

export interface AudioPreferences {
  muted: boolean;
  master: number;
  sfx: number;
  ambience: number;
}

export const DEFAULT_AUDIO_PREFERENCES: Readonly<AudioPreferences> = {
  muted: false,
  master: 0.8,
  sfx: 0.7,
  ambience: 0.4,
};

export const AUDIO_PREFERENCES_KEY = "lantern.audio";

/** Where the files are served from, and in which formats (ADR-FE-016). */
export const AUDIO_BASE_URL = "/audio";
const FORMATS = [
  { extension: "webm", mime: 'audio/webm; codecs="opus"' },
  { extension: "m4a", mime: 'audio/mp4; codecs="mp4a.40.2"' },
] as const;

export interface AudioEngineDependencies {
  createContext: () => AudioContext;
  fetch: (url: string) => Promise<Response>;
  /** `null` when storage is unavailable (private window, blocked site data). */
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  /** `HTMLMediaElement.canPlayType`, to choose the format. */
  canPlayType: (mime: string) => string;
  baseUrl: string;
}

export interface PlayOptions {
  bus?: AudioBus;
  /** Relative to the bus, 0 to 1. */
  volume?: number;
}

export class AudioEngine {
  private readonly deps: AudioEngineDependencies;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buses = new Map<AudioBus, GainNode>();
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly preloadQueue = new Set<string>();
  private preloading: Promise<void> = Promise.resolve();
  private extension: string | null | undefined;
  private loop: {
    name: string;
    volume: number;
    source: AudioBufferSourceNode | null;
    gain: GainNode | null;
  } | null = null;
  private preferences: AudioPreferences;
  private readonly listeners = new Set<(preferences: AudioPreferences) => void>();

  constructor(deps: AudioEngineDependencies) {
    this.deps = deps;
    this.preferences = readPreferences(deps.storage);
  }

  get unlocked(): boolean {
    return this.context !== null;
  }

  get currentPreferences(): AudioPreferences {
    return { ...this.preferences };
  }

  /**
   * Called from a user gesture. Creates the context once, resumes it if the
   * browser suspended it, then loads what was asked for in advance.
   */
  unlock(): void {
    if (!this.context) {
      try {
        this.context = this.deps.createContext();
      } catch {
        return; // No Web Audio: the game stays silent.
      }
      this.buildGraph(this.context);
      this.flushPreloads();
      if (this.loop) this.startLoop();
    }
    if (this.context.state === "suspended") void this.context.resume().catch(() => {});
  }

  /** Sounds to fetch and decode as soon as the context exists. */
  preload(names: readonly string[]): void {
    for (const name of names) this.preloadQueue.add(name);
    if (this.context) this.flushPreloads();
  }

  /** Plays a sound once. Ignored before `unlock`, while muted, or if the file failed. */
  play(name: string, options: PlayOptions = {}): void {
    const context = this.context;
    if (!context || this.preferences.muted) return;
    const bus = this.buses.get(options.bus ?? "sfx")!;
    const volume = options.volume ?? 1;
    void this.buffer(name).then((buffer) => {
      if (!buffer || this.preferences.muted) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      if (volume === 1) {
        source.connect(bus);
      } else {
        const gain = context.createGain();
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(bus);
      }
      source.start();
    });
  }

  /**
   * Starts a seamless loop on the ambience bus, replacing the current one. Asked
   * before `unlock`, it starts once unlocked; it loads after the preloaded effects,
   * so the short sounds are ready first.
   */
  startAmbience(name: string, volume = 1): void {
    if (this.loop?.name === name) return;
    this.stopAmbience();
    this.loop = { name, volume, source: null, gain: null };
    if (this.context) this.startLoop();
  }

  stopAmbience(): void {
    const loop = this.loop;
    this.loop = null;
    if (!loop?.source) return;
    try {
      loop.source.stop();
    } catch {
      // Already stopped.
    }
    loop.source.disconnect();
    loop.gain?.disconnect();
  }

  setMuted(muted: boolean): void {
    this.update({ muted });
  }

  toggleMuted(): void {
    this.setMuted(!this.preferences.muted);
  }

  setVolume(bus: AudioBus | "master", volume: number): void {
    this.update({ [bus]: clamp01(volume) });
  }

  /** Notified on every preference change; returns the unsubscribe function. */
  subscribe(listener: (preferences: AudioPreferences) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(change: Partial<AudioPreferences>): void {
    this.preferences = { ...this.preferences, ...change };
    this.applyGains();
    writePreferences(this.deps.storage, this.preferences);
    for (const listener of this.listeners) listener(this.currentPreferences);
  }

  private buildGraph(context: AudioContext): void {
    this.master = context.createGain();
    this.master.connect(context.destination);
    for (const bus of ["sfx", "ambience"] as const) {
      const gain = context.createGain();
      gain.connect(this.master);
      this.buses.set(bus, gain);
    }
    this.applyGains();
  }

  /** Muting silences the master bus: the ambience keeps its place in the loop. */
  private applyGains(): void {
    if (!this.master) return;
    const { muted, master, sfx, ambience } = this.preferences;
    this.master.gain.value = muted ? 0 : master;
    this.buses.get("sfx")!.gain.value = sfx;
    this.buses.get("ambience")!.gain.value = ambience;
  }

  private flushPreloads(): void {
    const names = [...this.preloadQueue];
    this.preloadQueue.clear();
    if (names.length === 0) return;
    const loading = Promise.all(names.map((name) => this.buffer(name)));
    this.preloading = this.preloading.then(() => loading).then(() => {});
  }

  private startLoop(): void {
    const loop = this.loop;
    const context = this.context;
    if (!loop || !context) return;
    void this.preloading
      .then(() => this.buffer(loop.name))
      .then((buffer) => {
        // Replaced or stopped while it loaded.
        if (!buffer || this.loop !== loop || loop.source) return;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const gain = context.createGain();
        gain.gain.value = loop.volume;
        source.connect(gain);
        gain.connect(this.buses.get("ambience")!);
        source.start();
        loop.source = source;
        loop.gain = gain;
      });
  }

  /** Fetched and decoded once; `null` forever if it failed. */
  private buffer(name: string): Promise<AudioBuffer | null> {
    let pending = this.buffers.get(name);
    if (!pending) {
      pending = this.load(name);
      this.buffers.set(name, pending);
    }
    return pending;
  }

  private async load(name: string): Promise<AudioBuffer | null> {
    const context = this.context;
    const extension = this.supportedExtension();
    if (!context || !extension) return null;
    try {
      const response = await this.deps.fetch(
        `${this.deps.baseUrl}/${name}.${extension}`,
      );
      if (!response.ok) return null;
      return await context.decodeAudioData(await response.arrayBuffer());
    } catch {
      return null;
    }
  }

  private supportedExtension(): string | null {
    if (this.extension === undefined) {
      this.extension =
        FORMATS.find((format) => this.deps.canPlayType(format.mime) !== "")
          ?.extension ?? null;
    }
    return this.extension;
  }
}

function readPreferences(
  storage: AudioEngineDependencies["storage"],
): AudioPreferences {
  try {
    const raw = storage?.getItem(AUDIO_PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_PREFERENCES };
    const stored = JSON.parse(raw) as Partial<Record<keyof AudioPreferences, unknown>>;
    return {
      muted:
        typeof stored.muted === "boolean"
          ? stored.muted
          : DEFAULT_AUDIO_PREFERENCES.muted,
      master: volumeOr(stored.master, DEFAULT_AUDIO_PREFERENCES.master),
      sfx: volumeOr(stored.sfx, DEFAULT_AUDIO_PREFERENCES.sfx),
      ambience: volumeOr(stored.ambience, DEFAULT_AUDIO_PREFERENCES.ambience),
    };
  } catch {
    return { ...DEFAULT_AUDIO_PREFERENCES };
  }
}

function writePreferences(
  storage: AudioEngineDependencies["storage"],
  preferences: AudioPreferences,
): void {
  try {
    storage?.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Storage full or blocked: the choice holds for this page only.
  }
}

function volumeOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp01(value)
    : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
