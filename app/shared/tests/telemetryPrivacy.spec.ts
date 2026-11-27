import { expect, it } from "vitest";
import { sanitiseEvent } from "../utils/telemetry";

it("drops browser error text and unexpected fields before transmission", () => {
  const event = sanitiseEvent({
    type: "browser-error",
    name: "window.error",
    route: "/dungeon",
    version: "1.4.2",
    app: "frontend-game",
    timestamp: "2026-11-25T12:00:00Z",
    message: "Bearer private-token",
    stack: "user@example.com",
    correlationId: "private",
    operation: "private",
  });

  expect(event).not.toHaveProperty("message");
  expect(event).not.toHaveProperty("stack");
  expect(event).not.toHaveProperty("correlationId");
  expect(event).not.toHaveProperty("operation");
  expect(JSON.stringify(event)).not.toContain("private");
});
