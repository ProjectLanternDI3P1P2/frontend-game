import {
  SignalRHubClient,
  SignalRHubError,
  signalRHubUrl,
} from "~/shared/api/signalRHubClient";

import type { GameSessionSnapshot } from "../types";

interface CreateSessionCommand {
  commandId: string;
  playerId: string;
  heroId: string;
}

interface SessionCommandAcknowledgement {
  accepted: boolean;
  session: GameSessionSnapshot | null;
  error: { code: string; message: string } | null;
}

/** Player-specific commands and events on top of the shared SignalR transport. */
export class PlayerHubClient {
  private readonly hub: SignalRHubClient;

  constructor(
    hubUrl: string,
    onSessionStateChanged: (session: GameSessionSnapshot) => void,
  ) {
    this.hub = new SignalRHubClient(hubUrl, {
      SessionStateChanged: ([session]) =>
        onSessionStateChanged(session as GameSessionSnapshot),
    });
  }

  async createSession(command: CreateSessionCommand): Promise<GameSessionSnapshot> {
    const acknowledgement = await this.hub.invoke<SessionCommandAcknowledgement>(
      "CreateSession",
      command,
    );

    if (!acknowledgement.accepted || !acknowledgement.session) {
      throw new SignalRHubError(
        acknowledgement.error?.message ?? "The game creation command was rejected.",
      );
    }

    return acknowledgement.session;
  }

  disconnect(): Promise<void> {
    return this.hub.disconnect();
  }
}

export { SignalRHubError as PlayerHubError };

export function playerHubUrl(gatewayUrl: string): string {
  return signalRHubUrl(gatewayUrl, "/hubs/player");
}
