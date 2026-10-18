import { describe, expect, test } from "bun:test";
import { DEFAULT_TEMPO } from "@audio-ui/core/time";
import type { Arranged } from "@/registry-audio/bases/base/lib/arrangement";
import {
  apply,
  clearTime,
  consolidate,
  copyClips,
  copyTime,
  createArrangementState,
  cropClip,
  crossfade,
  deleteTime,
  fadeTime,
  land,
  lay,
  openTime,
  otherSelected,
  pasteTime,
  scaleClip,
  scaleValue,
  shiftTrack,
} from "@/registry-audio/bases/base/lib/arrangement-state";

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

  test("shortens what it covers to where it starts, whatever its own source holds", () => {
    const groove = clip("groove", "drums", 4, 12);
    const fill = { ...clip("fill", "drums", 12, 4), sourceLength: 6 };
    const laid = lay([groove], fill, DURATION);
    expect(
      laid.map((item) => [
        item.id,
        item.value.start,
        item.value.start + item.value.length,
      ])
    ).toEqual([
      ["groove", 4, 12],
      ["fill", 12, 16],
    ]);
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
      id: "a",
      origins: [original],
      track: undefined,
    });
    const starts = laid.map((item) => item.value.start).sort((x, y) => x - y);
    expect(starts).toEqual([0, 40]);
    expect(laid.some((item) => item.id === "a-1")).toBe(true);
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

