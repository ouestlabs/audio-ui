import { describe, expect, test } from "bun:test";
import {
  createFormatter,
  formatChannels,
  formatDuration,
  formatFrequency,
  formatLevel,
  formatNote,
  formatPan,
  formatPercent,
  formatRatio,
  formatSampleRate,
  formatTempo,
  formatTime,
} from "./index.ts";

describe("formatLevel", () => {
  test("a level has one decimal and its unit after a space", () => {
    expect(formatLevel(-6.04, "dBFS")).toBe("-6.0 dBFS");
    expect(formatLevel(-23, "LUFS")).toBe("-23.0 LUFS");
    expect(formatLevel(-1, "dBTP")).toBe("-1.0 dBTP");
  });
  test("a gain or a range carries its sign, a level does not", () => {
    expect(formatLevel(3, "dB")).toBe("+3.0 dB");
    expect(formatLevel(6.2, "LU")).toBe("+6.2 LU");
    expect(formatLevel(-2.1, "dBFS")).toBe("-2.1 dBFS");
    expect(formatLevel(3, "dBFS", { sign: true })).toBe("+3.0 dBFS");
  });
  test("what rounds to zero has no sign", () => {
    expect(formatLevel(-0.02, "dB")).toBe("0.0 dB");
    expect(formatLevel(0.02, "dB")).toBe("0.0 dB");
  });
  test("silence is -∞ and not a number is empty", () => {
    expect(formatLevel(Number.NEGATIVE_INFINITY, "dBFS")).toBe("-∞ dBFS");
    expect(formatLevel(Number.NaN)).toBe("");
  });
  test("options: decimals, a true minus, a locale, no unit", () => {
    expect(formatLevel(-23, "LUFS", { decimals: 2 })).toBe("-23.00 LUFS");
    expect(formatLevel(-23, "LUFS", { minus: "unicode" })).toBe("−23.0 LUFS");
    expect(formatLevel(-23.5, "LUFS", { locale: "fr" })).toBe("-23,5 LUFS");
    expect(formatLevel(-23, "LUFS", { unit: false })).toBe("-23.0");
    expect(formatLevel(-23, "LUFS", { space: " " })).toBe("-23.0 LUFS");
  });
});

describe("formatFrequency", () => {
  test("by size: hertz, kilohertz with a decimal, kilohertz whole", () => {
    expect(formatFrequency(120)).toBe("120 Hz");
    expect(formatFrequency(1200)).toBe("1.2 kHz");
    expect(formatFrequency(12_000)).toBe("12 kHz");
  });
  test("a fixed unit and places", () => {
    expect(formatFrequency(440, "khz")).toBe("0.4 kHz");
    expect(formatFrequency(1000, "hz")).toBe("1000 Hz");
    expect(formatFrequency(1234, "auto", { decimals: 2 })).toBe("1.23 kHz");
  });
  test("a sample rate is in kilohertz with the places it needs", () => {
    expect(formatSampleRate(44_100)).toBe("44.1 kHz");
    expect(formatSampleRate(48_000)).toBe("48 kHz");
    expect(formatSampleRate(11_025)).toBe("11.025 kHz");
  });
});

describe("formatTime", () => {
  test("a clock, to the second or the millisecond", () => {
    expect(formatTime(65.25)).toBe("1:05");
    expect(formatTime(65.25, "precise")).toBe("1:05.250");
    expect(formatTime(0, "precise")).toBe("0:00.000");
  });
  test("hours appear past an hour", () => {
    expect(formatTime(3723.5, "precise")).toBe("1:02:03.500");
    expect(formatTime(3723)).toBe("1:02:03");
  });
  test("seconds as a length, a duration by its size", () => {
    expect(formatTime(65.25, "seconds")).toBe("65.25 s");
    expect(formatDuration(0.12)).toBe("120 ms");
    expect(formatDuration(1.25)).toBe("1.25 s");
    expect(formatDuration(2)).toBe("2 s");
  });
  test("a negative time keeps its sign, and a rounding up carries over", () => {
    expect(formatTime(-5, "precise")).toBe("-0:05.000");
    expect(formatTime(59.9996, "precise")).toBe("1:00.000");
  });
});

describe("music and mix", () => {
  test("a note, from the middle C", () => {
    expect(formatNote(60)).toBe("C4");
    expect(formatNote(61)).toBe("C#4");
    expect(formatNote(61, { accidentals: "flat" })).toBe("Db4");
    expect(formatNote(60, { middleC: 3 })).toBe("C3");
    expect(formatNote(61, { symbols: true })).toBe("C♯4");
    expect(formatNote(69)).toBe("A4");
  });
  test("a pan, the tempo, a ratio, a percentage, the channels", () => {
    expect(formatPan(-0.3)).toBe("L30");
    expect(formatPan(0)).toBe("C");
    expect(formatPan(1)).toBe("R100");
    expect(formatPan(0.3, "signed")).toBe("+30");
    expect(formatTempo(120)).toBe("120 BPM");
    expect(formatTempo(97.5)).toBe("97.5 BPM");
    expect(formatRatio(4)).toBe("4.0:1");
    expect(formatRatio(Number.POSITIVE_INFINITY)).toBe("∞:1");
    expect(formatPercent(0.5)).toBe("50%");
    expect(formatPercent(35, "percent")).toBe("35%");
    expect(formatChannels(2)).toBe("stereo");
    expect(formatChannels(6)).toBe("5.1");
    expect(formatChannels(3)).toBe("3 ch");
  });
});

describe("createFormatter", () => {
  const fr = createFormatter({ locale: "fr", minus: "unicode" });
  test("binds the options of every formatter", () => {
    expect(fr.level(-23, "LUFS")).toBe("−23,0 LUFS");
    expect(fr.frequency(1500)).toBe("1,5 kHz");
    expect(fr.time(1.5, "precise")).toBe("0:01,500");
  });
  test("a call still overrides them", () => {
    expect(fr.level(-23, "LUFS", { locale: "en" })).toBe("−23.0 LUFS");
  });
});
