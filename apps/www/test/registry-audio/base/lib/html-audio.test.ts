import { describe, expect, test } from "bun:test";
import { formatDuration } from "@/registry-audio/bases/base/lib/html-audio";

describe("formatDuration", () => {
  test("formats whole minutes and seconds", () => {
    expect(formatDuration(65)).toBe("1:05");
  });

  test("pads seconds under 10", () => {
    expect(formatDuration(5)).toBe("0:05");
  });

  test("falls back to 0:00 for negative or non-finite input", () => {
    expect(formatDuration(-5)).toBe("0:00");
    expect(formatDuration(Number.NaN)).toBe("0:00");
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("0:00");
  });
});
