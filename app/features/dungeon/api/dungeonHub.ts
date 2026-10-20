/**
 * Gameplay of a dungeon run over the Dungeon service's SignalR Hub
 * (`/hubs/dungeons`, see the backend's docs/architecture/DUNGEON_HUB.fr.md).
 * Every call answers an explicit acknowledgement: accepted with the run
 * snapshot, or refused with the reason and nothing changed.
 */
import {
  SignalRHubClient,
  SignalRHubError,
  signalRHubUrl,
} from "~/shared/api/signalRHubClient";
import type { Direction, DungeonRunResponse } from "../types";

type DungeonAcknowledgement = {
  commandId: string | null;
  accepted: boolean;
  error: { code: string; message: string } | null;
  snapshot: DungeonRunResponse | null;
};

export class DungeonHubClient {
  private readonly hub: SignalRHubClient;

  constructor(
    hubUrl: string,
    onDungeonStateChanged?: (run: DungeonRunResponse) => void,
  ) {
    this.hub = new SignalRHubClient(hubUrl, {
      DungeonStateChanged: ([run]) =>
        onDungeonStateChanged?.(run as DungeonRunResponse),
    });
  }

  /** Joins the run's group and returns its current snapshot. Calling it again resynchronizes. */
  async joinDungeon(dungeonId: string): Promise<DungeonRunResponse> {
    return this.accept(
      await this.hub.invoke<DungeonAcknowledgement>("JoinDungeon", { dungeonId }),
    );
  }

  /** One tile, one turn. Into the open gate, it takes the party down to the next floor. */
  async moveHero(dungeonId: string, direction: Direction): Promise<DungeonRunResponse> {
    return this.accept(
      await this.hub.invoke<DungeonAcknowledgement>("MoveHero", {
        commandId: crypto.randomUUID(),
        dungeonId,
        direction,
      }),
    );
  }

  disconnect(): Promise<void> {
    return this.hub.disconnect();
  }

  private accept(acknowledgement: DungeonAcknowledgement): DungeonRunResponse {
    if (!acknowledgement.accepted || !acknowledgement.snapshot) {
      throw new SignalRHubError(
        acknowledgement.error?.message ?? "The dungeon command was rejected.",
      );
    }
    return acknowledgement.snapshot;
  }
}

export { SignalRHubError as DungeonHubError };

export function dungeonHubUrl(gatewayUrl: string): string {
  return signalRHubUrl(gatewayUrl, "/hubs/dungeons");
}
