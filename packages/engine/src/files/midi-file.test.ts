import { describe, expect, test } from "bun:test";
import { readMidiFileParts } from "./midi-file.ts";
import { readMusicXmlFileParts } from "./musicxml-file.ts";

const text = (value: string) => [...value].map((char) => char.charCodeAt(0));
const u16 = (value: number) => [(value >> 8) & 0xff, value & 0xff];
const u32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];
const chunk = (id: string, bytes: number[]) => [
  ...text(id),
  ...u32(bytes.length),
  ...bytes,
];
const END = [0, 0xff, 0x2f, 0];
const named = (name: string) => [0, 0xff, 0x03, name.length, ...text(name)];

/**
 * A format 1 file at 96 ticks a quarter: a tempo track at 100 BPM, a "Bass"
 * track, and a track with no name holding a piano on channel 1 and drums on
 * channel 10.
 */
const FILE = new Blob([
  new Uint8Array([
    ...chunk("MThd", [...u16(1), ...u16(3), ...u16(96)]),
    ...chunk("MTrk", [0, 0xff, 0x51, 3, 0x09, 0x27, 0xc0, ...END]),
    ...chunk("MTrk", [
      ...named("Bass"),
      // Program 33, a fingered bass.
      0,
      0xc0,
      33,
      0,
      0x90,
      36,
      100,
      96,
      0x80,
      36,
      0,
      ...END,
    ]),
    ...chunk("MTrk", [
      0,
      0x90,
      60,
      64,
      0,
      0x99,
      38,
      127,
      48,
      0x89,
      38,
      0,
      // 144 ticks, two bytes as a variable-length quantity.
      0x81,
      0x10,
      0x80,
      60,
      0,
      ...END,
    ]),
  ]),
]);

describe("readMidiFileParts", () => {
  test("a part per track and channel, named after its track, its notes in beats, its program", async () => {
    const read = await readMidiFileParts(FILE);
    expect(read.bpm).toBeCloseTo(100, 6);
    expect(read.parts.map(({ drums, name }) => ({ drums, name }))).toEqual([
      { drums: false, name: "Bass" },
      { drums: false, name: "Track 3, channel 1" },
      { drums: true, name: "Track 3, channel 10" },
    ]);
    // A program is its channel's, whichever track sets it, as a synth hears it.
    expect(read.parts.map((part) => part.program)).toEqual([33, 33, undefined]);
    expect(read.parts[0]?.notes).toEqual([
      { length: 1, pitch: 36, start: 0, velocity: 100 / 127 },
    ]);
    expect(read.parts[1]?.notes[0]).toMatchObject({ length: 2, start: 0 });
    expect(read.parts[2]?.notes[0]).toMatchObject({
      length: 0.5,
      pitch: 38,
      start: 0,
      velocity: 1,
    });
  });
});

describe("readMusicXmlFileParts", () => {
  test("a part each, by its name, in the beats it was written in through a change of tempo", async () => {
    const score = `<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Flute</part-name></score-part>
    <score-part id="P2"><part-name></part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <direction><sound tempo="90"/></direction>
      <note><pitch><step>A</step><octave>5</octave></pitch><duration>2</duration></note>
      <direction><sound tempo="45"/></direction>
      <note><pitch><step>B</step><octave>5</octave></pitch><duration>2</duration></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const read = await readMusicXmlFileParts(new Blob([score]));
    expect(read.bpm).toBe(90);
    expect(read.parts.map((part) => part.name)).toEqual(["Flute", "Part 2"]);
    const [flute, second] = read.parts;
    expect(
      flute?.notes.map(({ length, pitch, start }) => [start, length, pitch])
    ).toEqual([
      [0, 2, 81],
      [2, 2, 83],
    ]);
    // The second part has no tempo of its own: its beats are its own still.
    expect(second?.notes[0]).toMatchObject({ length: 4, pitch: 48, start: 0 });
  });
});
