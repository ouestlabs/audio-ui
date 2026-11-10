import { describe, expect, test } from "bun:test";
import { strToU8, zipSync } from "fflate";
import {
  readMusicXmlFile,
  writeMusicXmlFile,
} from "@/registry-audio/bases/base/lib/musicxml-file";

/**
 * A score that holds what a reader trips on: a chord, a grace note, a rest, a
 * tie across the bar line where the tempo changes, a second voice through a
 * backup, a dotted note, a key with a flat and a repeat.
 */
const SCORE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>Test</work-title></work>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <barline location="left"><repeat direction="forward"/></barline>
      <attributes><divisions>2</divisions><key><fifths>-1</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction><sound tempo="100"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type></note>
      <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type></note>
      <note><grace/><pitch><step>A</step><octave>4</octave></pitch><voice>1</voice><type>eighth</type></note>
      <note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type></note>
      <note><rest/><duration>2</duration><voice>1</voice></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><tie type="start"/><voice>1</voice><type>quarter</type></note>
      <backup><duration>8</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>8</duration><voice>2</voice><type>whole</type></note>
    </measure>
    <measure number="2">
      <direction><sound tempo="60"/></direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><tie type="stop"/><voice>1</voice><type>quarter</type></note>
      <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>6</duration><voice>1</voice><type>half</type><dot/></note>
      <barline location="right"><repeat direction="backward"/></barline>
    </measure>
  </part>
</score-partwise>`;

const GRID = { duration: 64 };

/** The notes as start, length and pitch, in order: what a reader is held to. */
const shapes = (notes: { length: number; pitch: number; start: number }[]) =>
  notes
    .map(({ length, pitch, start }) => ({ length, pitch, start }))
    .sort((a, b) => a.start - b.start || a.pitch - b.pitch);

/** What the score holds, in sixteenths: the tie a half note across the change of tempo, the grace note gone. */
const EXPECTED = [
  { length: 16, pitch: 48, start: 0 },
  { length: 4, pitch: 60, start: 0 },
  { length: 4, pitch: 64, start: 0 },
  { length: 4, pitch: 70, start: 4 },
  { length: 8, pitch: 67, start: 12 },
  { length: 12, pitch: 66, start: 20 },
];

describe("readMusicXmlFile", () => {
  test("reads a score onto the steps, in the beats it was written in, its first tempo and title", async () => {
    const read = await readMusicXmlFile(new Blob([SCORE]), GRID);
    expect(read.bpm).toBe(100);
    expect(read.title).toBe("Test");
    expect(shapes(read.notes)).toEqual(EXPECTED);
  });

  test("opens a score compressed as .mxl, its container naming it", async () => {
    const archive = zipSync({
      "META-INF/container.xml": [
        strToU8(
          '<?xml version="1.0"?><container><rootfiles><rootfile full-path="score/piece.musicxml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>'
        ),
        { level: 0 },
      ],
      mimetype: [strToU8("application/vnd.recordare.musicxml"), { level: 0 }],
      "score/piece.musicxml": strToU8(SCORE),
    });
    expect(
      shapes((await readMusicXmlFile(new Blob([archive]), GRID)).notes)
    ).toEqual(EXPECTED);
  });

  test("reads a score in UTF-16, by its byte-order mark", async () => {
    const units = new Uint16Array([
      0xfe_ff,
      ...[...SCORE].map((character) => character.charCodeAt(0)),
    ]);
    const read = await readMusicXmlFile(new Blob([units]), GRID);
    expect(shapes(read.notes)).toEqual(EXPECTED);
  });

  test("drops what starts past the clip and holds the pitch range", async () => {
    const read = await readMusicXmlFile(new Blob([SCORE]), {
      duration: 16,
      minPitch: 60,
    });
    expect(
      read.notes.every((note) => note.start < 16 && note.pitch >= 60)
    ).toBe(true);
    expect(read.notes.at(-1)?.start).toBe(12);
    expect(read.notes.find((note) => note.start === 12)?.length).toBe(4);
  });
});

describe("writeMusicXmlFile", () => {
  test("writes the notes on their grid, and reads back as they were", async () => {
    const notes = EXPECTED.map((note, index) => ({
      ...note,
      id: `n${index}`,
      velocity: 0.8,
    }));
    const written = writeMusicXmlFile(notes, { bpm: 90, title: "Clip" });
    expect(written).toContain("<score-partwise");
    const read = await readMusicXmlFile(new Blob([written]), GRID);
    expect(read.bpm).toBe(90);
    expect(read.title).toBe("Clip");
    expect(shapes(read.notes)).toEqual(EXPECTED);
  });

  test("leaves the deactivated notes out", () => {
    const written = writeMusicXmlFile(
      [
        { id: "on", length: 4, pitch: 60, start: 0 },
        { id: "off", length: 4, muted: true, pitch: 72, start: 4 },
      ],
      { bpm: 120 }
    );
    expect(written).toContain("<step>C</step>");
    expect(written.includes("<octave>5</octave>")).toBe(false);
  });
});
