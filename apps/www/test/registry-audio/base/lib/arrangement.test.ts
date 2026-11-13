import { describe, expect, test } from "bun:test";
import {
  type Arranged,
  type ArrangementTrack,
  automatedParameter,
  automationAt,
  clipFramePositions,
  clipReach,
  clipSegments,
  clipWaveform,
  clipWaveformBands,
  flatAutomation,
  framesToRead,
  hasOutput,
  mixAt,
  panPosition,
  playedNotes,
  sampleBands,
  sampleLine,
  volumeGain,
  volumeValue,
} from "@/registry-audio/bases/base/lib/arrangement";

function clip(
  id: string,
  track: string,
  start: number,
  length: number
): Arranged {
  return {
    id,
    name: id,
    sourceLength: 100,
    track,
    value: { fadeIn: 0, fadeOut: 0, length, offset: 0, start },
  };
}

describe("clipReach", () => {
  const warp = [
    { source: 0, target: 0 },
    { source: 4, target: 8 },
  ];

  test("is the length of the source for a clip that plays it once", () => {
    const once = { ...clip("a", "drums", 0, 10), sourceLength: 24 };
    expect(clipReach(once)).toBe(24);
  });

  test("has no end for a clip that loops, warped or not", () => {
    const looped = {
      ...clip("a", "drums", 0, 10),
      loop: [0, 4] as const,
      sourceLength: 4,
    };
    expect(clipReach(looped)).toBeUndefined();
    expect(clipReach({ ...looped, warp })).toBeUndefined();
  });

  test("is as far as its warp stretches the source for a warped clip", () => {
    // Played at half speed: four seconds of source last eight on the clip.
    const warped = { ...clip("a", "drums", 0, 10), sourceLength: 4, warp };
    expect(clipReach(warped)).toBe(8);
  });
});

