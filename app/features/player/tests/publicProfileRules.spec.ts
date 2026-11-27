import { describe, expect, it } from "vitest";
import {
  buildProfileCanonicalUrl,
  describePublicProfile,
  publicProfileTitle,
  resolveProfileRef,
  toPublicProfile,
  type PublicProfileInput,
} from "../publicProfileRules";
import { PUBLIC_HANDLE, publicProfileFixture } from "./fixtures/publicProfileFixtures";

describe("resolveProfileRef", () => {
  it("reads a GUID as a player id, lower-cased", () => {
    expect(resolveProfileRef("3F2B8C1E-4D5A-4F6B-9C7D-0E1F2A3B4C5D")).toEqual({
      kind: "id",
      playerId: "3f2b8c1e-4d5a-4f6b-9c7d-0e1f2a3b4c5d",
    });
  });

  it("reads [a-z0-9-] up to 32 characters as a handle, lower-cased", () => {
    expect(resolveProfileRef("MaelisRune-00000000")).toEqual({
      kind: "handle",
      handle: "maelisrune-00000000",
    });
    expect(resolveProfileRef("a")).toEqual({ kind: "handle", handle: "a" });
    expect(resolveProfileRef("a".repeat(32))).toEqual({
      kind: "handle",
      handle: "a".repeat(32),
    });
  });

  it("trims surrounding spaces", () => {
    expect(resolveProfileRef(" maelisrune-00000000 ")).toEqual({
      kind: "handle",
      handle: "maelisrune-00000000",
    });
  });

  it.each([
    "",
    "   ",
    "maelis_rune",
    "maelis rune",
    "maelis.rune",
    "../etc",
    "élise",
    "a".repeat(33),
    "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz",
  ])("marks anything else as invalid: %s", (ref) => {
    expect(resolveProfileRef(ref)).toEqual({ kind: "invalid" });
  });
});

describe("toPublicProfile", () => {
  it("keeps exactly the contract fields", () => {
    const fixture = publicProfileFixture();
    const raw = {
      ...fixture,
      email: "maelis@example.test",
      heroes: fixture.heroes.map((hero) => ({ ...hero, id: "secret-hero-id" })),
      counters: { ...fixture.counters, internalScore: 9 },
    } as unknown as PublicProfileInput;

    const result = toPublicProfile(raw);

    expect(result).toEqual(publicProfileFixture());
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain("maelis@example.test");
    expect(serialised).not.toContain("secret-hero-id");
  });

  it("keeps the heroes in the order received", () => {
    const result = toPublicProfile({
      ...publicProfileFixture(),
      heroes: [
        { name: "B", classCode: "mage", className: "Mage", level: 1 },
        { name: "A", classCode: "warrior", className: "Warrior", level: 9 },
      ],
    });

    expect(result.heroes.map((hero) => hero.name)).toEqual(["B", "A"]);
  });

  it("reads missing heroes as empty and missing counters as 0", () => {
    const result = toPublicProfile({
      ...publicProfileFixture(),
      heroes: null,
      counters: null,
    });

    expect(result.heroes).toEqual([]);
    expect(result.counters).toEqual({
      heroCount: 0,
      highestHeroLevel: 0,
      completedSessionCount: 0,
    });
  });
});

describe("SEO texts", () => {
  it("builds the page title", () => {
    expect(publicProfileTitle("Maelis Rune")).toBe("Maelis Rune — profile");
  });

  it("describes the profile on the fixture", () => {
    expect(describePublicProfile(publicProfileFixture())).toBe(
      "Maelis Rune's public profile on Project Lantern: New Game+ level 2, 2 heroes, highest hero level 12.",
    );
  });

  it("uses the singular for one hero", () => {
    const profile = publicProfileFixture({
      counters: { heroCount: 1, highestHeroLevel: 12, completedSessionCount: 0 },
    });

    expect(describePublicProfile(profile)).toContain(", 1 hero,");
  });
});

describe("buildProfileCanonicalUrl", () => {
  it("builds the canonical handle URL under the site base path", () => {
    expect(
      buildProfileCanonicalUrl("https://groupe7.diiage.org/game", PUBLIC_HANDLE),
    ).toBe("https://groupe7.diiage.org/game/profiles/maelisrune-00000000");
  });

  it("ignores a trailing slash on the site URL", () => {
    expect(
      buildProfileCanonicalUrl("https://groupe7.diiage.org/game/", PUBLIC_HANDLE),
    ).toBe("https://groupe7.diiage.org/game/profiles/maelisrune-00000000");
  });

  it.each(["", "   "])("returns null without a site URL: %j", (siteUrl) => {
    expect(buildProfileCanonicalUrl(siteUrl, PUBLIC_HANDLE)).toBeNull();
  });
});
