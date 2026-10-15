import { describe, expect, test } from "bun:test";
import { encodeMidiFile, MidiFileError, parseMidiFile } from "./file.ts";

const text = (id: string) => [...id].map((char) => char.charCodeAt(0));
const u16 = (value: number) => [(value >> 8) & 0xff, value & 0xff];
const u32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];
const header = (
  format: number,
  tracks: number,
  division: number,
  extra: number[] = []
) => [
  ...text("MThd"),
  ...u32(6 + extra.length),
  ...u16(format),
  ...u16(tracks),
  ...u16(division),
  ...extra,
];
const track = (...events: number[]) => trackOf(events);
/** A track chunk from an array: no spread, so a file of any size is built. */
const trackOf = (events: number[]) => [
  ...text("MTrk"),
  ...u32(events.length),
  ...events,
];
const END = [0, 0xff, 0x2f, 0];
const file = (...parts: number[][]) => {
  const out: number[] = [];
  for (const part of parts) {
    for (const byte of part) {
      out.push(byte);
    }
  }
  return new Uint8Array(out);
};

describe("parseMidiFile", () => {
  test("reads a note's start, length, channel and velocity", () => {
    const parsed = parseMidiFile(
      file(header(0, 1, 96), track(0, 0x91, 60, 100, 96, 0x81, 60, 0, ...END))
    );
    expect(parsed.format).toBe(0);
    expect(parsed.ticksPerQuarterNote).toBe(96);
    expect(parsed.notes).toEqual([
      {
        channel: 1,
        durationTicks: 96,
        note: 60,
        startTick: 0,
        track: 0,
        velocity: 100 / 127,
      },
    ]);
  });

  test("takes a note on with velocity 0 for a note off", () => {
    const parsed = parseMidiFile(
      file(header(0, 1, 96), track(0, 0x90, 60, 90, 48, 0x90, 60, 0, ...END))
    );
    expect(parsed.notes[0]?.durationTicks).toBe(48);
  });

  test("reuses the running status of the previous event", () => {
    // 90 3C 40, then 0x3E 0x40 and 0x3C 0x00 with no status byte.
    const parsed = parseMidiFile(
      file(
        header(0, 1, 96),
        track(0, 0x90, 60, 64, 0, 62, 64, 48, 60, 0, 0, 62, 0, ...END)
      )
    );
    expect(
      parsed.notes.map((note) => [
        note.note,
        note.startTick,
        note.durationTicks,
      ])
    ).toEqual([
      [60, 0, 48],
      [62, 0, 48],
    ]);
  });

  test("cancels the running status at a meta event", () => {
    // After the meta event a bare data byte has no status to use.
    expect(() =>
      parseMidiFile(
        file(
          header(0, 1, 96),
          track(0, 0x90, 60, 64, 0, 0xff, 0x01, 1, 0x41, 0, 60, 0, ...END)
        )
      )
    ).toThrow(MidiFileError);
  });

  test("cancels the running status at a sysex event", () => {
    expect(() =>
      parseMidiFile(
        file(
          header(0, 1, 96),
          track(0, 0x90, 60, 64, 0, 0xf0, 2, 0x7e, 0xf7, 0, 60, 0, ...END)
        )
      )
    ).toThrow(MidiFileError);
  });

  test("keeps a note struck again before its release as a second note", () => {
    const parsed = parseMidiFile(
      file(
        header(0, 1, 96),
        track(
          0,
          0x90,
          60,
          64,
          10,
          0x90,
          60,
          64,
          10,
          0x80,
          60,
          0,
          10,
          0x80,
          60,
          0,
          ...END
        )
      )
    );
    expect(
      parsed.notes.map((note) => [note.startTick, note.durationTicks])
    ).toEqual([
      [0, 20],
      [10, 20],
    ]);
  });

  test("ends a note never released with its track", () => {
    const parsed = parseMidiFile(
      file(header(0, 1, 96), track(0, 0x90, 60, 64, 100, 0xff, 0x2f, 0))
    );
    expect(parsed.notes).toMatchObject([{ durationTicks: 100, startTick: 0 }]);
  });

  test("gives a note off on its note on's tick one tick", () => {
    const parsed = parseMidiFile(
      file(header(0, 1, 96), track(0, 0x90, 60, 64, 0, 0x80, 60, 0, ...END))
    );
    expect(parsed.notes[0]?.durationTicks).toBe(1);
  });

  test("defaults the tempo to 120 BPM, and reads every Set Tempo", () => {
    expect(
      parseMidiFile(file(header(0, 1, 96), track(...END)))
        .microsecondsPerQuarterNote
    ).toBe(500_000);
    const parsed = parseMidiFile(
      file(
        header(0, 1, 96),
        track(
          0,
          0xff,
          0x51,
          3,
          0x07,
          0xa1,
          0x20,
          96,
          0xff,
          0x51,
          3,
          0x0f,
          0x42,
          0x40,
          ...END
        )
      )
    );
    expect(parsed.tempos).toEqual([
      { microsecondsPerQuarterNote: 500_000, tick: 0 },
      { microsecondsPerQuarterNote: 1_000_000, tick: 96 },
    ]);
    expect(parsed.microsecondsPerQuarterNote).toBe(500_000);
  });

  test("reads time signatures", () => {
    const parsed = parseMidiFile(
      file(
        header(0, 1, 96),
        track(0, 0xff, 0x58, 4, 6, 3, 24, 8, 0, 0xff, 0x2f, 0)
      )
    );
    // 6 over 2^3: six eighths.
    expect(parsed.timeSignatures).toEqual([
      { denominator: 8, numerator: 6, tick: 0 },
    ]);
  });

  test("merges the tracks of a format 1 file, keeping each note's track", () => {
    const parsed = parseMidiFile(
      file(
        header(1, 3, 96),
        track(0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20, ...END),
        track(20, 0x90, 64, 64, 10, 0x80, 64, 0, ...END),
        track(0, 0x90, 60, 64, 10, 0x80, 60, 0, ...END)
      )
    );
    expect(parsed.notes.map((note) => [note.note, note.track])).toEqual([
      [60, 2],
      [64, 1],
    ]);
  });

  test("skips chunks it does not know, and bytes after End of Track", () => {
    const parsed = parseMidiFile(
      file(
        header(1, 3, 96),
        [...text("XFIH"), ...u32(3), 1, 2, 3],
        track(0, 0x90, 60, 64, 10, 0x80, 60, 0, ...END, 0xde, 0xad),
        track(0, 0x90, 62, 64, 10, 0x80, 62, 0, ...END)
      )
    );
    expect(parsed.notes.map((note) => note.note)).toEqual([60, 62]);
  });

  test("skips what a longer header adds", () => {
    const parsed = parseMidiFile(
      file(
        header(0, 1, 96, [9, 9, 9, 9]),
        track(0, 0x90, 60, 64, 5, 0x80, 60, 0, ...END)
      )
    );
    expect(parsed.notes).toHaveLength(1);
  });

  test("reads a file given as an ArrayBuffer or a view", () => {
    const bytes = file(
      header(0, 1, 96),
      track(0, 0x90, 60, 64, 5, 0x80, 60, 0, ...END)
    );
    expect(parseMidiFile(bytes.buffer as ArrayBuffer).notes).toHaveLength(1);
    expect(parseMidiFile(bytes).notes).toHaveLength(1);
  });

  test("names what is wrong with a file it cannot read", () => {
    const wrong = (bytes: Uint8Array, message: string) =>
      expect(() => parseMidiFile(bytes)).toThrow(message);
    wrong(new Uint8Array(0), "Not a Standard MIDI File");
    wrong(
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]),
      "Not a Standard MIDI File"
    );
    wrong(file(header(0, 1, 0x80_00 | (25 << 8) | 40), track(...END)), "SMPTE");
    wrong(file(header(0, 1, 0), track(...END)), "ticks per quarter note");
    wrong(file(header(0, 1, 96), track(0, 0x90, 60)), "ends in the middle");
    wrong(
      file(header(0, 1, 96), track(0, 0xf1, 0, ...END)),
      "not valid in a file"
    );
    wrong(file(header(0, 1, 96), track(0, 0x90, 200, 64, ...END)), "over 127");
    wrong(
      file(header(0, 1, 96), track(0x80, 0x80, 0x80, 0x80, 0x00, 0x90, 60, 64)),
      "four bytes"
    );
    // A track chunk that claims more bytes than the file has.
    wrong(
      new Uint8Array([
        ...header(0, 1, 96),
        ...text("MTrk"),
        ...u32(500),
        0,
        0xff,
      ]),
      "ends in the middle"
    );
  });

  test("reads a file of 150,000 notes without overflowing the stack", () => {
    const events: number[] = [];
    for (let index = 0; index < 150_000; index += 1) {
      events.push(0, 0x90, index % 128, 64, 1, 0x80, index % 128, 0);
    }
    events.push(...END);
    const parsed = parseMidiFile(file(header(0, 1, 480), trackOf(events)));
    expect(parsed.notes).toHaveLength(150_000);
  });
});