describe("playedNotes", () => {
  const midi = (overrides: Partial<Arranged> = {}): Arranged => ({
    id: "m",
    name: "Bass",
    notes: [
      { id: "a", length: 1, pitch: 40, start: 0 },
      { id: "b", length: 3, pitch: 43, start: 2 },
    ],
    sourceLength: 4,
    track: "bass",
    value: { fadeIn: 0, fadeOut: 0, length: 4, offset: 0, start: 10 },
    ...overrides,
  });

  test("places the notes where the clip plays them, cut at its end", () => {
    const notes = playedNotes(
      midi({
        value: { fadeIn: 0, fadeOut: 0, length: 3, offset: 0, start: 10 },
      })
    );
    expect(notes.map((note) => [note.start, note.length, note.pitch])).toEqual([
      [10, 1, 40],
      [12, 1, 43],
    ]);
  });

  test("starts from the clip's offset, and transposes with it", () => {
    const notes = playedNotes(
      midi({
        transpose: 12,
        value: { fadeIn: 0, fadeOut: 0, length: 3, offset: 1, start: 10 },
      })
    );
    expect(notes.map((note) => [note.start, note.pitch])).toEqual([[11, 55]]);
  });

  test("plays its loop again and again, each time a note of its own", () => {
    const notes = playedNotes(
      midi({
        loop: [0, 4],
        value: { fadeIn: 0, fadeOut: 0, length: 12, offset: 0, start: 0 },
      })
    );
    expect(notes.map((note) => note.start)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(new Set(notes.map((note) => note.id)).size).toBe(6);
    expect(notes.map((note) => note.sourceId)).toEqual([
      "a",
      "b",
      "a",
      "b",
      "a",
      "b",
    ]);
  });
});

describe("automation", () => {
  test("reads an envelope along its segments and their curves", () => {
    const points = [
      { x: 0, y: 0 },
      { curve: 0.5, x: 0.5, y: 1 },
      { x: 1, y: 0 },
    ];
    expect(automationAt(points, 0.25)).toBeCloseTo(0.5, 5);
    expect(automationAt(points, 0.5)).toBe(1);
    // A positive curve holds the start of its segment.
    expect(automationAt(points, 0.75)).toBeGreaterThan(0.5);
    expect(automationAt(points, -1)).toBe(0);
    expect(automationAt(points, 2)).toBe(0);
    expect(automationAt(flatAutomation(0.3), 0.6)).toBe(0.3);
  });

  test("maps volume to a gain and back, and pan to the stereo field", () => {
    expect(volumeGain(0)).toBe(0);
    expect(volumeGain(volumeValue(1))).toBeCloseTo(1, 6);
    expect(volumeGain(1)).toBeCloseTo(10 ** (6 / 20), 6);
    expect(volumeValue(0)).toBe(0);
    expect(panPosition(0.5)).toBe(0);
    expect(panPosition(0)).toBe(-1);
  });

  test("a track plays its envelopes, and its mix where it has none or is overridden", () => {
    const mix = { color: 0, gain: 0.5, muted: false, pan: 0.25, soloed: false };
    const track = {
      automation: { volume: flatAutomation(0) },
      color: 0,
      id: "keys",
      name: "Keys",
    };
    expect(mixAt(track, mix, 0.5)).toEqual({ gain: 0, pan: 0.25 });
    expect(mixAt(track, mix, 0.5, ["volume"])).toEqual({
      gain: 0.5,
      pan: 0.25,
    });
  });
});

describe("clipWaveform", () => {
  // A source of 4 seconds whose peaks rise: peak n is n / 7.
  const peaks = Array.from({ length: 8 }, (_, index) => index / 7);
  const audio = (patch: Partial<Arranged> = {}): Arranged => ({
    id: "a",
    name: "a",
    sourceLength: 4,
    track: "t",
    ...patch,
    value: {
      fadeIn: 0,
      fadeOut: 0,
      length: 2,
      offset: 1,
      start: 0,
      ...patch.value,
    },
  });

  test("CLP-020: reads only the stretch of the clip it is asked for, a view's worth", () => {
    // From 1 s of the source: the first second of the clip is peaks 2 to 3 and 4.
    expect(clipWaveform(audio(), peaks, 1, [0, 1])).toEqual([4 / 7]);
    expect(clipWaveform(audio(), peaks, 1, [1, 2])).toEqual([6 / 7]);
  });

  test("CLP-020: a column covering thousands of peaks finds the one loud one among them", () => {
    const long = new Float32Array(100_000);
    long[73_421] = 1;
    const whole = audio({
      value: { fadeIn: 0, fadeOut: 0, length: 4, offset: 0, start: 0 },
    });
    const columns = clipWaveform(whole, long, 100);
    expect(columns.filter((level) => level === 1)).toHaveLength(1);
    expect(columns[73]).toBe(1);
  });

  test("CLP-020: the highest and the lowest of each column, as lopsided as the sound", () => {
    const max = new Float32Array(100_000);
    const min = new Float32Array(100_000);
    max[10_000] = 0.25;
    min[10_000] = -1;
    max[90_000] = 1;
    min[90_000] = -0.5;
    const whole = audio({
      value: { fadeIn: 0, fadeOut: 0, length: 4, offset: 0, start: 0 },
    });
    const bands = clipWaveformBands(whole, { max, min }, 100);
    expect([bands.max[10], bands.min[10]]).toEqual([0.25, -1]);
    expect([bands.max[90], bands.min[90]]).toEqual([1, -0.5]);
    expect([bands.max[50], bands.min[50]]).toEqual([0, 0]);
    // Amplitudes reach as far down as up.
    const level = clipWaveformBands(whole, max, 100);
    expect([level.max[90], level.min[90]]).toEqual([1, -1]);
  });

  test("CLP-020: closer than its peaks, a column takes the level between the two around it: slopes, not steps", () => {
    // Half a peak per column, from peak 2: each column's middle lies a quarter of a peak further.
    const columns = clipWaveform(audio(), peaks, 8);
    for (const [column, level] of columns.entries()) {
      expect(level).toBeCloseTo((1.75 + 0.5 * column) / 7, 10);
    }
    const bands = clipWaveformBands(audio(), { max: peaks, min: peaks }, 8);
    expect(bands.max[3]).toBeCloseTo(3.25 / 7, 10);
  });

  test("shows the stretch of the source the clip plays", () => {
    // From 1 s to 3 s of the source: peaks 2 to 5, two columns each half.
    expect(clipWaveform(audio(), peaks, 2)).toEqual([4 / 7, 6 / 7]);
  });

  test("a reversed clip shows its source mirrored", () => {
    expect(clipWaveform(audio({ reversed: true }), peaks, 2)).toEqual([
      6 / 7,
      4 / 7,
    ]);
  });

  test("a looped clip shows its loop again", () => {
    const looped = audio({
      loop: [1, 2],
      value: { fadeIn: 0, fadeOut: 0, length: 3, offset: 1, start: 0 },
    });
    const columns = clipWaveform(looped, peaks, 3);
    expect(columns[0]).toBe(columns[1]);
    expect(columns[1]).toBe(columns[2]);
  });

  test("a warped clip shows its source stretched: twice as fast, twice as much of it", () => {
    const fast = audio({
      warp: [
        { source: 0, target: 0 },
        { source: 4, target: 2 },
      ],
      value: { fadeIn: 0, fadeOut: 0, length: 2, offset: 0, start: 0 },
    });
    expect(clipWaveform(fast, peaks, 2)).toEqual([4 / 7, 1]);
  });

  test("no peaks, no waveform", () => {
    expect(clipWaveform(audio(), [], 3)).toEqual([0, 0, 0]);
  });
});

describe("a track's output", () => {
  const midi: ArrangementTrack = {
    color: 0,
    devices: [{ device: "synth", id: "d", instrument: true, state: {} }],
    id: "t",
    kind: "midi",
    name: "Keys",
  };
  const audio: ArrangementTrack = { color: 0, id: "a", name: "Audio" };

  test("MIX-024: a MIDI track has one with an instrument, and none without", () => {
    expect(hasOutput(midi)).toBe(true);
    expect(hasOutput(audio)).toBe(true);
    expect(hasOutput({ ...midi, devices: [] })).toBe(false);
    expect(hasOutput({ ...midi, devices: undefined })).toBe(false);
  });

  test("MIX-024: its lane shows a device parameter, or nothing, never a volume it lacks", () => {
    const bare = { ...midi, devices: [] };
    const key = "device:d:cutoff" as const;
    expect(automatedParameter(midi, "volume")).toBe("volume");
    expect(automatedParameter(bare, "volume", [{ key }])).toBe(key);
    expect(automatedParameter(bare, "pan", [{ key }])).toBe(key);
    expect(automatedParameter(bare, key, [{ key }])).toBe(key);
    expect(automatedParameter(bare, "volume")).toBeNull();
  });
});

describe("CLP-024: a clip waveform from its samples", () => {
  /** A 1 s source of 100 frames, read whole by a 1 s clip. */
  const reading = {
    sourceLength: 1,
    value: { length: 1, offset: 0 },
  };

  test("each column edge reads its frame of the source, as a player does", () => {
    expect(clipFramePositions(reading, 100, 4)).toEqual([0, 25, 50, 75, 100]);
    // A stretch of the clip: its second half.
    expect(clipFramePositions(reading, 100, 2, [0.5, 1])).toEqual([
      50, 75, 100,
    ]);
    // Reversed, the clip reads the source from its end.
    expect(clipFramePositions({ ...reading, reversed: true }, 100, 2)).toEqual([
      100, 50, 0,
    ]);
    expect(clipFramePositions(reading, 0, 4)).toEqual([]);
  });

  test("reads the frames the columns touch, within the source", () => {
    expect(framesToRead([10.5, 12.25, 14], 100)).toEqual([10, 15]);
    expect(framesToRead([98.5, 99.9], 100)).toEqual([98, 100]);
    expect(framesToRead([100, 50, 0], 100)).toEqual([0, 100]);
  });

  test("a column wider than a frame spans its lowest and highest sample", () => {
    const values = [0, 0.5, -0.25, 1, -1, 0.25];
    // Two columns of three frames each, read from frame 0.
    expect(sampleBands([0, 3, 6], values, 0)).toEqual({
      max: [1, 1],
      min: [-0.25, -1],
    });
  });

  test("a column narrower than a frame takes the sound where it lies", () => {
    // Frames 10 and 11 hold 0 and 1: a quarter of the way, the sound is at 0.25.
    const { max, min } = sampleBands([10.25, 10.5], [0, 1], 10);
    expect(max[0]).toBeCloseTo(0.5, 5);
    expect(min[0]).toBeCloseTo(0.25, 5);
  });

  test("past a frame per column, a line through the samples with each sample at its column", () => {
    // Four columns over two frames: a sample every two columns.
    const { levels, samples } = sampleLine([0, 0.5, 1, 1.5, 2], [0, 1, 0], 0);
    expect(levels).toEqual([0, 0.5, 1, 0.5, 0]);
    expect(samples).toEqual([
      [0, 0],
      [2, 1],
    ]);
  });

  test("a line read backwards, for a reversed clip, still places each sample", () => {
    const { samples } = sampleLine([2, 1.5, 1, 0.5, 0], [0, 1, 0], 0);
    expect(samples).toEqual([
      [0, 0],
      [2, 1],
    ]);
  });
});

describe("clipSegments", () => {
  const reading = (extra: Record<string, unknown> = {}) =>
    ({
      sourceLength: 10,
      value: { length: 4, offset: 1 },
      ...extra,
    }) as Parameters<typeof clipSegments>[0];

  test("a clip that plays on is one stretch from its offset", () => {
    const found = clipSegments(reading(), 1000, [0, 4]);
    expect(found).toHaveLength(1);
    expect(found[0]?.frames[0]).toBeCloseTo(100, 3);
    expect(found[0]?.frames[1]).toBeCloseTo(500, 3);
  });

  test("a loop gives a stretch for each turn, each ending at the loop's end", () => {
    // Loop 1 s to 3 s, the clip reading from 1 s: turns at 2 s, 4 s.
    const looped = reading({ loop: [1, 3] });
    const found = clipSegments(looped, 1000, [0, 5]);
    expect(found.map((one) => [one.from, one.to])).toEqual([
      [0, 2],
      [2, 4],
      [4, 5],
    ]);
    // 100 frames a second: every full turn reads the loop's frames, 1 s to 3 s.
    expect(found[1]?.frames[0]).toBeCloseTo(100, 3);
    expect(found[1]?.frames[1]).toBeCloseTo(300, 3);
  });

  test("warp markers cut the clip where the speed changes", () => {
    // Source 0-4 s plays on the clip 0-4 s, then 4-6 s of source squeezed into 4-5 s of clip.
    const warped = reading({
      sourceLength: 6,
      value: { length: 5, offset: 0 },
      warp: [
        { source: 0, target: 0 },
        { source: 4, target: 4 },
        { source: 6, target: 5 },
      ],
    });
    const found = clipSegments(warped, 600, [0, 5]);
    expect(found.map((one) => [one.from, one.to])).toEqual([
      [0, 4],
      [4, 5],
    ]);
    expect(found[1]?.frames[0]).toBeCloseTo(400, 3);
    expect(found[1]?.frames[1]).toBeCloseTo(600, 3);
  });

  test("a reversed clip reads its stretches backwards", () => {
    const [one] = clipSegments(reading({ reversed: true }), 1000, [0, 4]);
    expect(one?.frames[1]).toBeLessThan(one?.frames[0] ?? 0);
  });

  test("nothing to read gives nothing", () => {
    expect(clipSegments(reading(), 0, [0, 4])).toEqual([]);
    expect(clipSegments(reading(), 1000, [2, 2])).toEqual([]);
  });
});
