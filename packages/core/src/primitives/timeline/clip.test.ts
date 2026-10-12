import { describe, expect, test } from "bun:test";
import {
  type ClipValue,
  clipEnd,
  coverClips,
  duplicateClip,
  FADE_SHAPES,
  fadeGain,
  moveClip,
  nextFadeShape,
  setClipFadeIn,
  setClipFadeOut,
  setClipFadeShape,
  splitClip,
  trimClipEnd,
  trimClipStart,
} from "./clip.js";

const clip: ClipValue = {
  fadeIn: 1,
  fadeOut: 2,
  length: 8,
  offset: 4,
  start: 10,
};
const limits = { duration: 40, minLength: 1, sourceLength: 20 };

describe("moveClip", () => {
  test("moves the clip and keeps its length and source offset", () => {
    expect(moveClip(clip, 20, limits)).toEqual({ ...clip, start: 20 });
  });

  test("keeps the whole clip on the timeline", () => {
    expect(moveClip(clip, -5, limits).start).toBe(0);
    expect(moveClip(clip, 100, limits).start).toBe(32);
  });

  test("treats NaN as the beginning", () => {
    expect(moveClip(clip, Number.NaN, limits).start).toBe(0);
  });
});

describe("trimClipStart", () => {
  test("moves the start into the source, so the content stays where it is", () => {
    const next = trimClipStart(clip, 13, limits);
    expect(next.start).toBe(13);
    expect(next.length).toBe(5);
    expect(next.offset).toBe(7);
    // The content at timeline 13 is source 7 both before and after
    expect(next.offset - next.start).toBe(clip.offset - clip.start);
  });

  test("reveals the source again as far as its beginning", () => {
    const next = trimClipStart(clip, 0, limits);
    expect(next.offset).toBe(0);
    expect(next.start).toBe(6);
    expect(next.length).toBe(12);
  });

  test("leaves the clip its minimum length", () => {
    const next = trimClipStart(clip, 99, limits);
    expect(next.length).toBe(1);
    expect(clipEnd(next)).toBe(clipEnd(clip));
  });

  test("shortens fades that no longer fit", () => {
    const next = trimClipStart(clip, 17, limits);
    expect(next.length).toBe(1);
    expect(next.fadeIn + next.fadeOut).toBeLessThanOrEqual(next.length);
  });
});

describe("trimClipEnd", () => {
  test("moves the end", () => {
    expect(trimClipEnd(clip, 14, limits).length).toBe(4);
  });

  test("stops where the source runs out", () => {
    // 20 of source, 4 already skipped: 16 at most, from 10 to 26
    expect(clipEnd(trimClipEnd(clip, 99, limits))).toBe(26);
  });

  test("stops at the end of the timeline", () => {
    const wide = { ...limits, duration: 20 };
    expect(clipEnd(trimClipEnd(clip, 99, wide))).toBe(20);
  });

  test("leaves the clip its minimum length", () => {
    expect(trimClipEnd(clip, 0, limits).length).toBe(1);
  });

  test("any length when the source has none", () => {
    const open = { duration: 100 };
    expect(clipEnd(trimClipEnd(clip, 80, open))).toBe(80);
  });
});

describe("fades", () => {
  test("a fade-in stops where the fade-out begins", () => {
    expect(setClipFadeIn(clip, 99).fadeIn).toBe(6);
    expect(setClipFadeIn(clip, -3).fadeIn).toBe(0);
  });

  test("a fade-out stops where the fade-in ends", () => {
    expect(setClipFadeOut(clip, 99).fadeOut).toBe(7);
  });
});

describe("splitClip", () => {
  test("cuts the clip in two pieces that play the same source in the same place", () => {
    const pieces = splitClip(clip, 14);
    expect(pieces).not.toBeNull();
    const [left, right] = pieces as [ClipValue, ClipValue];
    expect(left.start).toBe(10);
    expect(left.length).toBe(4);
    expect(right.start).toBe(14);
    expect(right.length).toBe(4);
    expect(clipEnd(right)).toBe(clipEnd(clip));
    // The right piece picks up where the left piece stops
    expect(right.offset).toBe(left.offset + left.length);
  });

  test("each piece keeps its outer fade and the cut has none", () => {
    const [left, right] = splitClip(clip, 14) as [ClipValue, ClipValue];
    expect(left.fadeIn).toBe(1);
    expect(left.fadeOut).toBe(0);
    expect(right.fadeIn).toBe(0);
    expect(right.fadeOut).toBe(2);
  });

  test("refuses a cut outside the clip or too near its edges", () => {
    expect(splitClip(clip, 10)).toBeNull();
    expect(splitClip(clip, 18)).toBeNull();
    expect(splitClip(clip, 5)).toBeNull();
    expect(splitClip(clip, 10.5, 1)).toBeNull();
    expect(splitClip(clip, Number.NaN)).toBeNull();
  });
});

