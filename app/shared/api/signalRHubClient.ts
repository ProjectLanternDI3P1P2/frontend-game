const recordSeparator = "\u001e";

export class SignalRHubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignalRHubError";
  }
}

type SignalRInvocation = {
  type: 1;
  target: string;
  arguments?: unknown[];
};

type SignalRCompletion = {
  type: 3;
  invocationId: string;
  result?: unknown;
  error?: string;
};

type SignalRServerMessage = SignalRInvocation | SignalRCompletion;

type Completion = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

/**
 * Transport client shared by the application's SignalR hubs.
 * It intentionally forces WebSocket transport: callers never fall back to
 * REST or long polling (ADR-GLOB-001).
 */
export class SignalRHubClient {
  private socket: WebSocket | null = null;
  private connecting: Promise<void> | null = null;
  private readonly completions = new Map<string, Completion>();
  private nextInvocationId = 0;

  constructor(
    private readonly hubUrl: string,
    private readonly eventHandlers: Readonly<
      Record<string, (arguments_: readonly unknown[]) => void>
    > = {},
  ) {}

  async invoke<TResult>(target: string, ...arguments_: unknown[]): Promise<TResult> {
    await this.connect();
    const invocationId = String(++this.nextInvocationId);

    return new Promise<TResult>((resolve, reject) => {
      this.completions.set(invocationId, { resolve, reject });
      this.send({ type: 1, invocationId, target, arguments: arguments_ });
    });
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
    const negotiation = await fetch(
      `${this.hubUrl.replace(/\/$/, "")}/negotiate?negotiateVersion=1`,
      {
        method: "POST",
        headers: { "X-Correlation-Id": crypto.randomUUID() },
      },
    );
    if (!negotiation.ok)
      throw new SignalRHubError("Unable to negotiate the SignalR connection.");

    const { connectionToken } = (await negotiation.json()) as {
      connectionToken?: string;
    };
    if (!connectionToken)
      throw new SignalRHubError("The SignalR hub returned an invalid connection.");

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(toWebSocketUrl(this.hubUrl, connectionToken));
      let handshaken = false;

      socket.addEventListener("open", () =>
        socket.send(`{"protocol":"json","version":1}${recordSeparator}`),
      );
      socket.addEventListener("message", (event) => {
        for (const payload of String(event.data)
          .split(recordSeparator)
          .filter(Boolean)) {
          const message = JSON.parse(payload) as Record<string, unknown>;
          if (!handshaken) {
            handshaken = true;
            if (message.error) reject(new SignalRHubError(String(message.error)));
            else resolve();
            continue;
          }
          this.handleMessage(message as SignalRServerMessage);
        }
      });
      socket.addEventListener("error", () =>
        reject(new SignalRHubError("SignalR connection failed.")),
      );
      socket.addEventListener("close", () => {
        this.socket = null;
        for (const completion of this.completions.values()) {
          completion.reject(
            new SignalRHubError(
              "SignalR connection closed before the command completed.",
            ),
          );
        }
        this.completions.clear();
      });
      this.socket = socket;
    });
  }

  private handleMessage(message: SignalRServerMessage): void {
    if (message.type === 1) {
      this.eventHandlers[message.target]?.(message.arguments ?? []);
      return;
    }

    const completion = this.completions.get(message.invocationId);
    if (!completion) return;

    this.completions.delete(message.invocationId);
    if (message.error) completion.reject(new SignalRHubError(message.error));
    else completion.resolve(message.result);
  }

  private send(message: Record<string, unknown>): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new SignalRHubError("SignalR connection is not open.");
    }
    this.socket.send(`${JSON.stringify(message)}${recordSeparator}`);
  }
}

export function signalRHubUrl(gatewayUrl: string, hubPath: string): string {
  const normalizedPath = hubPath.startsWith("/") ? hubPath : `/${hubPath}`;
  return `${gatewayUrl.replace(/\/$/, "")}${normalizedPath}`;
}

function toWebSocketUrl(hubUrl: string, connectionToken: string): string {
  const url = new URL(hubUrl, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("id", connectionToken);
  return url.toString();
}
