import type { GameSessionSnapshot } from "../types";

const recordSeparator = "\u001e";

export class PlayerHubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlayerHubError";
  }
}

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

interface InvocationCompletion {
  type: 3;
  invocationId: string;
  result?: SessionCommandAcknowledgement;
  error?: string;
}

interface SignalRInvocation {
  type: 1;
  target: string;
  arguments: unknown[];
}

/**
 * Minimal typed SignalR-over-WebSocket client for Player gameplay commands.
 * It intentionally forces WebSocket transport: gameplay never falls back to a
 * REST request or another long-polling transport (ADR-GLOB-001).
 */
export class PlayerHubClient {
  private socket: WebSocket | null = null;
  private connecting: Promise<void> | null = null;
  private readonly completions = new Map<
    string,
    { resolve: (value: SessionCommandAcknowledgement) => void; reject: (error: Error) => void }
  >();
  private nextInvocationId = 0;

  constructor(
    private readonly hubUrl: string,
    private readonly onSessionStateChanged: (session: GameSessionSnapshot) => void,
  ) {}

  async createSession(command: CreateSessionCommand): Promise<GameSessionSnapshot> {
    await this.connect();
    const invocationId = String(++this.nextInvocationId);
    const acknowledgement = await new Promise<SessionCommandAcknowledgement>((resolve, reject) => {
      this.completions.set(invocationId, { resolve, reject });
      this.send({
        type: 1,
        invocationId,
        target: "CreateSession",
        arguments: [command],
      });
    });

    if (!acknowledgement.accepted || !acknowledgement.session) {
      throw new PlayerHubError(
        acknowledgement.error?.message ?? "The game creation command was rejected.",
      );
    }

    return acknowledgement.session;
  }

  async disconnect(): Promise<void> {
    this.socket?.close();
    this.socket = null;
    this.connecting = null;
  }

  private async connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    this.connecting ??= this.openWebSocket();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async openWebSocket(): Promise<void> {
    const negotiation = await fetch(`${this.hubUrl.replace(/\/$/, "")}/negotiate?negotiateVersion=1`, {
      method: "POST",
      headers: { "X-Correlation-Id": crypto.randomUUID() },
    });
    if (!negotiation.ok) throw new PlayerHubError("Unable to connect to the game service.");

    const { connectionToken } = (await negotiation.json()) as { connectionToken?: string };
    if (!connectionToken) throw new PlayerHubError("The game service returned an invalid connection.");

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(toWebSocketUrl(this.hubUrl, connectionToken));
      let handshaken = false;
      socket.addEventListener("open", () => socket.send(`{"protocol":"json","version":1}${recordSeparator}`));
      socket.addEventListener("message", (event) => {
        for (const payload of String(event.data).split(recordSeparator).filter(Boolean)) {
          const message = JSON.parse(payload) as Record<string, unknown>;
          if (!handshaken) {
            handshaken = true;
            if (message.error) reject(new PlayerHubError(String(message.error)));
            else resolve();
            continue;
          }
          this.handleMessage(message as unknown as SignalRInvocation | InvocationCompletion);
        }
      });
      socket.addEventListener("error", () => reject(new PlayerHubError("Game connection failed.")));
      socket.addEventListener("close", () => {
        this.socket = null;
        for (const completion of this.completions.values()) {
          completion.reject(new PlayerHubError("Game connection closed before the command completed."));
        }
        this.completions.clear();
      });
      this.socket = socket;
    });
  }

  private handleMessage(message: SignalRInvocation | InvocationCompletion): void {
    if (message.type === 1 && message.target === "SessionStateChanged") {
      this.onSessionStateChanged(message.arguments[0] as GameSessionSnapshot);
      return;
    }
    if (message.type === 3) {
      const completion = this.completions.get(message.invocationId);
      if (!completion) return;
      this.completions.delete(message.invocationId);
      if (message.error) completion.reject(new PlayerHubError(message.error));
      else if (message.result) completion.resolve(message.result);
      else completion.reject(new PlayerHubError("Game service returned no command acknowledgement."));
    }
  }

  private send(message: Record<string, unknown>): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new PlayerHubError("Game connection is not open.");
    }
    this.socket.send(`${JSON.stringify(message)}${recordSeparator}`);
  }
}

export function playerHubUrl(gatewayUrl: string): string {
  return `${gatewayUrl.replace(/\/$/, "")}/hubs/player` || "/hubs/player";
}

function toWebSocketUrl(hubUrl: string, connectionToken: string): string {
  const url = new URL(hubUrl, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("id", connectionToken);
  return url.toString();
}
