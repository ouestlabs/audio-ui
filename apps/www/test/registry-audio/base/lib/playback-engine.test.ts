import { describe, expect, test } from "bun:test";
import {
  clampPlaybackRate,
  isLive,
} from "@/registry-audio/bases/base/lib/playback-engine";

describe("isLive", () => {
  test("0 is not live — duration not yet loaded", () => {
    expect(isLive(0)).toBe(false);
  });

  test("a finite positive duration is not live", () => {
    expect(isLive(180)).toBe(false);
  });

  test("NaN is live", () => {
    expect(isLive(Number.NaN)).toBe(true);
  });

  test("Infinity is live", () => {
    expect(isLive(Number.POSITIVE_INFINITY)).toBe(true);
  });

  test("-Infinity is live", () => {
    expect(isLive(Number.NEGATIVE_INFINITY)).toBe(true);
  });
});

describe("clampPlaybackRate", () => {
  test("clamps below the minimum", () => {
    expect(clampPlaybackRate(0)).toBe(0.25);
  });

  test("clamps above the maximum", () => {
    expect(clampPlaybackRate(10)).toBe(2);
  });

  test("passes through an in-range value", () => {
    expect(clampPlaybackRate(1.5)).toBe(1.5);
  });

  test("accepts the exact boundaries", () => {
    expect(clampPlaybackRate(0.25)).toBe(0.25);
    expect(clampPlaybackRate(2)).toBe(2);
  });
});