describe("apply", () => {
  const at = (id: string, start: number, length: number, track = "drums") => ({
    id,
    name: id,
    sourceLength: 100,
    track,
    value: { fadeIn: 0, fadeOut: 0, length, offset: 0, start },
  });
  const init = (clips: Arranged[]) =>
    createArrangementState({
      colors: 5,
      duration: 100,
      initialClips: clips,
      initialLocators: [{ at: 20, name: "Verse" }],
      initialLoop: { on: true, range: [10, 30] },
      initialSignatures: [{ at: 40, beatUnit: 4, beatsPerBar: 3, id: "s" }],
      initialTracks: [
        { color: 0, id: "drums", name: "Drums" },
        { color: 1, id: "bass", name: "Bass" },
      ],
      // A 4/4 bar at 120 BPM is two seconds.
      tempo: DEFAULT_TEMPO,
    });
  /** The same tempo at half the speed: its bar lasts twice as long. */
  const SLOWER = { ...DEFAULT_TEMPO, bpm: 60 };

  test("a command that changes nothing returns the same state", () => {
    const state = init([at("a", 0, 10)]);
    expect(apply(state, { type: "remove-clip", id: "nope" })).toBe(state);
  });

  test("a drag is one step of the history, and undo takes all of it back", () => {
    let state = init([at("a", 0, 10)]);
    for (const start of [5, 12, 20]) {
      state = apply(state, {
        type: "change-clip",
        id: "a",
        value: { ...at("a", 0, 10).value, start },
        details: { delta: start, target: "move" },
      });
    }
    state = apply(state, {
      type: "commit-clip",
      id: "a",
      copy: false,
      track: undefined,
    });
    expect(state.history.past).toHaveLength(1);
    expect(apply(state, { type: "undo" }).doc.clips[0]?.value.start).toBe(0);
  });

  test("a copy drag copies the clip and leaves the original where it was", () => {
    let state = init([at("a", 0, 10)]);
    state = apply(state, {
      type: "change-clip",
      id: "a",
      value: { ...at("a", 0, 10).value, start: 40 },
      details: { copy: true, delta: 40, target: "move" },
    });
    state = apply(state, {
      type: "commit-clip",
      id: "a",
      copy: true,
      track: undefined,
    });
    expect(
      state.doc.clips.map((item) => item.value.start).sort((x, y) => x - y)
    ).toEqual([0, 40]);
    expect(state.doc.clips.some((item) => item.id === "a-1")).toBe(true);
  });

  test("a copy takes an id no clip has", () => {
    let state = init([at("a", 0, 10), at("a-1", 50, 10)]);
    state = apply(state, { type: "select-clip", id: "a", additive: false });
    state = apply(state, { type: "duplicate-selection" });
    expect(state.selection?.clips).toEqual(["a-2"]);
  });

  test("a new track takes the number after the last one added, even after a removal", () => {
    let state = init([]);
    state = apply(state, { type: "add-track" });
    expect(state.doc.tracks.at(-1)?.id).toBe("track-3");
    state = apply(state, { type: "remove-track", id: "track-3" });
    state = apply(state, { type: "add-track" });
    expect(state.doc.tracks.at(-1)?.id).toBe("track-4");
  });

  test("a tempo change keeps the musical positions: every time in the document is scaled to the new bar", () => {
    let state = init([at("a", 10, 20)]);
    state = apply(state, { type: "set-tempo", tempo: SLOWER });
    const { doc } = state;
    expect(doc.tempo).toBe(SLOWER);
    expect([doc.clips[0]?.value.start, doc.clips[0]?.value.length]).toEqual([
      20, 40,
    ]);
    expect(doc.duration).toBe(200);
    expect(doc.loop).toEqual({ on: true, range: [20, 60] });
    expect(doc.locators).toEqual([{ at: 40, name: "Verse" }]);
    expect(doc.signatures[0]?.at).toBe(80);
  });

  test("a tempo change is one step of the history, and undo gives the old tempo with the old times", () => {
    let state = init([at("a", 10, 20)]);
    state = apply(state, { type: "rename-clip", id: "a", name: "Intro" });
    state = apply(state, { type: "set-tempo", tempo: SLOWER });
    expect(state.history.past).toHaveLength(2);
    const undone = apply(state, { type: "undo" });
    expect(undone.doc.tempo).toBe(DEFAULT_TEMPO);
    expect(undone.doc.clips[0]?.value.start).toBe(10);
    expect(undone.doc.duration).toBe(100);
    const redone = apply(undone, { type: "redo" });
    expect(redone.doc.tempo).toBe(SLOWER);
    expect(redone.doc.clips[0]?.value.start).toBe(20);
  });

  test("the same tempo, or one that is not a tempo, changes nothing", () => {
    const state = init([at("a", 0, 10)]);
    expect(
      apply(state, { type: "set-tempo", tempo: { ...DEFAULT_TEMPO } })
    ).toBe(state);
    expect(
      apply(state, { type: "set-tempo", tempo: { ...DEFAULT_TEMPO, bpm: 0 } })
    ).toBe(state);
  });

  test("a locator is added where the cursor is, named by its number, and not twice", () => {
    let state = init([]);
    state = apply(state, { type: "add-locator", at: 50 });
    expect(state.doc.locators.at(-1)).toEqual({ at: 50, name: "Locator 2" });
    expect(apply(state, { type: "add-locator", at: 50 })).toBe(state);
  });

  test("a locator is renamed, removed, and each is one step", () => {
    let state = init([]);
    state = apply(state, { type: "rename-locator", at: 20, name: "Chorus" });
    expect(state.doc.locators).toEqual([{ at: 20, name: "Chorus" }]);
    expect(
      apply(state, { type: "rename-locator", at: 20, name: "Chorus" })
    ).toBe(state);
    state = apply(state, { type: "remove-locator", at: 20 });
    expect(state.doc.locators).toEqual([]);
    expect(state.history.past).toHaveLength(2);
    expect(apply(state, { type: "undo" }).doc.locators[0]?.name).toBe("Chorus");
  });

  test("a signature takes the next free id and the signature in force where it is added", () => {
    let state = init([]);
    state = apply(state, { type: "add-signature", at: 60 });
    const added = state.doc.signatures.find((change) => change.at === 60);
    expect(added).toMatchObject({
      beatUnit: 4,
      beatsPerBar: 3,
      id: "signature-1",
    });
    state = apply(state, { type: "remove-signature", id: "signature-1" });
    state = apply(state, { type: "add-signature", at: 70 });
    expect(state.doc.signatures.at(-1)?.id).toBe("signature-1");
  });

  test("a signature is set, moved within the timeline, and removed", () => {
    let state = init([]);
    state = apply(state, {
      type: "set-signature",
      id: "s",
      beatsPerBar: 7,
      beatUnit: 8,
    });
    expect(state.doc.signatures[0]).toMatchObject({
      beatUnit: 8,
      beatsPerBar: 7,
    });
    state = apply(state, { type: "move-signature", id: "s", to: 500 });
    expect(state.doc.signatures[0]?.at).toBe(100);
    state = apply(state, { type: "move-signature", id: "s", to: -5 });
    expect(state.doc.signatures[0]?.at).toBe(0);
    state = apply(state, { type: "remove-signature", id: "s" });
    expect(state.doc.signatures).toEqual([]);
  });

  test("the loop is set in one step, and a drag of its range is one step too", () => {
    let state = init([]);
    state = apply(state, { type: "set-loop", loop: { on: false } });
    expect(state.doc.loop).toEqual({ on: false, range: [10, 30] });
    expect(apply(state, { type: "set-loop", loop: { on: false } })).toBe(state);
    for (const range of [
      [12, 30],
      [15, 32],
      [20, 40],
    ] as const) {
      state = apply(state, { type: "change-loop", range });
    }
    state = apply(state, { type: "settle-clip-edit" });
    expect(state.doc.loop.range).toEqual([20, 40]);
    expect(state.history.past).toHaveLength(2);
    expect(apply(state, { type: "undo" }).doc.loop.range).toEqual([10, 30]);
  });

  test("a split at the cursor cuts the selected clip, and its second piece takes a fresh id", () => {
    let state = init([at("a", 0, 20)]);
    state = apply(state, { type: "select-clip", id: "a", additive: false });
    state = apply(state, { type: "split-cursor", at: 10, step: 1 });
    expect(
      state.doc.clips.map((item) => [
        item.id,
        item.value.start,
        item.value.length,
      ])
    ).toEqual([
      ["a", 0, 10],
      ["a-1", 10, 10],
    ]);
  });

  test("undo leaves nothing selected", () => {
    let state = init([at("a", 0, 10)]);
    state = apply(state, { type: "rename-clip", id: "a", name: "Intro" });
    state = apply(state, { type: "select-clip", id: "a", additive: false });
    expect(apply(state, { type: "undo" }).selection).toBeNull();
  });
});
