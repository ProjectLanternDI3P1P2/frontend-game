import {
  SignalRHubClient,
  SignalRHubError,
  signalRHubUrl,
} from "~/shared/api/signalRHubClient";
import type { GameSessionSnapshot } from "../types";

type SessionAcknowledgement = {
  accepted: boolean;
  session?: GameSessionSnapshot;
  error?: { message?: string };
};

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

  async createSoloLobby(command: {
    commandId: string;
    playerId: string;
    heroId: string;
  }): Promise<GameSessionSnapshot> {
    return this.accept(
      await this.hub.invoke<SessionAcknowledgement>("CreateSoloLobby", command),
    );
  }

  async getSessionSnapshot(
    playerId: string,
    sessionId: string,
  ): Promise<GameSessionSnapshot> {
    return this.accept(
      await this.hub.invoke<SessionAcknowledgement>("GetSessionSnapshot", {
        playerId,
        sessionId,
      }),
    );
  }

  async startSession(command: {
    commandId: string;
    playerId: string;
    sessionId: string;
  }): Promise<GameSessionSnapshot> {
    return this.accept(
      await this.hub.invoke<SessionAcknowledgement>("StartSession", command),
    );
  }

  async changeSessionHero(command: {
    commandId: string;
    playerId: string;
    sessionId: string;
    heroId: string;
  }): Promise<GameSessionSnapshot> {
    return this.accept(
      await this.hub.invoke<SessionAcknowledgement>("ChangeSessionHero", command),
    );
  }

  disconnect(): Promise<void> {
    return this.hub.disconnect();
  }

  private accept(acknowledgement: SessionAcknowledgement): GameSessionSnapshot {
    if (!acknowledgement.accepted || !acknowledgement.session) {
      throw new SignalRHubError(
        acknowledgement.error?.message ?? "The session command was rejected.",
      );
    }
    return acknowledgement.session;
  }
}

export { SignalRHubError as PlayerHubError };

export function playerHubUrl(gatewayUrl: string): string {
  return signalRHubUrl(gatewayUrl, "/hubs/player");
}
