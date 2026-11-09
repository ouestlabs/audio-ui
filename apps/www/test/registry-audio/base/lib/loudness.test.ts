import { describe, expect, test } from "bun:test";
import kWeighting from "@audio/weighting-k";
import {
  createLoudnessReader,
  type LiveLoudness,
  LOUDNESS_TARGETS,
  LOUDNESS_WORKLET,
  loudnessGain,
  measureLoudness,
} from "@/registry-audio/bases/base/lib/loudness";

const RATE = 48_000;

/** A stereo sine at `hz`, its peak at `dbfs`, in passages of `seconds` each. */
function sine(hz: number, passages: [dbfs: number, seconds: number][]) {
  const frames = passages.reduce((sum, [, seconds]) => sum + seconds * RATE, 0);
  const channel = new Float32Array(frames);
  let frame = 0;
  for (const [dbfs, seconds] of passages) {
    const amplitude = 10 ** (dbfs / 20);
    for (const end = frame + seconds * RATE; frame < end; frame += 1) {
      channel[frame] = amplitude * Math.sin((2 * Math.PI * hz * frame) / RATE);
    }
  }
  return [channel, channel.slice()];
}

describe("measureLoudness", () => {
  test("a stereo sine of 1 kHz reads as loud in LUFS as its peak in dBFS (EBU Tech 3341, cases 1 and 2)", () => {
    expect(measureLoudness(sine(1000, [[-23, 20]]), RATE).lufs).toBeCloseTo(
      -23,
      1
    );
    expect(measureLoudness(sine(1000, [[-33, 20]]), RATE).lufs).toBeCloseTo(
      -33,
      1
    );
  });

  test("the gates leave the quiet passages out", () => {
    const loudness = measureLoudness(
      sine(1000, [
        [-72, 10],
        [-36, 10],
        [-23, 60],
        [-36, 10],
        [-72, 10],
      ]),
      RATE
    );
    expect(loudness.lufs).toBeCloseTo(-23, 1);
  });

  test("the true peak reads between the samples", () => {
    // A sine at a quarter of the rate, a quarter turn off its samples: they all land at 0.707 of its peak.
    // It fades in and out over 0.1 s: cut off hard, a waveform rings past its peak at the cut.
    const fade = RATE / 10;
    const channel = Float32Array.from({ length: RATE }, (_, frame) => {
      const edge = Math.min(1, frame / fade, (RATE - 1 - frame) / fade);
      const level = 0.5 * Math.sin((Math.PI / 2) * edge) ** 2;
      return level * Math.sin((Math.PI * frame) / 2 + Math.PI / 4);
    });
    const loudness = measureLoudness([channel], RATE);
    expect(loudness.peak).toBeCloseTo(-9.03, 1);
    expect(loudness.truePeak).toBeCloseTo(-6.02, 1);
  });

  test("silence is -Infinity throughout", () => {
    expect(measureLoudness([new Float32Array(RATE)], RATE)).toEqual({
      lufs: Number.NEGATIVE_INFINITY,
      peak: Number.NEGATIVE_INFINITY,
      truePeak: Number.NEGATIVE_INFINITY,
    });
    expect(measureLoudness([], RATE).lufs).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("loudnessGain", () => {
  test("brings a sound to its target where the peaks allow it", () => {
    expect(
      loudnessGain(
        { lufs: -23, peak: -12, truePeak: -11.5 },
        LOUDNESS_TARGETS.streaming
      )
    ).toBe(9);
  });

  test("stops where the true peak would pass the ceiling", () => {
    expect(loudnessGain({ lufs: -20, peak: -4, truePeak: -3 }, -14)).toBe(2);
    expect(loudnessGain({ lufs: -20, peak: -4, truePeak: -3 }, -14, -2)).toBe(
      1
    );
  });

  test("turns a sound down to its target, and leaves silence alone", () => {
    expect(loudnessGain({ lufs: -8, peak: 0, truePeak: 0.5 }, -14)).toBe(-6);
    expect(
      loudnessGain(
        {
          lufs: Number.NEGATIVE_INFINITY,
          peak: Number.NEGATIVE_INFINITY,
          truePeak: Number.NEGATIVE_INFINITY,
        },
        -14
      )
    ).toBe(0);
  });
});

interface Processor {
  process: (inputs: Float32Array[][]) => boolean;
}

/**
 * The meter's processor, run as the audio thread runs it, 128 frames at a
 * time: what it posts, a block's power each 100 ms.
 */
function blocksOf(channels: Float32Array[], rate = RATE) {
  const posted: number[] = [];
  class AudioWorkletProcessor {
    readonly port = { postMessage: (power: number) => posted.push(power) };
  }
  let Made: (new (options: unknown) => Processor) | undefined;
  const register = (
    _name: string,
    made: new (options: unknown) => Processor
  ) => {
    Made = made;
  };
  new Function("AudioWorkletProcessor", "registerProcessor", LOUDNESS_WORKLET)(
    AudioWorkletProcessor,
    register
  );
  if (!Made) {
    throw new Error("The worklet registered no processor");
  }
  const processor = new Made({
    processorOptions: {
      coefs: kWeighting.coefs(rate),
      frames: Math.round(rate / 10),
    },
  });
  const frames = channels[0]?.length ?? 0;
  for (let frame = 0; frame < frames; frame += 128) {
    processor.process([
      channels.map((channel) => channel.subarray(frame, frame + 128)),
    ]);
  }
  return posted;
}

/** Each reading of a sound, block by block, as a live meter shows it. */
function readings(channels: Float32Array[]) {
  const reader = createLoudnessReader();
  return blocksOf(channels).map((power) => reader.add(power));
}

const last = (all: LiveLoudness[]) => all.at(-1) as LiveLoudness;

describe("createLoudnessReader, over the meter's blocks", () => {
  test("a steady stereo sine of 1 kHz reads as loud as its peak, momentary, short-term and integrated (EBU Tech 3341, cases 1 and 2)", () => {
    for (const dbfs of [-23, -33]) {
      const reading = last(readings(sine(1000, [[dbfs, 20]])));
      expect(reading.momentary).toBeCloseTo(dbfs, 1);
      expect(reading.shortTerm).toBeCloseTo(dbfs, 1);
      expect(reading.integrated).toBeCloseTo(dbfs, 1);
    }
  });

  test("the gates leave the quiet passages out of the integrated loudness (EBU Tech 3341, cases 3 to 5)", () => {
    const cases: [dbfs: number, seconds: number][][] = [
      [
        [-36, 10],
        [-23, 60],
        [-36, 10],
      ],
      [
        [-72, 10],
        [-36, 10],
        [-23, 60],
        [-36, 10],
        [-72, 10],
      ],
      [
        [-26, 20.1],
        [-20, 20.1],
        [-26, 20.1],
      ],
    ];
    for (const passages of cases) {
      expect(last(readings(sine(1000, passages))).integrated).toBeCloseTo(
        -23,
        1
      );
    }
  });

  test("the short-term loudness holds over a sound that repeats every 3 s (EBU Tech 3341, case 9)", () => {
    const period: [dbfs: number, seconds: number][] = [
      [-20, 1.34],
      [-30, 1.66],
    ];
    const all = readings(
      sine(1000, Array.from({ length: 5 }, () => period).flat())
    );
    // From its first 3 s on.
    for (const reading of all.slice(29)) {
      expect(Math.abs(reading.shortTerm + 23)).toBeLessThan(0.1);
    }
  });

  test("reads the integrated loudness of a whole sound as the offline measurement does", () => {
    // Noise in passages from loud to near silence, so both gates have something to leave out.
    let seed = 1;
    const noise = () => {
      seed = (seed * 16_807) % 2_147_483_647;
      return seed / 2_147_483_647 - 0.5;
    };
    const levels = [0.5, 0.02, 0.3, 0.0001, 0.8, 0.05];
    const channels = [0, 1].map(() =>
      Float32Array.from(
        { length: levels.length * 3 * RATE },
        (_, frame) => (levels[Math.floor(frame / (3 * RATE))] ?? 0) * noise()
      )
    );
    expect(last(readings(channels)).integrated).toBeCloseTo(
      measureLoudness(channels, RATE).lufs,
      2
    );
  });

  test("has no momentary loudness before 400 ms, no short-term before 3 s, and silence has none at all", () => {
    const all = readings(sine(1000, [[-23, 3]]));
    expect(all.at(2)?.momentary).toBe(Number.NEGATIVE_INFINITY);
    expect(all.at(3)?.momentary).toBeCloseTo(-23, 1);
    expect(all.at(28)?.shortTerm).toBe(Number.NEGATIVE_INFINITY);
    expect(all.at(29)?.shortTerm).toBeCloseTo(-23, 1);
    expect(last(readings([new Float32Array(5 * RATE)]))).toEqual({
      integrated: Number.NEGATIVE_INFINITY,
      momentary: Number.NEGATIVE_INFINITY,
      shortTerm: Number.NEGATIVE_INFINITY,
    });
  });

  test("clear starts the integrated loudness over and keeps the others", () => {
    const reader = createLoudnessReader();
    const loud = blocksOf(sine(1000, [[-14, 5]]));
    const quiet = blocksOf(sine(1000, [[-30, 5]]));
    for (const power of loud) {
      reader.add(power);
    }
    reader.clear();
    const after = reader.add(quiet[0] as number);
    expect(after.integrated).toBe(Number.NEGATIVE_INFINITY);
    expect(after.shortTerm).toBeGreaterThan(-15);
    let reading = after;
    for (const power of quiet.slice(1)) {
      reading = reader.add(power);
    }
    expect(reading.integrated).toBeCloseTo(-30, 1);
  });
});

describe("the meter's processor", () => {
  test("posts a block each 100 ms, at any rate, the frames of a block across the render quanta", () => {
    expect(blocksOf(sine(1000, [[-23, 2]]))).toHaveLength(20);
    expect(blocksOf([new Float32Array(44_100)], 44_100)).toHaveLength(10);
  });

  test("counts a quantum with no input as silence", () => {
    const posted: number[] = [];
    class AudioWorkletProcessor {
      readonly port = { postMessage: (power: number) => posted.push(power) };
    }
    let processor: Processor | undefined;
    new Function(
      "AudioWorkletProcessor",
      "registerProcessor",
      LOUDNESS_WORKLET
    )(
      AudioWorkletProcessor,
      (_name: string, Made: new (options: unknown) => Processor) => {
        processor = new Made({
          processorOptions: { coefs: kWeighting.coefs(RATE), frames: 4800 },
        });
      }
    );
    for (let quantum = 0; quantum < 75; quantum += 1) {
      processor?.process([[]]);
    }
    expect(posted).toEqual([0, 0]);
  });
});
