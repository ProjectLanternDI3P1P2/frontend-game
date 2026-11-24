import { describe, expect, it, vi } from "vitest";
import { restoreKeycloakSession } from "../keycloakSession";

describe("restoreKeycloakSession", () => {
  it("forgets an expired Keycloak session and continues anonymously", async () => {
    const clearPersistedTokens = vi.fn();

    await expect(
      restoreKeycloakSession(
        () => Promise.reject(new Error("Session not active")),
        clearPersistedTokens,
      ),
    ).resolves.toBe(false);

    expect(clearPersistedTokens).toHaveBeenCalledOnce();
  });
});
