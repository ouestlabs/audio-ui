import { describe, expect, test } from "bun:test";
import { fadeGain, splitClip } from "../../primitives/timeline/clip.ts";
import { type ArrangedAudio, type PlayedClip, playedClip } from "./clip.ts";
import {
  DECLICK_SECONDS,
  type DecodedRecording,
  type Recording,
  renderClips,
  TrackRenderer,
} from "./render.ts";
import type { PlaybackState } from "./transport.ts";

const RATE = 48_000;
const BLOCK = 128;

/** A recording whose every sample is different, so a frame read from the wrong place shows: a sine sweep with noise. */
function recording(
  seconds: number,
  channels = 2,
  rate = RATE
): DecodedRecording {
  const length = Math.round(seconds * rate);
  let seed = 7;
  const noise = () => {
    seed = (seed * 16_807) % 2_147_483_647;
    return seed / 2_147_483_647 - 0.5;
  };
  return {
    channels: Array.from({ length: channels }, (_entry, channel) =>
      Float32Array.from(
        { length },
        (_, index) =>
          0.5 * Math.sin(index * (0.01 + index * 1e-7) + channel) +
          0.1 * noise()
      )
    ),
    sampleRate: rate,
  };
}

/** An audio clip of the arrangement, in seconds, with no fade. */
function audio(
  start: number,
  length: number,
  rest: Partial<Omit<ArrangedAudio, "value">> & {
    value?: Partial<ArrangedAudio["value"]>;
  } = {}
): ArrangedAudio {
  return {
    sourceLength: rest.sourceLength ?? length,
    ...rest,
    value: { fadeIn: 0, fadeOut: 0, length, offset: 0, start, ...rest.value },
  };
}

/** Plays from `position` (a frame of the arrangement) at the audio clock's frame `at`. */
function playing(
  position: number,
  at = 0,
  loop?: [number, number]
): PlaybackState {
  return { at, loop: loop ?? null, playing: true, position };
}

/** Renders `frames` frames of the audio clock from 0, in blocks, through a TrackRenderer. */
function renderTrack(
  clips: PlayedClip[],
  recordings: Map<string, Recording>,
  states: PlaybackState[],
  frames: number,
  block = BLOCK
) {
  const renderer = new TrackRenderer(RATE, recordings);
  renderer.setClips(clips);
  for (const state of states) {
    renderer.schedule(state);
  }
  const output = [new Float32Array(frames), new Float32Array(frames)];
  for (let frame = 0; frame < frames; frame += block) {
    const count = Math.min(block, frames - frame);
    const left = output[0] as Float32Array;
    const right = output[1] as Float32Array;
    const view = [
      left.subarray(frame, frame + count),
      right.subarray(frame, frame + count),
    ];
    renderer.render(view, frame, count);
  }
  return output as [Float32Array, Float32Array];
}

const one = (rec: Recording) => new Map([["rec", rec]]);

