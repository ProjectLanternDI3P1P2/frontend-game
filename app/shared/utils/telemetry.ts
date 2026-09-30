/**
 * ADR-FE-013 — Browser error and Core Web Vitals reporting.
 *
 * Signals are shipped to the project observability stack through a
 * platform-provided endpoint. No third-party RUM SaaS is introduced.
 *
 * Privacy rule (ADR-FE-013): an event NEVER carries an access token, a secret
 * or unnecessary personal data. Only the fields below are allowed.
 */

export type TelemetryEventType = "web-vital" | "browser-error" | "custom-timing";

export interface TelemetryContext {
  /** Application name, e.g. `game-client`. */
  app: string;
  /** Deployed version, so a regression can be attributed to a release. */
  version: string;
}

export interface TelemetryEvent {
  type: TelemetryEventType;
  /** Metric or error name: `LCP`, `INP`, `CLS`, `unhandledrejection`... */
  name: string;
  /** Numeric value for metrics; omitted for errors. */
  value?: number;
  /** `good` / `needs-improvement` / `poor` for Web Vitals. */
  rating?: string;
  /** Route pattern, never a URL containing personal data. */
  route: string;
  /** Business operation when known, e.g. `inventory.equip`. */
  operation?: string;
  /** Correlation identifier propagated from the Gateway when available. */
  correlationId?: string;
  message?: string;
  stack?: string;
  app: string;
  version: string;
  timestamp: string;
}

/** Fields that are allowed to leave the browser. Anything else is dropped. */
const ALLOWED_FIELDS = new Set<keyof TelemetryEvent>([
  "type",
  "name",
  "value",
  "rating",
  "route",
  "operation",
  "correlationId",
  "message",
  "stack",
  "app",
  "version",
  "timestamp",
]);

const SECRET_PATTERNS = [
  /\bbearer\s+[a-z0-9._-]+/gi,
  /\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/g,
  /\b(?:api[_-]?key|token|password|secret)\s*[=:]\s*\S+/gi,
];

/** Removes anything that looks like a credential from free-text fields. */
export function redact(text: string | undefined): string | undefined {
  if (!text) return text;
  return SECRET_PATTERNS.reduce(
    (redacted, pattern) => redacted.replace(pattern, "[redacted]"),
    text,
  ).slice(0, 2000);
}

export function sanitiseEvent(event: TelemetryEvent): TelemetryEvent {
  const safe = {} as TelemetryEvent;
  for (const key of Object.keys(event) as (keyof TelemetryEvent)[]) {
    if (ALLOWED_FIELDS.has(key)) Object.assign(safe, { [key]: event[key] });
  }
  safe.message = redact(safe.message);
  safe.stack = redact(safe.stack);
  return safe;
}

export interface TelemetryReporter {
  report: (event: Omit<TelemetryEvent, "app" | "version" | "timestamp">) => void;
}

/**
 * Creates a reporter that batches events and flushes them with `sendBeacon`
 * where available, so instrumentation cost stays bounded (ADR-FE-013).
 */
export function createTelemetryReporter(
  context: TelemetryContext,
  endpoint: string,
  options: {
    flushIntervalMs?: number;
    maxBatchSize?: number;
    sampleRate?: number;
  } = {},
): TelemetryReporter {
  const flushIntervalMs = options.flushIntervalMs ?? 5000;
  const maxBatchSize = options.maxBatchSize ?? 20;
  const sampleRate = options.sampleRate ?? 1;
  const queue: TelemetryEvent[] = [];

  function flush(): void {
    if (queue.length === 0 || !endpoint) return;
    const batch = queue.splice(0, queue.length);
    const payload = JSON.stringify({ events: batch });

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      navigator.sendBeacon(endpoint, new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch(endpoint, {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {
      /* telemetry must never break the application */
    });
  }

  if (typeof window !== "undefined") {
    setInterval(flush, flushIntervalMs);
    // A player closing the tab must not lose the session's measurements.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  return {
    report(event) {
      if (!endpoint) return;
      if (event.type === "web-vital" && !isSampled(sampleRate)) return;
      queue.push(
        sanitiseEvent({
          ...event,
          app: context.app,
          version: context.version,
          timestamp: new Date().toISOString(),
        } as TelemetryEvent),
      );
      if (queue.length >= maxBatchSize) flush();
    },
  };
}

function isSampled(sampleRate: number): boolean {
  if (sampleRate >= 1 || typeof crypto === "undefined") return true;
  if (sampleRate <= 0) return false;

  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return (bytes[0] ?? 0) / 2 ** 32 < sampleRate;
}
