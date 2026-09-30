/**
 * ADR-FE-011 — Hand-written, typed HTTP client for the API Gateway.
 *
 * No TypeScript client is generated from OpenAPI. This module is the single
 * low-level transport helper; every feature builds its own typed functions on
 * top of it inside its own `api/` folder (ADR-FE-009).
 *
 * It is deliberately framework-agnostic so it can be unit tested with Vitest
 * without a browser journey (ADR-FE-012).
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Error envelope documented by the Gateway. */
export interface GatewayErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

interface GatewayProblemDetails {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

export class GatewayError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly correlationId?: string;

  constructor(status: number, body: GatewayErrorBody, correlationId?: string) {
    super(body.message);
    this.name = "GatewayError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.correlationId = correlationId;
  }

  /**
   * ADR-FE-008: after an uncertain or failed business action the client must
   * show an explicit state and re-read the authoritative result. A request that
   * may have been applied server-side is never silently assumed to have failed.
   */
  get isOutcomeUncertain(): boolean {
    return this.status === 0 || this.status === 408 || this.status >= 500;
  }
}

export interface GatewayRequest {
  path: string;
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
  /** Overrides the client-level token for a single call. */
  token?: string | null;
}

export interface GatewayClientOptions {
  baseUrl: string;
  apiVersion: string;
  /** Returns the current access token, or null when the user is anonymous. */
  getToken?: () => string | null;
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected for tests; defaults to crypto.randomUUID. */
  correlationIdFactory?: () => string;
}

export interface GatewayClient {
  request: <TResponse>(req: GatewayRequest) => Promise<TResponse>;
  get: <TResponse>(
    path: string,
    req?: Omit<GatewayRequest, "path" | "method" | "body">,
  ) => Promise<TResponse>;
  post: <TResponse>(
    path: string,
    body?: unknown,
    req?: Omit<GatewayRequest, "path" | "method" | "body">,
  ) => Promise<TResponse>;
  put: <TResponse>(
    path: string,
    body?: unknown,
    req?: Omit<GatewayRequest, "path" | "method" | "body">,
  ) => Promise<TResponse>;
  delete: <TResponse>(
    path: string,
    req?: Omit<GatewayRequest, "path" | "method" | "body">,
  ) => Promise<TResponse>;
}

function defaultCorrelationId(): string {
  const browserCrypto = globalThis.crypto;
  if (browserCrypto?.randomUUID) return browserCrypto.randomUUID();
  if (browserCrypto) {
    const bytes = browserCrypto.getRandomValues(new Uint32Array(4));
    return `cid-${Array.from(bytes, (byte) => byte.toString(16)).join("")}`;
  }
  return `cid-${Date.now()}`;
}

/** Builds `/api/v1/<path>?<query>` without ever leaking undefined parameters. */
export function buildGatewayUrl(
  baseUrl: string,
  apiVersion: string,
  path: string,
  query?: GatewayRequest["query"],
): string {
  const normalisedBase = baseUrl.replace(/\/+$/, "");
  const normalisedPath = path.replace(/^\/+/, "");
  const isRelativeBase = normalisedBase === "" || normalisedBase.startsWith("/");
  const url = new URL(
    `${normalisedBase}/api/${apiVersion}/${normalisedPath}`,
    "http://local-gateway.invalid",
  );

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return isRelativeBase ? `${url.pathname}${url.search}` : url.toString();
}

export function createGatewayClient(options: GatewayClientOptions): GatewayClient {
  const doFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const newCorrelationId = options.correlationIdFactory ?? defaultCorrelationId;

  async function request<TResponse>(req: GatewayRequest): Promise<TResponse> {
    const method = req.method ?? "GET";
    const correlationId = newCorrelationId();
    const token = req.token !== undefined ? req.token : (options.getToken?.() ?? null);

    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Correlation-Id": correlationId,
    };
    if (req.body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await doFetch(
        buildGatewayUrl(options.baseUrl, options.apiVersion, req.path, req.query),
        {
          method,
          headers,
          signal: req.signal,
          body: req.body === undefined ? undefined : JSON.stringify(req.body),
        },
      );
    } catch (cause) {
      // Network-level failure: the outcome of a write is genuinely unknown.
      throw new GatewayError(
        0,
        {
          code: "NETWORK_UNAVAILABLE",
          message: "The API Gateway is unreachable.",
          details: String(cause),
        },
        correlationId,
      );
    }

    if (response.status === 204) return undefined as TResponse;

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const body: GatewayErrorBody = isErrorBody(payload)
        ? payload
        : isProblemDetails(payload)
          ? {
              code: response.status === 422 ? "VALIDATION_ERROR" : "REQUEST_REJECTED",
              message:
                payload.detail ??
                payload.title ??
                `Request ${method} ${req.path} failed (${response.status}).`,
              details: payload,
            }
          : {
              code: "UNEXPECTED_ERROR",
              message: `Request ${method} ${req.path} failed (${response.status}).`,
            };
      throw new GatewayError(
        response.status,
        body,
        response.headers.get("X-Correlation-Id") ?? correlationId,
      );
    }

    return payload as TResponse;
  }

  return {
    request,
    get: (path, req) => request({ ...req, path, method: "GET" }),
    post: (path, body, req) => request({ ...req, path, method: "POST", body }),
    put: (path, body, req) => request({ ...req, path, method: "PUT", body }),
    delete: (path, req) => request({ ...req, path, method: "DELETE" }),
  };
}

function isErrorBody(value: unknown): value is GatewayErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as GatewayErrorBody).code === "string" &&
    typeof (value as GatewayErrorBody).message === "string"
  );
}

function isProblemDetails(value: unknown): value is GatewayProblemDetails {
  return (
    typeof value === "object" &&
    value !== null &&
    (typeof (value as GatewayProblemDetails).title === "string" ||
      typeof (value as GatewayProblemDetails).detail === "string")
  );
}
