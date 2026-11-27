import { afterEach, expect, it, vi } from "vitest";
import handler from "../../../server/error-handler";

vi.mock("nitropack/runtime", () => ({
  defineNitroErrorHandler: (callback: unknown) => callback,
}));

afterEach(() => vi.restoreAllMocks());

it("logs an unhandled Nitro exception once and asks Nitro for a silent response", async () => {
  const log = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const writeHead = vi.fn();
  const end = vi.fn();
  const defaultHandler = vi.fn().mockResolvedValue({
    status: 500,
    statusText: "Server Error",
    headers: { "content-type": "application/json" },
    body: { error: true },
  });
  const error = Object.assign(new Error("Service unavailable"), {
    statusCode: 500,
    unhandled: true,
  });

  await handler(
    error as never,
    { path: "/rankings", node: { res: { writeHead, end } } } as never,
    { defaultHandler } as never,
  );

  expect(defaultHandler).toHaveBeenCalledWith(error, expect.anything(), {
    silent: true,
  });
  expect(log).toHaveBeenCalledTimes(1);
  const entry = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;
  expect(entry).toMatchObject({
    level: "error",
    service: "frontend-game",
    origin: "server",
    properties: { route: "/rankings" },
    exception: { type: "Error", message: "Service unavailable" },
  });
  expect(writeHead).toHaveBeenCalledOnce();
  expect(end).toHaveBeenCalledOnce();
});