describe("duplicateClip", () => {
  test("places the copy right after the clip", () => {
    expect(duplicateClip(clip, limits)).toEqual({ ...clip, start: 18 });
  });

  test("keeps the copy on the timeline when there is no room", () => {
    const tight = { ...limits, duration: 24 };
    expect(duplicateClip(clip, tight).start).toBe(16);
  });
});

describe("fade shapes", () => {
  test("every shape runs from silence to full gain", () => {
    for (const shape of FADE_SHAPES) {
      expect(fadeGain(shape, 0)).toBe(0);
      expect(fadeGain(shape, 1)).toBe(1);
    }
  });

  test("fast rises early, slow late, and linear evenly", () => {
    expect(fadeGain("fast", 0.5)).toBeGreaterThan(0.5);
    expect(fadeGain("slow", 0.5)).toBeLessThan(0.5);
    expect(fadeGain("linear", 0.5)).toBe(0.5);
    expect(fadeGain("smooth", 0.5)).toBe(0.5);
  });

  test("progress outside the fade is held at its ends", () => {
    expect(fadeGain("slow", -1)).toBe(0);
    expect(fadeGain("slow", 2)).toBe(1);
  });

  test("steps through the shapes and round again", () => {
    expect(nextFadeShape()).toBe("fast");
    expect(nextFadeShape("smooth")).toBe("linear");
  });

  test("sets one fade's shape and leaves the other", () => {
    const next = setClipFadeShape(clip, "out", "slow");
    expect(next.fadeOutShape).toBe("slow");
    expect(next.fadeInShape).toBeUndefined();
  });

  test("a split keeps each outer shape and the cut has none", () => {
    const shaped = {
      ...clip,
      fadeInShape: "fast",
      fadeOutShape: "slow",
    } as const;
    const [left, right] = splitClip(shaped, 14) as [ClipValue, ClipValue];
    expect(left.fadeInShape).toBe("fast");
    expect(left.fadeOutShape).toBeUndefined();
    expect(right.fadeOutShape).toBe("slow");
    expect(right.fadeInShape).toBeUndefined();
  });
});

describe("coverClips", () => {
  type Item = { id: string; value: ClipValue };
  const at = (id: string, start: number, length: number, offset = 0): Item => ({
    id,
    value: { fadeIn: 0, fadeOut: 0, length, offset, start },
  });
  const split = (item: Item, value: ClipValue): Item => ({
    id: `${item.id}b`,
    value,
  });
  const cover = (items: Item[], placed: Item) =>
    coverClips(items, placed.value, { duration: 100 }, split).map(
      (item) =>
        `${item.id}:${item.value.start}+${item.value.length}@${item.value.offset}`
    );

  test("leaves clips the new one does not touch", () => {
    expect(cover([at("a", 0, 10), at("b", 30, 10)], at("n", 10, 20))).toEqual([
      "a:0+10@0",
      "b:30+10@0",
    ]);
  });

  test("removes a clip it lies wholly over", () => {
    expect(cover([at("a", 12, 5)], at("n", 10, 20))).toEqual([]);
  });

  test("trims the end of a clip it overlaps from the right", () => {
    expect(cover([at("a", 0, 15)], at("n", 10, 20))).toEqual(["a:0+10@0"]);
  });

  test("trims the start of a clip it overlaps from the left, keeping its content in place", () => {
    expect(cover([at("a", 25, 15, 5)], at("n", 10, 20))).toEqual([
      "a:30+10@10",
    ]);
  });

  test("cuts a clip it lies inside in two, around itself", () => {
    expect(cover([at("a", 0, 50)], at("n", 10, 20))).toEqual([
      "a:0+10@0",
      "ab:30+20@30",
    ]);
  });
});