describe("encodeMidiFile", () => {
  const options = { bpm: 120, notes: [] };
  const encodeAt = (tick: number) =>
    encodeMidiFile({
      ...options,
      notes: [
        {
          channel: 0,
          durationTicks: 1,
          note: 60,
          startTick: tick,
          velocity: 1,
        },
      ],
    });
  /** The delta time of the first note: the bytes after the header, the chunk header and the Set Tempo. */
  const deltaBytes = (bytes: Uint8Array) => {
    const out: number[] = [];
    for (let index = 29; ; index += 1) {
      const byte = bytes[index] ?? 0;
      out.push(byte);
      if (!(byte & 0x80)) {
        return out;
      }
    }
  };

  test("writes the delta times the spec's table gives", () => {
    const table: [number, number[]][] = [
      [0x00, [0x00]],
      [0x40, [0x40]],
      [0x7f, [0x7f]],
      [0x80, [0x81, 0x00]],
      [0x20_00, [0xc0, 0x00]],
      [0x3f_ff, [0xff, 0x7f]],
      [0x40_00, [0x81, 0x80, 0x00]],
      [0x10_00_00, [0xc0, 0x80, 0x00]],
      [0x1f_ff_ff, [0xff, 0xff, 0x7f]],
      [0x20_00_00, [0x81, 0x80, 0x80, 0x00]],
      [0x08_00_00_00, [0xc0, 0x80, 0x80, 0x00]],
      [0x0f_ff_ff_ff - 1, [0xff, 0xff, 0xff, 0x7e]],
    ];
    for (const [ticks, expected] of table) {
      expect(deltaBytes(encodeAt(ticks))).toEqual(expected);
    }
  });

  test("writes a format 0 file with one track, the tempo and the end of track", () => {
    const bytes = encodeMidiFile({
      bpm: 120,
      notes: [],
      ticksPerQuarterNote: 96,
    });
    expect([...bytes.slice(0, 14)]).toEqual(header(0, 1, 96));
    const parsed = parseMidiFile(bytes);
    expect(parsed.microsecondsPerQuarterNote).toBe(500_000);
    expect(bytes.slice(-4)).toEqual(new Uint8Array([0, 0xff, 0x2f, 0]));
  });

  test("round-trips notes", () => {
    const notes = [
      {
        channel: 0,
        durationTicks: 480,
        note: 60,
        startTick: 0,
        velocity: 100 / 127,
      },
      { channel: 9, durationTicks: 240, note: 36, startTick: 480, velocity: 1 },
      {
        channel: 0,
        durationTicks: 120,
        note: 127,
        startTick: 480,
        velocity: 1 / 127,
      },
    ];
    const parsed = parseMidiFile(encodeMidiFile({ bpm: 93, notes }));
    const plain = parsed.notes.map(
      ({ channel, durationTicks, note, startTick, velocity }) => ({
        channel,
        durationTicks,
        note,
        startTick,
        velocity,
      })
    );
    expect(plain).toEqual(
      [...notes].sort(
        (a, b) =>
          a.startTick - b.startTick || a.channel - b.channel || a.note - b.note
      )
    );
    expect(60_000_000 / parsed.microsecondsPerQuarterNote).toBeCloseTo(93, 2);
  });

  test("does not cut a note that ends where the next begins", () => {
    const parsed = parseMidiFile(
      encodeMidiFile({
        bpm: 120,
        notes: [
          {
            channel: 0,
            durationTicks: 100,
            note: 60,
            startTick: 0,
            velocity: 0.5,
          },
          {
            channel: 0,
            durationTicks: 100,
            note: 60,
            startTick: 100,
            velocity: 0.5,
          },
        ],
      })
    );
    expect(parsed.notes.map((note) => note.durationTicks)).toEqual([100, 100]);
  });

  test("never writes a velocity of 0, which would be a note off", () => {
    const parsed = parseMidiFile(
      encodeMidiFile({
        bpm: 120,
        notes: [
          {
            channel: 0,
            durationTicks: 10,
            note: 60,
            startTick: 0,
            velocity: 0,
          },
        ],
      })
    );
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.notes[0]?.velocity).toBeCloseTo(1 / 127, 5);
  });

  test("keeps notes and channels in range", () => {
    const parsed = parseMidiFile(
      encodeMidiFile({
        bpm: 120,
        notes: [
          {
            channel: 17,
            durationTicks: 10,
            note: 300,
            startTick: 0,
            velocity: 5,
          },
        ],
      })
    );
    expect(parsed.notes[0]).toMatchObject({
      channel: 1,
      note: 127,
      velocity: 1,
    });
  });

  test("refuses what does not fit in a file", () => {
    for (const bpm of [0, -120, Number.NaN, 2]) {
      expect(() => encodeMidiFile({ bpm, notes: [] })).toThrow(MidiFileError);
    }
    expect(() =>
      encodeMidiFile({ bpm: 120, notes: [], ticksPerQuarterNote: 0 })
    ).toThrow(MidiFileError);
    expect(() =>
      encodeMidiFile({ bpm: 120, notes: [], ticksPerQuarterNote: 40_000 })
    ).toThrow(MidiFileError);
    expect(() => encodeAt(0x1_00_00_00_00)).toThrow(MidiFileError);
    expect(() => encodeAt(-5)).toThrow(MidiFileError);
  });
});
