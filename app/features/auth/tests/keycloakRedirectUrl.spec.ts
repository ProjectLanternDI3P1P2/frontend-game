import { describe, expect, it } from "vitest";
import { keycloakRedirectUrl } from "../keycloakRedirectUrl";

describe("keycloakRedirectUrl", () => {
  it("keeps redirects beneath the Nuxt application base URL", () => {
    expect(
      keycloakRedirectUrl(
        { origin: "https://groupe7.diiage.org" } as Location,
        "/game/",
        "/players/play?lobby=alpha",
      ),
    ).toBe("https://groupe7.diiage.org/game/players/play?lobby=alpha");
  });
});
