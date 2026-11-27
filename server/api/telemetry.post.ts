import { safeRoute, writeApplicationLog } from "../utils/application-log";

const MAX_BODY_BYTES = 16_384;
const MAX_EVENTS = 20;
const VITAL_NAMES = new Set(["LCP", "INP", "CLS"]);
const ERROR_NAMES = new Set(["window.error", "unhandledrejection", "vue.errorHandler"]);
const RATINGS = new Set(["good", "needs-improvement", "poor"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeVersion(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-zA-Z0-9._-]{1,32}$/.test(value)
    ? value
    : undefined;
}

export default defineEventHandler(async (event) => {
  if (
    getHeader(event, "content-type")?.split(";", 1)[0]?.trim() !== "application/json"
  ) {
    throw createError({ statusCode: 415, statusMessage: "JSON required" });
  }
  if (Number(getHeader(event, "content-length")) > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "Telemetry too large" });
  }

  // Enforce the limit while streaming, including requests without Content-Length.
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of event.node.req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += part.length;
    if (bytes > MAX_BODY_BYTES) {
      throw createError({ statusCode: 413, statusMessage: "Telemetry too large" });
    }
    chunks.push(part);
  }
  const raw = Buffer.concat(chunks);

  let body: unknown;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid telemetry" });
  }
  if (
    !isRecord(body) ||
    !Array.isArray(body.events) ||
    body.events.length < 1 ||
    body.events.length > MAX_EVENTS
  ) {
    throw createError({ statusCode: 400, statusMessage: "Invalid telemetry" });
  }

  const entries = body.events.map((value: unknown) => {
    if (!isRecord(value)) return undefined;
    const route = safeRoute(value.route);
    const version = safeVersion(value.version);
    if (!route || !version || typeof value.name !== "string") return undefined;

    if (value.type === "browser-error" && ERROR_NAMES.has(value.name)) {
      return {
        level: "error" as const,
        message: "Browser error reported",
        properties: { eventType: "browser-error", name: value.name, route, version },
      };
    }
    if (
      value.type === "web-vital" &&
      VITAL_NAMES.has(value.name) &&
      typeof value.value === "number" &&
      Number.isFinite(value.value) &&
      value.value >= 0 &&
      value.value <= 1_000_000 &&
      typeof value.rating === "string" &&
      RATINGS.has(value.rating)
    ) {
      return {
        level: "information" as const,
        message: "Web Vital measured",
        properties: {
          eventType: "web-vital",
          name: value.name,
          value: value.value,
          rating: value.rating,
          route,
          version,
        },
      };
    }
    return undefined;
  });

  if (entries.some((entry) => !entry)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid telemetry" });
  }
  for (const entry of entries) {
    if (entry)
      writeApplicationLog(entry.level, "browser", entry.message, entry.properties);
  }
  return { accepted: entries.length };
});
