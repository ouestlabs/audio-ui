import { describe, expect, test } from "bun:test";
import {
  type Arranged,
  clearTime,
  consolidate,
  copyClips,
  copyTime,
  deleteTime,
  land,
  lay,
  openTime,
  otherSelected,
  pasteTime,
  scaleValue,
  shiftTrack,
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
