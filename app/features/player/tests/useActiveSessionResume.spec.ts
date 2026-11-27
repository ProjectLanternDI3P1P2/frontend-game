import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { PlayerCommandRejectedError, PlayerHubError } from "../api/playerHub";
import {
  resumePath,
  useActiveSessionResume,
} from "../composables/useActiveSessionResume";
import type { GameSessionSnapshot } from "../types";

const PLAYER = "player 1";

const snapshot = (overrides: Partial<GameSessionSnapshot>): GameSessionSnapshot => ({
  sessionId: "session-1",
  creatorPlayerId: PLAYER,
  state: "Lobby",
  mode: "Solo",
  members: [],
  dungeonRunId: null,
  dungeonSeed: null,
  failureReason: null,
  alreadyExists: false,
  ...overrides,
});

const conflict = (activeSessionId?: string) =>
  new PlayerCommandRejectedError(
    "The hero is already in a session.",
    "COMMAND_CONFLICT",
    activeSessionId,
  );

function setup(session = snapshot({})) {
  const dependencies = {
    getSessionSnapshot: vi.fn().mockResolvedValue(session),
    navigate: vi.fn().mockResolvedValue(undefined),
  };
  return {
    resume: useActiveSessionResume(ref(PLAYER), dependencies),
    dependencies,
  };
}

describe("resumePath", () => {
  it("opens the lobby page of a lobby", () => {
    expect(resumePath(PLAYER, snapshot({ sessionId: "session/1" }))).toBe(
      "/players/player%201/play/lobbies/session%2F1",
    );
  });

  it("opens the dungeon of a started run", () => {
    expect(
      resumePath(PLAYER, snapshot({ state: "Active", dungeonRunId: "run/1" })),
    ).toBe("/dungeon/run%2F1?playerId=player%201");
  });

  it("falls back to the lobby page when the run is not known yet", () => {
    expect(resumePath(PLAYER, snapshot({ state: "Active" }))).toBe(
      "/players/player%201/play/lobbies/session-1",
    );
  });
});

describe("useActiveSessionResume", () => {
  it("captures a conflict that names the active session", () => {
    const { resume } = setup();

    expect(resume.capture(conflict("session-1"))).toBe(true);
    expect(resume.activeSessionId.value).toBe("session-1");
  });

  it.each([
    ["a conflict without an active session", conflict()],
    [
      "another refusal code",
      new PlayerCommandRejectedError("Invalid.", "VALIDATION_ERROR", "session-1"),
    ],
    ["a transport error", new PlayerHubError("Connection lost.")],
    ["an unknown failure", new Error("boom")],
  ])("leaves %s to the page error", (_label, cause) => {
    const { resume } = setup();

    expect(resume.capture(cause)).toBe(false);
    expect(resume.activeSessionId.value).toBeNull();
  });

  it("resumes a lobby from its snapshot", async () => {
    const { resume, dependencies } = setup(snapshot({ state: "Lobby" }));
    resume.capture(conflict("session-1"));

    await resume.resume();

    expect(dependencies.getSessionSnapshot).toHaveBeenCalledWith("session-1");
    expect(dependencies.navigate).toHaveBeenCalledWith(
      "/players/player%201/play/lobbies/session-1",
    );
    expect(resume.resuming.value).toBe(false);
  });

  it("resumes a started run on the dungeon screen", async () => {
    const { resume, dependencies } = setup(
      snapshot({ state: "Active", dungeonRunId: "run-1" }),
    );
    resume.capture(conflict("session-1"));

    await resume.resume();

    expect(dependencies.navigate).toHaveBeenCalledWith(
      "/dungeon/run-1?playerId=player%201",
    );
  });

  it("shows the refusal and stays on the page when the snapshot cannot be read", async () => {
    const { resume, dependencies } = setup();
    dependencies.getSessionSnapshot.mockRejectedValue(
      new PlayerHubError("The session was not found."),
    );
    resume.capture(conflict("session-1"));

    await resume.resume();

    expect(resume.resumeError.value).toBe("The session was not found.");
    expect(dependencies.navigate).not.toHaveBeenCalled();
    expect(resume.resuming.value).toBe(false);
  });

  it("does nothing without a captured conflict", async () => {
    const { resume, dependencies } = setup();

    await resume.resume();

    expect(dependencies.getSessionSnapshot).not.toHaveBeenCalled();
  });

  it("forgets the conflict and its resume error", () => {
    const { resume } = setup();
    resume.capture(conflict("session-1"));
    resume.resumeError.value = "Unable to resume the game.";

    resume.clear();

    expect(resume.activeSessionId.value).toBeNull();
    expect(resume.resumeError.value).toBe("");
  });
});
