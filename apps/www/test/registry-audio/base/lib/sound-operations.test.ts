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

describe("applySoundOperation on a stretch", () => {
  // Ten frames a second, so SEAM rounds to no crossfade and the frames read as they are.
  const ramp = () => ({
    channels: [Float32Array.from({ length: 10 }, (_, index) => index)],
    sampleRate: 10,
  });
  const frames = (sound: { channels: Float32Array[] }) =>
    Array.from(sound.channels[0] ?? []);

  test("Delete takes the stretch out and closes the gap", () => {
    expect(
      frames(applySoundOperation(ramp(), { type: "delete" }, [0.2, 0.5]))
    ).toEqual([0, 1, 5, 6, 7, 8, 9]);
  });

  test("Crop keeps the stretch alone", () => {
    expect(
      frames(applySoundOperation(ramp(), { type: "crop" }, [0.2, 0.5]))
    ).toEqual([2, 3, 4]);
  });

  test("Paste puts its channels in the stretch's place, or inserts them at a point", () => {
    const paste = {
      channels: [Float32Array.from([-1, -1])],
      type: "paste",
    } as const;
    expect(frames(applySoundOperation(ramp(), paste, [0.2, 0.5]))).toEqual([
      0, 1, -1, -1, 5, 6, 7, 8, 9,
    ]);
    expect(frames(applySoundOperation(ramp(), paste, [0.3, 0.3]))).toEqual([
      0, 1, 2, -1, -1, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  test("an operation on a stretch leaves the rest as it was", () => {
    expect(
      frames(applySoundOperation(ramp(), { type: "reverse" }, [0.2, 0.5]))
    ).toEqual([0, 1, 4, 3, 2, 5, 6, 7, 8, 9]);
    expect(
      frames(
        applySoundOperation(ramp(), { times: 2, type: "repeat" }, [0, 0.2])
      )
    ).toEqual([0, 1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test("a gain on a stretch crossfades into it and out of it: no step at either seam", () => {
    const steady = {
      channels: [new Float32Array(48_000).fill(0.5)],
      sampleRate: 48_000,
    };
    const louder = frames(
      applySoundOperation(steady, { db: 6, type: "gain" }, [0.25, 0.75])
    );
    const steps = louder
      .slice(1)
      .map((sample, index) => Math.abs(sample - (louder[index] ?? 0)));
    // A sudden jump of 6 dB would be about 0.5 between two frames.
    expect(Math.max(...steps)).toBeLessThan(0.01);
    expect(louder[24_000]).toBeCloseTo(0.5 * 10 ** (6 / 20), 3);
    expect(louder[0]).toBe(0.5);
  });
});

describe("a stretch shaped on its frame", () => {
  test("fades in and out along its curves and takes its level", () => {
    const steady = {
      channels: [new Float32Array(100).fill(1)],
      sampleRate: 100,
    };
    const shaped = Array.from(
      applySoundOperation(steady, {
        fadeIn: 0.1,
        fadeInShape: "linear",
        fadeOut: 0.1,
        fadeOutShape: "linear",
        gain: -6,
        type: "shape",
      }).channels[0] ?? []
    );
    const level = 10 ** (-6 / 20);
    expect(shaped[0]).toBe(0);
    expect(shaped[5]).toBeCloseTo(0.5 * level, 3);
    expect(shaped[50]).toBeCloseTo(level, 3);
    expect(shaped[99]).toBeCloseTo(0.1 * level, 3);
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
      [{ type: "delete" }, "Delete"],
      [{ type: "crop" }, "Crop"],
      [{ channels: [], type: "paste" }, "Paste"],
      [{ db: 3, type: "gain" }, "Louder"],
      [{ db: -3, type: "gain" }, "Quieter"],
      [
        {
          fadeIn: 0.5,
          fadeInShape: "linear",
          fadeOut: 0,
          fadeOutShape: "linear",
          gain: 0,
          type: "shape",
        },
        "Fade",
      ],
    ];
    for (const [operation, name] of named) {
      expect(soundOperationName(operation)).toBe(name);
    }
  });
});
