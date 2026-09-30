/**
 * ADR-FE-011 — The hand-written Gateway client is the one piece of shared
 * transport code in this repository, so it earns real unit coverage.
 * ADR-FE-012 — It is framework-agnostic on purpose, which is what makes these
 * tests fast and browser-free.
 */
import { describe, expect, it, vi } from "vitest";
import { buildGatewayUrl, createGatewayClient, GatewayError } from "../utils/gateway";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("buildGatewayUrl", () => {
  it("builds a same-origin relative URL for the local proxy", () => {
    expect(buildGatewayUrl("/", "v1", "players/player-id/heroes")).toBe(
      "/api/v1/players/player-id/heroes",
    );
  });

  it("builds a versioned route", () => {
    expect(buildGatewayUrl("http://gw.test", "v1", "public/universe")).toBe(
      "http://gw.test/api/v1/public/universe",
    );
  });

  it("tolerates stray slashes on both sides", () => {
    expect(buildGatewayUrl("http://gw.test///", "v1", "///public/status")).toBe(
      "http://gw.test/api/v1/public/status",
    );
  });

  it("appends query parameters", () => {
    expect(
      buildGatewayUrl("http://gw.test", "v1", "public/universe", { page: 2 }),
    ).toBe("http://gw.test/api/v1/public/universe?page=2");
  });

  it("never leaks an undefined parameter into the query string", () => {
    const url = buildGatewayUrl("http://gw.test", "v1", "x", {
      a: undefined,
      b: "kept",
    });
    expect(url).toBe("http://gw.test/api/v1/x?b=kept");
  });
});

describe("createGatewayClient", () => {
  it("sends a correlation id and no Authorization header when anonymous", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const client = createGatewayClient({
      baseUrl: "http://gw.test",
      apiVersion: "v1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      correlationIdFactory: () => "cid-1",
    });

    await client.get("public/status");

    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init.headers["X-Correlation-Id"]).toBe("cid-1");
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("returns undefined for a 204 instead of trying to parse a body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createGatewayClient({
      baseUrl: "http://gw.test",
      apiVersion: "v1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.post("x")).resolves.toBeUndefined();
  });

  it("raises the documented error envelope", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ code: "NOT_FOUND", message: "No such season." }, 404),
      );
    const client = createGatewayClient({
      baseUrl: "http://gw.test",
      apiVersion: "v1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.get("public/seasons/current")).rejects.toMatchObject({
      name: "GatewayError",
      status: 404,
      code: "NOT_FOUND",
      message: "No such season.",
    });
  });

  it("preserves field errors from an ASP.NET validation problem", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          title: "Validation error",
          detail: "One or more validation errors occurred.",
          errors: { name: ["Hero name is required."] },
        },
        422,
      ),
    );
    const client = createGatewayClient({
      baseUrl: "http://gw.test",
      apiVersion: "v1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.post("players/id/heroes")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: { errors: { name: ["Hero name is required."] } },
      status: 422,
    });
  });

  it("falls back to a usable error when the body is not the documented shape", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("<html>502</html>", { status: 502 }));
    const client = createGatewayClient({
      baseUrl: "http://gw.test",
      apiVersion: "v1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.get("x")).rejects.toMatchObject({
      code: "UNEXPECTED_ERROR",
      status: 502,
    });
  });

  it("turns a network failure into an uncertain outcome, not a plain failure", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("failed to fetch"));
    const client = createGatewayClient({
      baseUrl: "http://gw.test",
      apiVersion: "v1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // ADR-FE-008: the client must not assume a write did not happen.
    await expect(client.post("x")).rejects.toSatisfy(
      (error) => error instanceof GatewayError && error.isOutcomeUncertain,
    );
  });
});

describe("GatewayError.isOutcomeUncertain", () => {
  it.each([
    [0, true],
    [408, true],
    [500, true],
    [503, true],
    [400, false],
    [404, false],
    [409, false],
  ])("status %i -> %s", (status, expected) => {
    const error = new GatewayError(status, { code: "X", message: "x" });
    expect(error.isOutcomeUncertain).toBe(expected);
  });
});
