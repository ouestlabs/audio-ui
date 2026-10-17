import { describe, expect, test } from "bun:test";
import {
  type Arranged,
  automationAt,
  clearTime,
  consolidate,
  copyClips,
  copyTime,
  cropClip,
  crossfade,
  deleteTime,
  fadeTime,
  flatAutomation,
  land,
  lay,
  mixAt,
  openTime,
  otherSelected,
  panPosition,
  pasteTime,
  playedNotes,
  scaleClip,
  scaleValue,
  shiftTrack,
  volumeGain,
  volumeValue,
} from "@/registry-audio/bases/base/lib/arrangement";

const ORDER = ["drums", "bass", "keys"];
const DURATION = 100;

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

describe("lay", () => {
  test("covers what lay under the clip, on its track only", () => {
    const all = [clip("a", "drums", 0, 40), clip("b", "bass", 0, 40)];
    const laid = lay(all, clip("c", "drums", 10, 10), DURATION);
    const drums = laid.filter((item) => item.track === "drums");
    // `a` is cut into the stretch before and the stretch after.
    expect(drums.map((item) => item.value.start).sort((x, y) => x - y)).toEqual(
      [0, 10, 20]
    );
    expect(laid.some((item) => item.id === "b")).toBe(true);
  });

  test("replaces a clip of the same id rather than stacking it", () => {
    const laid = lay(
      [clip("a", "drums", 0, 10)],
      clip("a", "drums", 50, 10),
      DURATION
    );
    expect(laid).toHaveLength(1);
    expect(laid[0]?.value.start).toBe(50);
  });
});

describe("shiftTrack", () => {
  test("moves by tracks and stays on the arrangement", () => {
    expect(shiftTrack(ORDER, "drums", 1)).toBe("bass");
    expect(shiftTrack(ORDER, "keys", 5)).toBe("keys");
    expect(shiftTrack(ORDER, "drums", -3)).toBe("drums");
  });
});