describe("audio clips", () => {
  test("CLP-001: a neutral clip comes out bit-identical to its recording", () => {
    const rec = recording(1);
    const clip = playedClip(
      audio(0.25, 0.5, { sourceLength: 1, value: { offset: 0.1 } }),
      "rec",
      RATE
    );
    const [left, right] = renderTrack([clip], one(rec), [playing(0)], RATE);
    const start = 0.25 * RATE;
    const from = 0.1 * RATE;
    for (let index = 0; index < 0.5 * RATE; index += 1) {
      expect(left[start + index]).toBe(
        rec.channels[0]?.[from + index] as number
      );
      expect(right[start + index]).toBe(
        rec.channels[1]?.[from + index] as number
      );
    }
    expect(left[start - 1]).toBe(0);
    expect(left[start + 0.5 * RATE]).toBe(0);
  });

  test("CLP-002: the gain multiplies every frame by 10^(gain/20)", () => {
    const rec = recording(0.1);
    const clip = playedClip(audio(0, 0.1, { gain: -6 }), "rec", RATE);
    const [left] = renderTrack([clip], one(rec), [playing(0)], 0.1 * RATE);
    const ratio = 10 ** (-6 / 20);
    for (const index of [0, 100, 4000]) {
      expect(left[index]).toBeCloseTo(
        (rec.channels[0]?.[index] as number) * ratio,
        6
      );
    }
  });

  test("CLP-003: a fade-in rises from silence along its shape", () => {
    const rec = recording(0.1);
    for (const shape of ["linear", "fast", "slow", "smooth"] as const) {
      const clip = playedClip(
        audio(0, 0.1, { value: { fadeIn: 0.01, fadeInShape: shape } }),
        "rec",
        RATE
      );
      const [left] = renderTrack([clip], one(rec), [playing(0)], 0.1 * RATE);
      const fade = 0.01 * RATE;
      expect(left[0]).toBe(0);
      for (const index of [1, fade / 4, fade / 2, fade - 1]) {
        expect(left[index]).toBeCloseTo(
          (rec.channels[0]?.[index] as number) * fadeGain(shape, index / fade),
          6
        );
      }
      expect(left[fade]).toBe(rec.channels[0]?.[fade] as number);
    }
  });

  test("CLP-004: a fade-out falls to silence along its shape, played backwards", () => {
    const rec = recording(0.1);
    const clip = playedClip(
      audio(0, 0.1, {
        value: { fadeOut: 0.01, fadeOutShape: "slow" },
      }),
      "rec",
      RATE
    );
    const [left] = renderTrack([clip], one(rec), [playing(0)], 0.1 * RATE);
    const end = 0.1 * RATE;
    const fade = 0.01 * RATE;
    for (const toEnd of [1, fade / 2, fade]) {
      expect(left[end - toEnd]).toBeCloseTo(
        (rec.channels[0]?.[end - toEnd] as number) *
          fadeGain("slow", toEnd / fade),
        6
      );
    }
    expect(left[end - fade - 1]).toBe(
      rec.channels[0]?.[end - fade - 1] as number
    );
  });

  test("CLP-007: a looped clip repeats its loop, each pass right after the last", () => {
    const rec = recording(1);
    // Starts 0.1 s into its recording, loops [0.2, 0.3) for 0.5 s.
    const clip = playedClip(
      audio(0, 0.5, { loop: [0.2, 0.3], value: { offset: 0.1 } }),
      "rec",
      RATE
    );
    const [left] = renderTrack([clip], one(rec), [playing(0)], 0.5 * RATE);
    const source = rec.channels[0] as Float32Array;
    const loopStart = 0.2 * RATE;
    const loopLength = 0.1 * RATE;
    for (let index = 0; index < 0.5 * RATE; index += 1) {
      const own = 0.1 * RATE + index;
      const read =
        own < 0.3 * RATE ? own : loopStart + ((own - loopStart) % loopLength);
      expect(left[index]).toBe(source[read] as number);
    }
  });

  test("CLP-008: a reversed clip plays the mirror of its source", () => {
    const rec = recording(0.5);
    const clip = playedClip(audio(0, 0.5, { reversed: true }), "rec", RATE);
    const [left] = renderTrack([clip], one(rec), [playing(0)], 0.5 * RATE);
    const source = rec.channels[0] as Float32Array;
    const last = 0.5 * RATE - 1;
    for (const index of [0, 1, 1000, last]) {
      expect(left[index]).toBe(source[last - index] as number);
    }
  });

  test("CLP-009: between two warp markers the recording plays at the speed that joins them", () => {
    // One second of recording squeezed into half a second: twice the speed.
    const rec = recording(1);
    const clip = playedClip(
      audio(0, 0.5, {
        sourceLength: 1,
        warp: [
          { source: 0, target: 0 },
          { source: 1, target: 0.5 },
        ],
      }),
      "rec",
      RATE
    );
    const [left] = renderTrack([clip], one(rec), [playing(0)], 0.5 * RATE);
    const source = rec.channels[0] as Float32Array;
    // At twice the speed, frame n reads the recording's frame 2n, exactly on a frame.
    for (const index of [1, 100, 10_000, 20_000]) {
      expect(left[index]).toBeCloseTo(source[2 * index] as number, 6);
    }
  });

  test("CLP-010: a read between two frames goes through the interpolator, a read on a frame is a copy", () => {
    const rate = 4;
    const line: Recording = {
      channels: [Float32Array.from({ length: 64 }, (_, index) => index / 64)],
      sampleRate: rate,
    };
    // Half speed: every other frame falls halfway between two of the recording's.
    const clip = playedClip(
      audio(0, 8, {
        sourceLength: 4,
        warp: [
          { source: 0, target: 0 },
          { source: 4, target: 8 },
        ],
      }),
      "rec",
      rate
    );
    const left = new Float32Array(32);
    renderClips(
      [left, new Float32Array(32)],
      0,
      32,
      0,
      [clip],
      one(line),
      rate
    );
    // A straight line stays straight through the cubic.
    expect(left[3]).toBeCloseTo(1.5 / 64, 6);
    expect(left[4]).toBe(2 / 64);
  });

  test("CLP-012: a mono recording plays at full level in both channels", () => {
    const rec = recording(0.1, 1);
    const clip = playedClip(audio(0, 0.1), "rec", RATE);
    const [left, right] = renderTrack(
      [clip],
      one(rec),
      [playing(0)],
      0.1 * RATE
    );
    expect(left[500]).toBe(rec.channels[0]?.[500] as number);
    expect(right[500]).toBe(rec.channels[0]?.[500] as number);
  });
});

