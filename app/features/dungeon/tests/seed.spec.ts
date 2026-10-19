import { describe, expect, it } from "vitest";
import { formatSeed, missingSeedCharacters, seedError } from "../seed";

describe("formatSeed", () => {
  it.each([
    ["0kx4m2t9qz7pa", "0KX4-M2T9-QZ7PA"],
    ["0KX4-M2T9-QZ7PA", "0KX4-M2T9-QZ7PA"],
    [" 0kx4 m2t9 qz7pa ", "0KX4-M2T9-QZ7PA"],
    ["0KX4", "0KX4"],
    ["0KX4-", "0KX4"],
    ["0KX4M", "0KX4-M"],
    ["oil", "011"],
    ["0KX4UM", "0KX4-M"],
    ["0KX4M2T9QZ7PA99", "0KX4-M2T9-QZ7PA"],
  ])("formats %j as %j", (typed, formatted) => {
    expect(formatSeed(typed)).toBe(formatted);
  });
});

describe("missingSeedCharacters", () => {
  it("counts down to a whole seed", () => {
    expect(missingSeedCharacters("")).toBe(13);
    expect(missingSeedCharacters("0KX4-M")).toBe(8);
    expect(missingSeedCharacters("0KX4-M2T9-QZ7PA")).toBe(0);
  });
});

describe("seedError", () => {
  it("accepts a first character up to F", () => {
    expect(seedError("")).toBeNull();
    expect(seedError("0KX4-M2T9-QZ7PA")).toBeNull();
    expect(seedError("FZZZ-ZZZZ-ZZZZZ")).toBeNull();
  });

  it("rejects a first character that overflows 64 bits", () => {
    expect(seedError("G")).toMatch(/starts with/);
  });
});
