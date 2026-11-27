import { describe, expect, it } from "vitest";
import { withoutKeycloakCallbackFragment } from "../keycloakCallbackUrl";

describe("withoutKeycloakCallbackFragment", () => {
  it("removes OAuth callback parameters from the browser URL", () => {
    const url = new URL(
      "http://localhost:3000/#state=state-value&session_state=session-value&iss=http%3A%2F%2Flocalhost%3A8081%2Frealms%2Flantern&code=authorization-code",
    );

    expect(withoutKeycloakCallbackFragment(url)).toBe("http://localhost:3000/");
  });

  it("does not remove an ordinary navigation fragment", () => {
    const url = new URL("http://localhost:3000/demo#details");

    expect(withoutKeycloakCallbackFragment(url)).toBeNull();
  });
});