describe("arrangement playback", () => {
  test("ARR-001: a clip starts on the frame nearest its time", () => {
    const rec = recording(0.1);
    // 0.5 s and a third of a frame: the nearest frame is 24000.
    const clip = playedClip(audio(0.5 + 1 / (3 * RATE), 0.01), "rec", RATE);
    const [left] = renderTrack([clip], one(rec), [playing(0)], RATE);
    expect(left[23_999]).toBe(0);
    expect(left[24_000]).toBe(rec.channels[0]?.[0] as number);
  });

  test("ARR-003: a split renders the same frames as the clip it was cut from", () => {
    const rec = recording(2);
    const whole = audio(0.1, 1.3, {
      sourceLength: 2,
      value: { offset: 0.37 },
    });
    const pieces = splitClip(whole.value, 0.1 + 0.6131) ?? [];
    const [leftPiece, rightPiece] = pieces.map((value) =>
      playedClip({ ...whole, value }, "rec", RATE)
    ) as [PlayedClip, PlayedClip];
    const once = renderTrack(
      [playedClip(whole, "rec", RATE)],
      one(rec),
      [playing(0)],
      1.5 * RATE
    );
    const split = renderTrack(
      [leftPiece, rightPiece],
      one(rec),
      [playing(0)],
      1.5 * RATE
    );
    expect(split[0]).toEqual(once[0]);
    expect(split[1]).toEqual(once[1]);
  });

  test("ENG-004: what plays depends on the clock's frames alone, not on how they are cut into blocks", () => {
    const rec = recording(1);
    const clip = playedClip(
      audio(0.01, 0.8, { value: { fadeIn: 0.05, fadeOut: 0.1 } }),
      "rec",
      RATE
    );
    const states = [playing(0, 0, [4800, 30_000])];
    const big = renderTrack([clip], one(rec), states, RATE, 512);
    const odd = renderTrack([clip], one(rec), states, RATE, 77);
    expect(odd[0]).toEqual(big[0]);
  });
});

