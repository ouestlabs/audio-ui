import { describe, expect, test } from "bun:test";
import { $htmlAudio, formatDuration } from "@/registry-audio/bases/base/lib/html-audio";

describe("isLive (pure, no init required)", () => {
  test("0 is not live — duration not yet loaded", () => {
    expect($htmlAudio.isLive(0)).toBe(false);
  });

  test("a finite positive duration is not live", () => {
    expect($htmlAudio.isLive(180)).toBe(false);
  });

  test("NaN is live", () => {
    expect($htmlAudio.isLive(Number.NaN)).toBe(true);
  });

  test("Infinity is live", () => {
    expect($htmlAudio.isLive(Number.POSITIVE_INFINITY)).toBe(true);
  });

  test("-Infinity is live", () => {
    expect($htmlAudio.isLive(Number.NEGATIVE_INFINITY)).toBe(true);
  });
});

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