describe("otherSelected", () => {
  test("is the rest of a selection that holds the clip, and nothing else", () => {
    expect(otherSelected(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    expect(otherSelected(["a"], "a")).toEqual([]);
    expect(otherSelected(["a", "b"], "z")).toEqual([]);
  });
});

describe("land", () => {
  const base = {
    copyIds: [],
    duration: DURATION,
    group: [],
    order: ORDER,
    origins: [],
  };

  test("a clip dropped on another track moves to it", () => {
    const all = [clip("a", "drums", 0, 10)];
    const laid = land(all, { ...base, id: "a", track: "bass" });
    expect(laid.find((item) => item.id === "a")?.track).toBe("bass");
  });

  test("a group dropped on another track moves by as many tracks as the dragged clip", () => {
    const all = [clip("a", "drums", 0, 10), clip("b", "bass", 20, 10)];
    const laid = land(all, { ...base, group: ["b"], id: "a", track: "bass" });
    expect(laid.find((item) => item.id === "a")?.track).toBe("bass");
    expect(laid.find((item) => item.id === "b")?.track).toBe("keys");
  });

  test("a copy drag leaves the original where it was", () => {
    const original = clip("a", "drums", 0, 10);
    const dragged = { ...original, value: { ...original.value, start: 40 } };
    const laid = land([dragged], {
      ...base,
      copyIds: ["a-copy"],
      id: "a",
      origins: [original],
      track: undefined,
    });
    const starts = laid.map((item) => item.value.start).sort((x, y) => x - y);
    expect(starts).toEqual([0, 40]);
    expect(laid.some((item) => item.id === "a-copy")).toBe(true);
  });

  test("an unknown clip changes nothing", () => {
    const all = [clip("a", "drums", 0, 10)];
    expect(land(all, { ...base, id: "zzz", track: "bass" })).toBe(all);
  });
});

describe("scaleValue", () => {
  test("scales every position and length by the ratio", () => {
    expect(
      scaleValue({ fadeIn: 1, fadeOut: 2, length: 4, offset: 3, start: 5 }, 2)
    ).toEqual({ fadeIn: 2, fadeOut: 4, length: 8, offset: 6, start: 10 });
  });
});

describe("time on tracks", () => {
  const all = [
    clip("a", "drums", 0, 40),
    clip("b", "bass", 20, 40),
    clip("c", "keys", 0, 40),
  ];
  const spans = (laid: Arranged[], track: string) =>
    laid
      .filter((item) => item.track === track)
      .map((item) => [item.value.start, item.value.length])
      .sort((x, y) => (x[0] ?? 0) - (y[0] ?? 0));

  test("clearTime empties a stretch on its tracks only", () => {
    const laid = clearTime(
      all,
      { range: [10, 30], tracks: ["drums", "bass"] },
      DURATION
    );
    expect(spans(laid, "drums")).toEqual([
      [0, 10],
      [30, 10],
    ]);
    expect(spans(laid, "bass")).toEqual([[30, 30]]);
    expect(spans(laid, "keys")).toEqual([[0, 40]]);
  });

  test("a copy pastes on the track picked and the ones below, at the cursor", () => {
    const copy = copyTime(
      all,
      { range: [10, 30], tracks: ["drums", "bass"] },
      ORDER,
      DURATION
    );
    expect(copy.length).toBe(20);
    const { clips, ids } = pasteTime([], copy, 50, "bass", ORDER, DURATION);
    expect(ids).toHaveLength(2);
    expect(spans(clips, "bass")).toEqual([[50, 20]]);
    // The bass part of the copy started 10 into the stretch: it lands on keys, a row below.
    expect(spans(clips, "keys")).toEqual([[60, 10]]);
  });

  test("a paste past the last track or the end of the timeline is left out or cut", () => {
    const copy = copyClips([clip("x", "keys", 0, 20)], ORDER, DURATION);
    expect(
      pasteTime([], copy, 90, "keys", ORDER, DURATION).clips.map(
        (item) => item.value.length
      )
    ).toEqual([10]);
    const two = copyTime(
      all,
      { range: [0, 10], tracks: ["bass", "keys"] },
      ORDER,
      DURATION
    );
    expect(pasteTime([], two, 0, "keys", ORDER, DURATION).clips).toHaveLength(
      0
    );
  });

  test("deleteTime and openTime move what comes after on every track", () => {
    expect(spans(deleteTime(all, 0, 20, DURATION), "bass")).toEqual([[0, 40]]);
    expect(spans(openTime(all, 10, 10, DURATION), "drums")).toEqual([
      [0, 10],
      [20, 30],
    ]);
  });

  test("consolidate makes one clip per track spanning the stretch", () => {
    const { clips, ids } = consolidate(
      all,
      { range: [10, 50], tracks: ["drums", "bass"] },
      DURATION
    );
    expect(ids).toHaveLength(2);
    expect(spans(clips, "drums")).toEqual([
      [0, 10],
      [10, 40],
    ]);
    expect(spans(clips, "bass")).toEqual([
      [10, 40],
      [50, 10],
    ]);
    expect(clips.find((item) => item.id === ids[0])?.sourceLength).toBe(40);
  });
});

describe("fades", () => {
  const fade = (item: Arranged | undefined) => [
    item?.value.fadeIn,
    item?.value.fadeOut,
  ];

  test("a fade where two clips meet is given to the other one, as long as it can be", () => {
    const left = clip("l", "drums", 0, 20);
    const right = { ...clip("r", "drums", 20, 10) };
    right.value = { ...right.value, fadeIn: 4 };
    const other = clip("o", "bass", 0, 20);
    const laid = crossfade([left, right, other], "r", "in");
    expect(fade(laid.find((item) => item.id === "l"))).toEqual([0, 4]);
    expect(fade(laid.find((item) => item.id === "o"))).toEqual([0, 0]);
    const short = clip("s", "drums", 30, 3);
    right.value = { ...right.value, fadeOut: 6 };
    expect(
      fade(
        crossfade([right, short], "r", "out").find((item) => item.id === "s")
      )
    ).toEqual([3, 0]);
  });

  test("a stretch over a clip's edges fades it in and out, and two clips that meet across it crossfade", () => {
    const laid = fadeTime(
      [
        clip("a", "drums", 0, 20),
        clip("b", "drums", 20, 20),
        clip("c", "bass", 0, 20),
      ],
      { range: [16, 24], tracks: ["drums"] }
    );
    expect(fade(laid.find((item) => item.id === "a"))).toEqual([0, 4]);
    expect(fade(laid.find((item) => item.id === "b"))).toEqual([4, 0]);
    expect(fade(laid.find((item) => item.id === "c"))).toEqual([0, 0]);
  });

  test("a stretch over a whole clip shares its length between the two fades", () => {
    const [laid] = fadeTime([clip("a", "drums", 10, 10)], {
      range: [0, 40],
      tracks: ["drums"],
    });
    expect(fade(laid)).toEqual([5, 5]);
  });
});

describe("cropClip", () => {
  test("keeps the stretch a clip plays, and where it was in the recording", () => {
    const played = { ...clip("a", "drums", 10, 20), sourceLength: 100 };
    played.value = { ...played.value, offset: 30 };
    const cropped = cropClip(played);
    expect([
      cropped.sourceFrom,
      cropped.sourceLength,
      cropped.value.offset,
    ]).toEqual([30, 20, 0]);
  });

  test("a looped clip keeps its loop, from the source's new start", () => {
    const looped = { ...clip("a", "drums", 0, 64), loop: [16, 32] as const };
    looped.value = { ...looped.value, offset: 20 };
    const cropped = cropClip(looped);
    expect([
      cropped.sourceFrom,
      cropped.sourceLength,
      cropped.loop,
      cropped.value.offset,
    ]).toEqual([16, 16, [0, 16], 4]);
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

describe("scaleClip", () => {
  test("a MIDI clip's notes and loop follow the tempo, a recording's loop does not", () => {
    const value = { fadeIn: 0, fadeOut: 0, length: 4, offset: 0, start: 2 };
    const midi = scaleClip(
      {
        id: "m",
        loop: [0, 4],
        name: "Keys",
        notes: [{ id: "a", length: 1, pitch: 60, start: 2 }],
        sourceLength: 4,
        track: "keys",
        value,
      },
      0.5
    );
    expect(midi.loop).toEqual([0, 2]);
    expect(midi.notes?.[0]).toMatchObject({ length: 0.5, start: 1 });
    expect(midi.value.start).toBe(1);
    const audio = scaleClip(
      {
        id: "a",
        loop: [0, 4],
        name: "Vox",
        sourceLength: 4,
        track: "v",
        value,
      },
      0.5
    );
    expect(audio.loop).toEqual([0, 4]);
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