describe("transport changes", () => {
  const rec = recording(2);
  const clip = playedClip(audio(0, 2), "rec", RATE);
  const declick = Math.round(DECLICK_SECONDS * RATE);

  test("TRN-010: a start from a stop does not fade in", () => {
    const [left] = renderTrack([clip], one(rec), [playing(1000, 480)], 2000);
    expect(left[479]).toBe(0);
    expect(left[480]).toBe(rec.channels[0]?.[1000] as number);
  });

  test("TRN-010: a stop fades the sound out over 2 ms", () => {
    const stop: PlaybackState = {
      at: 1000,
      loop: null,
      playing: false,
      position: 1000,
    };
    const [left] = renderTrack([clip], one(rec), [playing(0), stop], 2000);
    const source = rec.channels[0] as Float32Array;
    expect(left[999]).toBe(source[999] as number);
    expect(left[1000 + declick / 2]).toBeCloseTo(
      (source[1000 + declick / 2] as number) * 0.5,
      6
    );
    expect(left[1000 + declick]).toBe(0);
  });

  test("TRN-010: a jump fades the old place out and the new one in", () => {
    const jump = playing(48_000, 1000);
    const [left] = renderTrack([clip], one(rec), [playing(0), jump], 3000);
    const source = rec.channels[0] as Float32Array;
    const middle = 1000 + declick / 2;
    expect(left[middle]).toBeCloseTo(
      (source[middle] as number) * 0.5 +
        (source[48_000 + declick / 2] as number) * 0.5,
      6
    );
    expect(left[1000 + declick]).toBe(source[48_000 + declick] as number);
  });

  test("TRN-010: the loop's own wrap is not faded", () => {
    const [left] = renderTrack(
      [clip],
      one(rec),
      [playing(0, 0, [0, 1000])],
      2000
    );
    const source = rec.channels[0] as Float32Array;
    expect(left[999]).toBe(source[999] as number);
    expect(left[1000]).toBe(source[0] as number);
    expect(left[1001]).toBe(source[1] as number);
  });

  test("TRN-015: a track that hears of a play late joins it in step", () => {
    const state = playing(0, 256);
    const onTime = renderTrack([clip], one(rec), [state], 2048);
    const renderer = new TrackRenderer(RATE, one(rec));
    renderer.setClips([clip]);
    const lateLeft = new Float32Array(2048);
    const lateRight = new Float32Array(2048);
    for (let frame = 0; frame < 2048; frame += BLOCK) {
      if (frame === 512) {
        // Heard two blocks after the frame it starts at.
        renderer.schedule(state);
      }
      renderer.render(
        [
          lateLeft.subarray(frame, frame + BLOCK),
          lateRight.subarray(frame, frame + BLOCK),
        ],
        frame,
        BLOCK
      );
    }
    expect(lateLeft.slice(512)).toEqual(onTime[0].slice(512));
  });
});

/** A steady sine at `hertz`, in both channels. */
function sine(seconds: number, hertz: number, level = 0.5): DecodedRecording {
  const data = Float32Array.from(
    { length: Math.round(seconds * RATE) },
    (_, index) => level * Math.sin((2 * Math.PI * hertz * index) / RATE)
  );
  return { channels: [data, data], sampleRate: RATE };
}

/** How many times a stretch of samples rises through zero per second: its pitch, for a sine. */
function pitchOf(data: Float32Array, from: number, to: number) {
  let rises = 0;
  for (let index = from + 1; index < to; index += 1) {
    if ((data[index - 1] as number) < 0 && (data[index] as number) >= 0) {
      rises += 1;
    }
  }
  return (rises * RATE) / (to - from);
}

/** The lowest and the highest peak of a stretch, taken over windows of 10 ms. */
function peaksOf(data: Float32Array, from: number, to: number) {
  const size = 480;
  let low = Number.POSITIVE_INFINITY;
  let high = 0;
  for (let start = from; start + size <= to; start += size) {
    let peak = 0;
    for (let index = start; index < start + size; index += 1) {
      peak = Math.max(peak, Math.abs(data[index] as number));
    }
    low = Math.min(low, peak);
    high = Math.max(high, peak);
  }
  return { high, low };
}

/** One second of recording stretched over two: half the speed. */
const twiceAsLong = [
  { source: 0, target: 0 },
  { source: 1, target: 2 },
];

