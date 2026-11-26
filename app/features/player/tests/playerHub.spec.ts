import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerCommandRejectedError, PlayerHubClient } from "../api/playerHub";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("~/shared/api/signalRHubClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/shared/api/signalRHubClient")>()),
  SignalRHubClient: class {
    invoke = invoke;
    disconnect = vi.fn();
  },
}));

const createLobby = () =>
  new PlayerHubClient("wss://gateway/hubs/player", vi.fn()).createSoloLobby({
    commandId: "command-1",
    heroId: "hero-1",
  });

describe("PlayerHubClient refusals", () => {
  beforeEach(() => invoke.mockReset());

  it("carries the code and the active session of a conflict", async () => {
    invoke.mockResolvedValue({
      accepted: false,
      error: {
        code: "COMMAND_CONFLICT",
        message: "The hero is already in a session.",
        activeSessionId: "session-1",
      },
    });

    const rejection = await createLobby().catch((cause: unknown) => cause);

    expect(rejection).toBeInstanceOf(PlayerCommandRejectedError);
    expect(rejection).toMatchObject({
      message: "The hero is already in a session.",
      code: "COMMAND_CONFLICT",
      activeSessionId: "session-1",
    });
  });

  it("keeps the code of a refusal without an active session", async () => {
    invoke.mockResolvedValue({
      accepted: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid seed." },
    });

    await expect(createLobby()).rejects.toMatchObject({
      message: "Invalid seed.",
      code: "VALIDATION_ERROR",
      activeSessionId: undefined,
    });
  });

  it("falls back to the default message when the refusal has no error", async () => {
    invoke.mockResolvedValue({ accepted: false });

    await expect(createLobby()).rejects.toMatchObject({
      message: "The session command was rejected.",
      code: undefined,
      activeSessionId: undefined,
    });
  });

  it("returns the session of an accepted command", async () => {
    invoke.mockResolvedValue({ accepted: true, session: { sessionId: "session-1" } });

    await expect(createLobby()).resolves.toEqual({ sessionId: "session-1" });
  });
});
