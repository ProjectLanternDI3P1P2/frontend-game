/**
 * US-PLAYER-06 — public profile state, read once per request through
 * `useAsyncData` so the server-rendered HTML already holds the profile and the
 * browser reuses the payload (same model as `usePublicRanking`, F04).
 *
 * The loader never rejects. A 404 (unknown, deleted or anonymised player,
 * malformed handle) becomes NOT_FOUND, turned into a real HTTP 404 « Player not
 * found » (app/error.vue). Any other failure becomes ERROR: the page renders a
 * fixed message with Retry and the server answers 503, so the `swr` cache only
 * ever keeps found profiles.
 */
import { computed } from "vue";
import { usePlayerApi, type PlayerApi } from "../api/playerApi";
import {
  PLAYER_NOT_FOUND_MESSAGE,
  resolveProfileRef,
  toPublicProfile,
  type ProfileRef,
} from "../publicProfileRules";
import type { PublicProfile } from "../types";
import { GatewayError } from "~/shared/utils/gateway";

export enum PublicProfileStatus {
  LOADING = "loading",
  READY = "ready",
  NOT_FOUND = "not-found",
  ERROR = "error",
}

/** Serialisable (plain JSON) so it travels in the Nuxt payload. */
export interface PublicProfileState {
  status: PublicProfileStatus;
  profile: PublicProfile | null;
  errorMessage: string;
}

export type PublicProfileApi = Pick<
  PlayerApi,
  "getPublicProfileById" | "getPublicProfileByHandle"
>;

/** The page is public and cached: never the Gateway's own wording. */
export const PUBLIC_PROFILE_ERROR =
  "The service did not answer. Check your connection and try again.";

/** Not cached by `swr`, and tells crawlers to come back later. */
export const PUBLIC_PROFILE_ERROR_STATUS = 503;

export const LOADING_PUBLIC_PROFILE: Readonly<PublicProfileState> = Object.freeze({
  status: PublicProfileStatus.LOADING,
  profile: null,
  errorMessage: "",
});

const NOT_FOUND_STATE: Readonly<PublicProfileState> = Object.freeze({
  status: PublicProfileStatus.NOT_FOUND,
  profile: null,
  errorMessage: "",
});

/** One `useAsyncData` key per profile, so two profiles never share a payload. */
export function publicProfileKey(profileRef: ProfileRef): string {
  if (profileRef.kind === "id") {
    return `player-public-profile:id:${profileRef.playerId}`;
  }
  if (profileRef.kind === "handle") {
    return `player-public-profile:handle:${profileRef.handle}`;
  }
  return "player-public-profile:invalid";
}

/** Input of `createError` / `showError` for the « Player not found » page. */
export function playerNotFoundError(fatal: boolean) {
  return { status: 404, statusText: PLAYER_NOT_FOUND_MESSAGE, fatal };
}

/** Reads the public profile; resolves to a state, never rejects. */
export async function loadPublicProfile(
  api: PublicProfileApi,
  profileRef: ProfileRef,
  signal?: AbortSignal,
): Promise<PublicProfileState> {
  if (profileRef.kind === "invalid") return { ...NOT_FOUND_STATE };
  try {
    const response =
      profileRef.kind === "id"
        ? await api.getPublicProfileById(profileRef.playerId, signal)
        : await api.getPublicProfileByHandle(profileRef.handle, signal);
    return {
      status: PublicProfileStatus.READY,
      profile: toPublicProfile(response),
      errorMessage: "",
    };
  } catch (cause) {
    if (cause instanceof GatewayError && cause.status === 404) {
      return { ...NOT_FOUND_STATE };
    }
    return {
      status: PublicProfileStatus.ERROR,
      profile: null,
      errorMessage: PUBLIC_PROFILE_ERROR,
    };
  }
}

export interface PublicProfileOptions {
  api?: PublicProfileApi;
}

/**
 * For `app/pages/profiles/[ref].vue`, awaited in its setup. Throws the
 * « Player not found » 404 when the player does not exist.
 */
export async function usePublicProfile(
  rawRef: string,
  options: PublicProfileOptions = {},
) {
  const profileRef = resolveProfileRef(rawRef);
  const api = options.api ?? usePlayerApi();
  // Undefined in the browser; captured now, while the setup context exists.
  const event = useRequestEvent();

  const { data, error, status, refresh } = await useAsyncData(
    publicProfileKey(profileRef),
    async (_nuxtApp, { signal }) => {
      const state = await loadPublicProfile(api, profileRef, signal);
      // The page still renders its message; only the status keeps it out of
      // the shared `swr` cache.
      if (event && state.status === PublicProfileStatus.ERROR) {
        setResponseStatus(event, PUBLIC_PROFILE_ERROR_STATUS);
      }
      return state;
    },
  );

  if (data.value?.status === PublicProfileStatus.NOT_FOUND) {
    // Fatal only in the browser: on the server Nuxt renders it anyway, and a
    // missing profile is not a server failure worth a "fatal" log line.
    throw createError(playerNotFoundError(Boolean(import.meta.client)));
  }

  const state = computed<PublicProfileState>(() => {
    if (data.value) return data.value;
    // The loader never rejects; this only guards against the framework itself.
    if (error.value) {
      return {
        status: PublicProfileStatus.ERROR,
        profile: null,
        errorMessage: PUBLIC_PROFILE_ERROR,
      };
    }
    return LOADING_PUBLIC_PROFILE;
  });

  /** True while re-reading over a state already on screen (Retry). */
  const refreshing = computed(() => status.value === "pending" && !!data.value);

  async function retry(): Promise<void> {
    await refresh();
    if (data.value?.status === PublicProfileStatus.NOT_FOUND) {
      showError(playerNotFoundError(true));
    }
  }

  return { state, refreshing, retry };
}
