import { describe, expect, test } from "bun:test";
import { formatValue } from "@/registry-audio/bases/base/audio/elements/value-display";

describe("formatValue", () => {
  test("reads each kind as a DAW shows it", () => {
    expect(formatValue(120, "bpm")).toBe("120.00 BPM");
    expect(formatValue(-6, "db")).toBe("-6.0 dB");
    expect(formatValue(Number.NEGATIVE_INFINITY, "db")).toBe("-∞ dB");
    expect(formatValue(440, "hz")).toBe("440 Hz");
    expect(formatValue(1200, "hz")).toBe("1.2 kHz");
    expect(formatValue(0, "pan")).toBe("C");
    expect(formatValue(-0.3, "pan")).toBe("L30");
    expect(formatValue(1, "pan")).toBe("R100");
    expect(formatValue(0.5, "percent")).toBe("50 %");
    expect(formatValue(3, "semitones")).toBe("+3 st");
    expect(formatValue(0, "semitones")).toBe("0 st");
    expect(formatValue(62.345, "time")).toBe("1:02.345");
  });
});
