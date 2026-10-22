import { describe, expect, it } from "vitest";
import { closedLobbyMessage, isClosedLobby, joinGamePath } from "../lobbyClosure";

describe("lobby closure", () => {
  it("recognises only an abandoned lobby as closed", () => {
    expect(isClosedLobby({ state: "Abandoned" })).toBe(true);
    expect(isClosedLobby({ state: "Lobby" })).toBe(false);
    expect(isClosedLobby({ state: "Active" })).toBe(false);
    expect(isClosedLobby(null)).toBe(false);
  });

  it("explains a closure caused by a deleted hero", () => {
    expect(closedLobbyMessage({ failureReason: "HeroDeleted" })).toContain(
      "heroes was deleted",
    );
    expect(closedLobbyMessage({ failureReason: null })).toBe(
      "This lobby has been closed before its run started.",
    );
  });

  it("sends the player back to Join a game", () => {
    expect(joinGamePath("player 1")).toBe("/players/player%201/play");
  });
});
