import { afterEach, expect, it, vi } from "vitest";
import { safeRoute, writeApplicationLog } from "../../../server/utils/application-log";

afterEach(() => vi.restoreAllMocks());

it("writes one JSON line for a server exception without credential text", () => {
  const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const error = new Error("Bearer abc123 user@example.com");
  writeApplicationLog(
    "error",
    "server",
    "Render failed",
    { route: "/rankings" },
    error,
  );

  expect(write).toHaveBeenCalledTimes(1);
  const line = String(write.mock.calls[0]?.[0]);
  expect(line.endsWith("\n")).toBe(true);
  const entry = JSON.parse(line) as Record<string, unknown>;
  expect(entry).toMatchObject({
    level: "error",
    service: "frontend-game",
    origin: "server",
    properties: { route: "/rankings" },
    exception: { type: "Error" },
  });
  expect(line).not.toContain("abc123");
  expect(line).not.toContain("user@example.com");
  expect(entry.timestamp).toMatch(/\+00:00$/);
});

it("drops routes that might contain personal data", () => {
  expect(safeRoute("/players/12345")).toBe("/players");
  expect(safeRoute("/unknown/alice")).toBeUndefined();
  expect(safeRoute("/rankings?token=abc")).toBe("/rankings");
});
