/**
 * TEMPLATE — ADR-FE-012. Unit tests live inside the feature that owns them, so
 * a squad moves its tests when it moves its feature.
 */
import { describe, expect, it } from "vitest";
import { sortForDisplay } from "../exampleRules";
import type { ExampleResource } from "../types";

const resource = (id: string, label: string): ExampleResource => ({
  id,
  label,
});

describe("sortForDisplay", () => {
  it("orders by label", () => {
    expect(
      sortForDisplay([resource("b", "Beta"), resource("a", "Alpha")]).map((r) => r.id),
    ).toEqual(["a", "b"]);
  });

  it("does not mutate the source array", () => {
    const input = [resource("b", "Beta"), resource("a", "Alpha")];
    sortForDisplay(input);
    expect(input.map((r) => r.id)).toEqual(["b", "a"]);
  });
});
