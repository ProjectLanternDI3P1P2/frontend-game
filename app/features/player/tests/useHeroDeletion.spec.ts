import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { GatewayError } from "~/shared/utils/gateway";
import { useHeroDeletion } from "../composables/useHeroDeletion";
import { HeroDeletionStep, type HeroActiveSession } from "../types";

const PLAYER = "player-1";
const HERO = { id: "hero-1", name: "Brann" };

function setup(activeSession: HeroActiveSession | null = null) {
  const dependencies = {
    deleteHero: vi.fn().mockResolvedValue({
      heroId: HERO.id,
      deleted: true,
      deletedAt: "2026-10-20T10:00:00Z",
      alreadyDeleted: false,
      closedSessionIds: [],
    }),
    refresh: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn().mockResolvedValue(undefined),
    notifySuccess: vi.fn(),
  };
  const deletion = useHeroDeletion(
    ref(PLAYER),
    ref(HERO),
    ref(activeSession),
    dependencies,
  );
  return { deletion, dependencies };
}

const conflict = () =>
  new GatewayError(409, { code: "conflict", message: "The hero is playing a run." });

describe("useHeroDeletion", () => {
  it("deletes a free hero, then goes back to the roster", async () => {
    const { deletion, dependencies } = setup();

    deletion.start();
    expect(deletion.open.value).toBe(true);
    expect(deletion.step.value).toBe(HeroDeletionStep.CONFIRM);
    expect(deletion.closesLobby.value).toBe(false);

    await deletion.confirm();

    expect(dependencies.deleteHero).toHaveBeenCalledWith(PLAYER, HERO.id);
    expect(deletion.open.value).toBe(false);
    expect(dependencies.notifySuccess).toHaveBeenCalledWith(
      "Brann has been deleted. A slot is free again.",
      "Hero deleted",
    );
    expect(dependencies.navigate).toHaveBeenCalledWith("/players/player-1/heroes");
  });

  it("warns that a lobby will be closed, then deletes the hero", async () => {
    const { deletion, dependencies } = setup({ id: "lobby-1", state: "Lobby" });

    deletion.start();
    expect(deletion.step.value).toBe(HeroDeletionStep.CONFIRM);
    expect(deletion.closesLobby.value).toBe(true);
    expect(deletion.sessionId.value).toBe("lobby-1");

    await deletion.confirm();

    expect(dependencies.deleteHero).toHaveBeenCalledOnce();
    expect(dependencies.navigate).toHaveBeenCalledWith("/players/player-1/heroes");
  });

  it("opens straight on the blocked state for a running dungeon", () => {
    const { deletion } = setup({ id: "run-1", state: "Active" });

    deletion.start();

    expect(deletion.step.value).toBe(HeroDeletionStep.BLOCKED);
    expect(deletion.closesLobby.value).toBe(false);
  });

  it("switches to the blocked state on a 409 and reads the hero again", async () => {
    const { deletion, dependencies } = setup({ id: "lobby-1", state: "Lobby" });
    dependencies.deleteHero.mockRejectedValueOnce(conflict());

    deletion.start();
    await deletion.confirm();

    expect(dependencies.refresh).toHaveBeenCalledOnce();
    expect(deletion.step.value).toBe(HeroDeletionStep.BLOCKED);
    expect(deletion.open.value).toBe(true);
    expect(dependencies.navigate).not.toHaveBeenCalled();
  });

  it("treats a replayed deletion as a success", async () => {
    const { deletion, dependencies } = setup();
    dependencies.deleteHero.mockResolvedValueOnce({
      heroId: HERO.id,
      deleted: true,
      deletedAt: "2026-10-20T09:00:00Z",
      alreadyDeleted: true,
      closedSessionIds: [],
    });

    deletion.start();
    await deletion.confirm();

    expect(dependencies.navigate).toHaveBeenCalledWith("/players/player-1/heroes");
  });

  it("keeps the dialog open after an uncertain outcome, then succeeds on retry", async () => {
    const { deletion, dependencies } = setup();
    dependencies.deleteHero.mockRejectedValueOnce(
      new GatewayError(503, { code: "unavailable", message: "Service unavailable" }),
    );

    deletion.start();
    await deletion.confirm();
    expect(deletion.error.value).toBe(
      "Unable to confirm the deletion. Please try again.",
    );
    expect(deletion.open.value).toBe(true);

    await deletion.confirm();
    expect(dependencies.deleteHero).toHaveBeenCalledTimes(2);
    expect(dependencies.navigate).toHaveBeenCalledWith("/players/player-1/heroes");
  });

  it("views a session on the lobby page, whatever its state", () => {
    const { deletion, dependencies } = setup({ id: "run-1", state: "Active" });

    deletion.start();
    deletion.viewSession();

    expect(deletion.open.value).toBe(false);
    expect(dependencies.navigate).toHaveBeenCalledWith(
      "/players/player-1/play/lobbies/run-1",
    );
  });
});
