/**
 * US-PLAYER-06 — pure rules of the public profile page: which Player route a
 * `/profiles/:ref` reads, what is kept from the response, and the SEO texts.
 * No framework, no I/O (ADR-FE-012).
 */
import type { PublicProfile, PublicProfileCounters, PublicProfileHero } from "./types";

/** Text of the 404 raised by the page and recognised by `app/error.vue`. */
export const PLAYER_NOT_FOUND_MESSAGE = "Player not found";

export type ProfileRef =
  | { kind: "id"; playerId: string }
  | { kind: "handle"; handle: string }
  | { kind: "invalid" };

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Same format as the backend: `[a-z0-9-]`, at most 32 characters. */
const HANDLE_PATTERN = /^[a-z0-9-]{1,32}$/;

/**
 * A GUID reads the profile by id; anything else in the handle format reads it
 * by handle, lower-cased (handles are case-insensitive). Anything else can
 * never match a player: it is answered 404 without calling the Gateway, whose
 * anonymous route would not accept it either.
 */
export function resolveProfileRef(ref: string): ProfileRef {
  const value = ref.trim();
  if (GUID_PATTERN.test(value)) return { kind: "id", playerId: value.toLowerCase() };
  const handle = value.toLowerCase();
  if (HANDLE_PATTERN.test(handle)) return { kind: "handle", handle };
  return { kind: "invalid" };
}

/** What the Gateway may send: the contract, with missing lists or extra fields. */
export type PublicProfileInput = Omit<PublicProfile, "heroes" | "counters"> & {
  heroes?: PublicProfileHero[] | null;
  counters?: Partial<PublicProfileCounters> | null;
};

/**
 * Keeps exactly the contract fields. The state travels in the Nuxt payload,
 * i.e. in the public HTML: a field the backend might add (an e-mail…) must
 * never reach it. Heroes keep the order received.
 */
export function toPublicProfile(raw: PublicProfileInput): PublicProfile {
  return {
    playerId: raw.playerId,
    publicHandle: raw.publicHandle,
    displayName: raw.displayName,
    newGamePlusLevel: raw.newGamePlusLevel,
    heroes: (raw.heroes ?? []).map((hero) => ({
      name: hero.name,
      classCode: hero.classCode,
      className: hero.className,
      level: hero.level,
    })),
    counters: {
      heroCount: raw.counters?.heroCount ?? 0,
      highestHeroLevel: raw.counters?.highestHeroLevel ?? 0,
      completedSessionCount: raw.counters?.completedSessionCount ?? 0,
    },
  };
}

/** "Maelis Rune — profile" (app.vue appends " · Project Lantern"). */
export function publicProfileTitle(displayName: string): string {
  return `${displayName} — profile`;
}

export function describePublicProfile(profile: PublicProfile): string {
  const { heroCount, highestHeroLevel } = profile.counters;
  const heroes = `${heroCount} ${heroCount === 1 ? "hero" : "heroes"}`;
  return (
    `${profile.displayName}'s public profile on Project Lantern: ` +
    `New Game+ level ${profile.newGamePlusLevel}, ${heroes}, ` +
    `highest hero level ${highestHeroLevel}.`
  );
}

/**
 * Canonical URL on the handle form, whatever form was visited. `siteUrl` is
 * the public URL of this application, base path included
 * (`https://groupe7.diiage.org/game`); empty means "no canonical".
 */
export function buildProfileCanonicalUrl(
  siteUrl: string,
  publicHandle: string,
): string | null {
  const base = siteUrl.trim().replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/profiles/${encodeURIComponent(publicHandle)}`;
}