describe("warp modes", () => {
  test("CLP-015: Repitch and no mode play the same, an octave down at half the speed; Beats and Tones keep the pitch", () => {
    const rec = sine(1, 440);
    const render = (warpMode?: ArrangedAudio["warpMode"]) =>
      renderTrack(
        [
          playedClip(
            audio(0, 2, { sourceLength: 1, warp: twiceAsLong, warpMode }),
            "rec",
            RATE
          ),
        ],
        one(rec),
        [playing(0)],
        2 * RATE
      )[0];
    expect(pitchOf(render(), 4800, 91_200)).toBeCloseTo(220, -1);
    expect(render("repitch")).toEqual(render());
    expect(pitchOf(render("beats"), 4800, 91_200)).toBeGreaterThan(400);
    expect(pitchOf(render("beats"), 4800, 91_200)).toBeLessThan(480);
    expect(pitchOf(render("tones"), 4800, 91_200)).toBeCloseTo(440, -1);
  });

  test("CLP-015: a clip with no warp and no transpose is copied as it is in every mode", () => {
    const rec = recording(0.5);
    for (const warpMode of ["beats", "tones"] as const) {
      const [left] = renderTrack(
        [playedClip(audio(0, 0.5, { warpMode }), "rec", RATE)],
        one(rec),
        [playing(0)],
        0.5 * RATE
      );
      expect(left).toEqual(rec.channels[0] as Float32Array);
    }
  });

  test("CLP-016: a slice plays at its own speed from where the warp places it, so an attack keeps its shape", () => {
    // A click every 0.25 s, stretched to twice as long: it comes every 0.5 s, a click and not a smear.
    const data = new Float32Array(RATE);
    for (const at of [0, 12_000, 24_000, 36_000]) {
      data.set([1, -1, 0.5, -0.5], at + 10);
    }
    const [left] = renderTrack(
      [
        playedClip(
          audio(0, 2, {
            sourceLength: 1,
            warp: twiceAsLong,
            warpGrain: 0.125,
            warpMode: "beats",
          }),
          "rec",
          RATE
        ),
      ],
      one({ channels: [data, data], sampleRate: RATE }),
      [playing(0)],
      2 * RATE
    );
    for (const at of [0, 24_000, 48_000, 72_000]) {
      expect(left[at + 10]).toBeCloseTo(1, 3);
      expect(left[at + 11]).toBeCloseTo(-1, 3);
    }
  });

  test("CLP-016: a slice comes out the same from a jump as from playing through", () => {
    const rec = recording(1);
    const clip = playedClip(
      audio(0, 2, {
        sourceLength: 1,
        warp: twiceAsLong,
        warpMode: "beats",
      }),
      "rec",
      RATE
    );
    const whole = renderTrack([clip], one(rec), [playing(0)], 2 * RATE)[0];
    const at = 48_000;
    const jumped = new Float32Array(BLOCK);
    renderClips([jumped], 0, BLOCK, at, [clip], one(rec), RATE);
    expect(jumped).toEqual(whole.slice(at, at + BLOCK));
  });

  test("CLP-017: a held note keeps its level across the grains", () => {
    const rec = sine(1, 440);
    const [left] = renderTrack(
      [
        playedClip(
          audio(0, 2, {
            sourceLength: 1,
            warp: twiceAsLong,
            warpMode: "tones",
          }),
          "rec",
          RATE
        ),
      ],
      one(rec),
      [playing(0)],
      2 * RATE
    );
    const { high, low } = peaksOf(left, 4800, 86_400);
    expect(high).toBeLessThan(0.55);
    expect(low).toBeGreaterThan(0.4);
  });

  test("CLP-017: an export from its start is the same every time", () => {
    const rec = recording(1);
    const render = () =>
      renderTrack(
        [
          playedClip(
            audio(0, 2, {
              sourceLength: 1,
              warp: twiceAsLong,
              warpMode: "tones",
            }),
            "rec",
            RATE
          ),
        ],
        one(rec),
        [playing(0)],
        2 * RATE
      )[0];
    expect(render()).toEqual(render());
  });

  test("CLP-013: in Tones a clip plays its transpose at the speed it has; in Repitch the transpose does nothing", () => {
    const rec = sine(1, 440);
    const render = (warpMode: ArrangedAudio["warpMode"]) =>
      renderTrack(
        [playedClip(audio(0, 0.9, { transpose: 12, warpMode }), "rec", RATE)],
        one(rec),
        [playing(0)],
        0.9 * RATE
      )[0];
    expect(pitchOf(render("tones"), 4800, 38_400)).toBeCloseTo(880, -1);
    expect(pitchOf(render("repitch"), 4800, 38_400)).toBeCloseTo(440, -1);
  });
});
