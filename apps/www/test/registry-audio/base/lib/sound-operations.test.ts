import { describe, expect, test } from "bun:test";
import {
  applySoundOperation,
  type SoundOperation,
  soundOperationName,
} from "@/registry-audio/bases/base/lib/sound-operations";

const sound = () => ({
  channels: [new Float32Array([0.1, 0.2, 0.3, 0.4])],
  sampleRate: 4,
});

describe("applySoundOperation", () => {
  test("changes the structure of a sound", () => {
    expect([
      ...(applySoundOperation(sound(), { type: "reverse" }).channels[0] ?? []),
    ]).toEqual([0.4, 0.3, 0.2, 0.1].map(Math.fround));
    expect(
      applySoundOperation(sound(), { times: 3, type: "repeat" }).channels[0]
        ?.length
    ).toBe(12);
    // A second of silence at four frames a second.
    expect(
      applySoundOperation(sound(), { seconds: 1, type: "pad" }).channels[0]
        ?.length
    ).toBe(8);
  });

  test("keeps the rate", () => {
    expect(
      applySoundOperation(sound(), { pan: 0.5, type: "pan" }).sampleRate
    ).toBe(4);
  });
});

describe("soundOperationName", () => {
  test("names each operation as a step of the history", () => {
    const named: [SoundOperation, string][] = [
      [{ type: "reverse" }, "Reverse"],
      [{ times: 2, type: "repeat" }, "Repeat ×2"],
      [{ seconds: 0.5, type: "pad" }, "Add 0.5 s of silence"],
      [{ repair: "hum60", type: "repair" }, "Remove hum, 60 Hz"],
      [
        { factor: 1.5, method: "transient", type: "stretch" },
        "Stretch to 150 %",
      ],
      [{ method: "formant", semitones: -2, type: "shift" }, "Pitch -2 st"],
      [{ method: "auto", semitones: 7, type: "shift" }, "Pitch +7 st"],
      [{ speed: 2, type: "speed" }, "Speed ×2"],
      [{ bits: 16, method: "tpdf", type: "dither" }, "Dither to 16 bits"],
    ];
    for (const [operation, name] of named) {
      expect(soundOperationName(operation)).toBe(name);
    }
  });
});
