import { describe, expect, test } from "bun:test";
import {
  formatRecordingTime,
  pickRecorderMimeType,
  RECORDER_MIME_PREFERENCES,
} from "@/registry-audio/bases/base/lib/recording";

describe("pickRecorderMimeType", () => {
  test("returns the first supported preference, in order", () => {
    // A Chrome-like platform supporting everything gets the best option.
    expect(pickRecorderMimeType(() => true)).toBe("audio/webm;codecs=opus");
  });

  test("falls through to what the platform actually supports (Safari-like)", () => {
    const safari = (type: string) => type === "audio/mp4";
    expect(pickRecorderMimeType(safari)).toBe("audio/mp4");
  });

  test("returns undefined when nothing is supported, deferring to the recorder's own default", () => {
    expect(pickRecorderMimeType(() => false)).toBeUndefined();
  });

  test("honours a caller-supplied preference list", () => {
    expect(pickRecorderMimeType(() => true, ["audio/ogg"])).toBe("audio/ogg");
  });

  test("every default preference is an audio container", () => {
    expect(
      RECORDER_MIME_PREFERENCES.every((type) => type.startsWith("audio/"))
    ).toBe(true);
  });
});

describe("formatRecordingTime", () => {
  test("formats as m:ss with a zero-padded seconds field", () => {
    expect(formatRecordingTime(0)).toBe("0:00");
    expect(formatRecordingTime(5000)).toBe("0:05");
    expect(formatRecordingTime(65_000)).toBe("1:05");
    expect(formatRecordingTime(600_000)).toBe("10:00");
  });

  test("floors partial seconds rather than rounding up", () => {
    expect(formatRecordingTime(1999)).toBe("0:01");
  });

  test("treats negative and non-finite input as zero", () => {
    expect(formatRecordingTime(-1)).toBe("0:00");
    expect(formatRecordingTime(Number.NaN)).toBe("0:00");
    expect(formatRecordingTime(Number.POSITIVE_INFINITY)).toBe("0:00");
  });
});
