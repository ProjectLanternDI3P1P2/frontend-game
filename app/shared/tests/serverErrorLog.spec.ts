import { afterEach, expect, it, vi } from "vitest";
import plugin from "../../../server/plugins/error-log";

vi.mock("nitropack/runtime", () => ({
  defineNitroPlugin: (setup: unknown) => setup,
}));

type ErrorHook = (error: Error, context: { event?: { path?: string } }) => void;

function install(): ErrorHook {
  let hook: ErrorHook | undefined;
  const nitroApp = {
    hooks: {
      hook: (name: string, callback: ErrorHook) => {
        if (name === "error") hook = callback;
      },
    },
  };
  (plugin as unknown as (app: typeof nitroApp) => void)(nitroApp);
  return hook!;
}

afterEach(() => vi.restoreAllMocks());

it("logs an unhandled server exception once, as JSON", () => {
  const log = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const hook = install();

  hook(
    Object.assign(new Error("Service unavailable"), {
      statusCode: 500,
      unhandled: true,
    }),
    { event: { path: "/rankings" } },
  );

  expect(log).toHaveBeenCalledTimes(1);
  const entry = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;
  expect(entry).toMatchObject({
    level: "error",
    service: "frontend-game",
    origin: "server",
    properties: { route: "/rankings" },
    exception: { type: "Error", message: "Service unavailable" },
  });
});

it("logs a fatal error at fatal level", () => {
  const log = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const hook = install();

  hook(Object.assign(new Error("Renderer crashed"), { statusCode: 500, fatal: true }), {
    event: { path: "/rankings" },
  });

  expect(log).toHaveBeenCalledTimes(1);
  const entry = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;
  expect(entry).toMatchObject({ level: "fatal" });
});

it("does not log an expected 404 such as « Player not found »", () => {
  const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const hook = install();

  hook(
    Object.assign(new Error("Player not found"), {
      statusCode: 404,
      statusMessage: "Player not found",
    }),
    { event: { path: "/profiles/x" } },
  );

  expect(stderr).not.toHaveBeenCalled();
  expect(stdout).not.toHaveBeenCalled();
});

it("collapses a profile route to /profiles", () => {
  const log = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const hook = install();

  hook(Object.assign(new Error("Bad gateway"), { statusCode: 502 }), {
    event: { path: "/profiles/maelisrune-00000000" },
  });

  expect(log).toHaveBeenCalledTimes(1);
  const entry = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;
  expect(entry).toMatchObject({ properties: { route: "/profiles" } });
});
