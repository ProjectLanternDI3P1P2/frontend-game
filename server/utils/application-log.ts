type Level = "debug" | "information" | "warning" | "error" | "fatal";
type Origin = "server" | "browser";

const secret =
  /\b(?:bearer\s+\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:api[_-]?key|token|password|secret)\s*[=:]\s*\S+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
const allowedRouteRoots = new Set([
  "",
  "auth",
  "demo",
  "dungeon",
  "home",
  "leaderboard",
  "players",
  "profiles",
  "rankings",
]);

function safeText(value: string): string {
  return value
    .replace(secret, "[redacted]")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);
}

export function safeRoute(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const route = value.split(/[?#]/, 1)[0];
  if (!route || route.length > 120 || !/^\/[a-zA-Z0-9_/*:.()-]*$/.test(route)) {
    return undefined;
  }
  const root = route.split("/")[1] ?? "";
  if (!allowedRouteRoots.has(root)) return undefined;
  // The first segment is a known route; later segments may be user supplied.
  return route === "/" || route === `/${root}` ? route : `/${root}`;
}

export function writeApplicationLog(
  level: Level,
  origin: Origin,
  message: string,
  properties: Record<string, string | number | undefined>,
  error?: Error,
): void {
  const entry = {
    timestamp: new Date().toISOString().replace("Z", "+00:00"),
    level,
    service: "frontend-game",
    origin,
    message: safeText(message),
    properties,
    ...(error && {
      exception: {
        type: /^[A-Za-z][A-Za-z0-9.]{0,79}$/.test(error.name) ? error.name : "Error",
        message: safeText(error.message),
        ...(error.stack && { stack: safeText(error.stack) }),
      },
    }),
  };
  const stream =
    level === "error" || level === "fatal" ? process.stderr : process.stdout;
  stream.write(JSON.stringify(entry) + "\n");
}
