/**
 * ADR-FE-016 — Points the shared audio engine at `public/audio/` under the
 * app's base URL. Creates nothing: the engine is built on first use.
 */
import { setAudioAppBaseUrl } from "~/shared/audio/useAudio";

export default defineNuxtPlugin(() => {
  setAudioAppBaseUrl(useRuntimeConfig().app.baseURL);
});
