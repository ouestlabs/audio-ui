import { beforeAll, describe, expect, test } from "bun:test";
import {
  $htmlAudio,
  formatDuration,
} from "@/registry-audio/bases/base/lib/html-audio";

// $htmlAudio is a module-level singleton wrapping a detached `new Audio()` —
// happy-dom never fires its load lifecycle (no real network/decoder), so
// load()/play() timing is exercised by the Playwright battle-test against
// the real player instead. These tests cover the synchronous state surface,
// which is where a regression could hide undetected by the wiring tests in
// use-audio-provider.test.tsx (those use FakeEngine, not this class).
describe("HtmlAudioEngine (via the $htmlAudio singleton)", () => {
  beforeAll(() => {
    $htmlAudio.init();
  });

  test("init() is idempotent", () => {
    expect(() => {
      $htmlAudio.init();
      $htmlAudio.init();
    }).not.toThrow();
  });

  test("setVolume/getVolume round-trip and clamp to [0,1]", () => {
    $htmlAudio.setVolume({ volume: 0.6 });
    expect($htmlAudio.getVolume()).toBeCloseTo(0.6);

    $htmlAudio.setVolume({ volume: 5 });
    expect($htmlAudio.getVolume()).toBe(1);

    $htmlAudio.setVolume({ volume: -5 });
    expect($htmlAudio.getVolume()).toBe(0);
  });

  test("setMuted/isMuted round-trip", () => {
    $htmlAudio.setMuted(true);
    expect($htmlAudio.isMuted()).toBe(true);

    $htmlAudio.setMuted(false);
    expect($htmlAudio.isMuted()).toBe(false);
  });

  test("setPlaybackRate trusts its caller — no engine-side clamp (ADR-0002)", () => {
    $htmlAudio.setPlaybackRate(1.75);
    expect($htmlAudio.getPlaybackRate()).toBe(1.75);
  });

  // Event forwarding (native <audio> event → engine EventTarget) needs a
  // real dispatch on property mutation, which happy-dom doesn't emulate for
  // media elements — covered by the Playwright battle-test instead.
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
