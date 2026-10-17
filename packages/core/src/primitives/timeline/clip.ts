import { clamp, clampFinite } from "../../shared/math.ts";

/**
 * A clip: a stretch of a source (a recording, a pattern) placed on the
 * timeline. All lengths are in the timeline's units, the source's included.
 */
export interface ClipValue {
  /** How long the clip's fade-in lasts, from its start. */
  fadeIn: number;
  /** How the fade-in rises. @default "linear" */
  fadeInShape?: FadeShape;
  /** How long the clip's fade-out lasts, up to its end. */
  fadeOut: number;
  /** How the fade-out falls. @default "linear" */
  fadeOutShape?: FadeShape;
  /** How long the clip is on the timeline. */
  length: number;
  /** Where in the source the clip begins: what trimming its start moves. */
  offset: number;
  /** Where the clip begins on the timeline. */
  start: number;
}

/** How a fade rises or falls: evenly, quick then slow, slow then quick, or eased at both ends. */
export type FadeShape = "fast" | "linear" | "slow" | "smooth";

export const FADE_SHAPES: readonly FadeShape[] = [
  "linear",
  "fast",
  "slow",
  "smooth",
];

/** The shape after `shape`, going round, for a control that steps through them. */
export function nextFadeShape(shape: FadeShape = "linear"): FadeShape {
  return (
    FADE_SHAPES[(FADE_SHAPES.indexOf(shape) + 1) % FADE_SHAPES.length] ??
    "linear"
  );
}

/**
 * The gain a fade of `shape` has `progress` of the way through it, from 0
 * (silent) to 1 (full): the curve of a fade-in; a fade-out plays it backwards.
 */
export function fadeGain(shape: FadeShape, progress: number): number {
  const t = clamp(progress, 0, 1);
  switch (shape) {
    case "fast":
      return 1 - (1 - t) * (1 - t);
    case "slow":
      return t * t;
    case "smooth":
      return t * t * (3 - 2 * t);
    default:
      return t;
  }
}

export interface ClipLimits {
  /** The length of the timeline the clip sits on. */
  duration: number;
  /** The shortest a clip may be trimmed to. @default 0 */
  minLength?: number;
  /** The length of the source: a clip cannot show more than it holds. @default Infinity */
  sourceLength?: number;
}

/** Where the clip ends on the timeline. */
export function clipEnd(clip: ClipValue): number {
  return clip.start + clip.length;
}

/** The fades, shortened so that together they fit in the clip. */
function fitFades(clip: ClipValue): ClipValue {
  const fadeIn = clamp(clip.fadeIn, 0, clip.length);
  const fadeOut = clamp(clip.fadeOut, 0, clip.length - fadeIn);
  return fadeIn === clip.fadeIn && fadeOut === clip.fadeOut
    ? clip
    : { ...clip, fadeIn, fadeOut };
}

/** Moves the clip to begin at `start`, keeping its length and its place in the source. */
export function moveClip(
  clip: ClipValue,
  start: number,
  limits: ClipLimits
): ClipValue {
  const latest = Math.max(0, limits.duration - clip.length);
  return { ...clip, start: clampFinite(start, 0, latest) };
}

/**
 * Trims the clip's start to `start`: what is cut off stays in the source, so
 * the clip's content does not move on the timeline. Trimming back reveals the
 * source again, as far as its beginning.
 */
export function trimClipStart(
  clip: ClipValue,
  start: number,
  limits: ClipLimits
): ClipValue {
  const minLength = limits.minLength ?? 0;
  const earliest = Math.max(0, clip.start - clip.offset);
  const latest = Math.max(earliest, clipEnd(clip) - minLength);
  const next = clampFinite(start, earliest, latest);
  const delta = next - clip.start;
  return fitFades({
    ...clip,
    length: clip.length - delta,
    offset: clip.offset + delta,
    start: next,
  });
}

/**
 * Trims the clip's end to `end`, as far as the timeline and the source allow.
 */
export function trimClipEnd(
  clip: ClipValue,
  end: number,
  limits: ClipLimits
): ClipValue {
  const minLength = limits.minLength ?? 0;
  const sourceLength = limits.sourceLength ?? Number.POSITIVE_INFINITY;
  const earliest = Math.min(limits.duration, clip.start + minLength);
  const latest = Math.max(
    earliest,
    Math.min(limits.duration, clip.start + (sourceLength - clip.offset))
  );
  const next = clampFinite(end, earliest, latest);
  return fitFades({ ...clip, length: next - clip.start });
}

/** Gives the fade at `edge` the shape `shape`. */
export function setClipFadeShape(
  clip: ClipValue,
  edge: "in" | "out",
  shape: FadeShape
): ClipValue {
  return edge === "in"
    ? { ...clip, fadeInShape: shape }
    : { ...clip, fadeOutShape: shape };
}

/** Sets the fade-in's length, which cannot run into the fade-out. */
export function setClipFadeIn(clip: ClipValue, fadeIn: number): ClipValue {
  return {
    ...clip,
    fadeIn: clampFinite(fadeIn, 0, Math.max(0, clip.length - clip.fadeOut)),
  };
}

/** Sets the fade-out's length, which cannot run into the fade-in. */
export function setClipFadeOut(clip: ClipValue, fadeOut: number): ClipValue {
  return {
    ...clip,
    fadeOut: clampFinite(fadeOut, 0, Math.max(0, clip.length - clip.fadeIn)),
  };
}

/**
 * Cuts the clip in two at `at`, a position on the timeline. The pieces play
 * the same source, in the same place: the right one picks up where the left
 * one stops. Each keeps its own outer fade, and the cut has none. Returns null
 * when `at` leaves either piece shorter than `minLength`.
 */
export function splitClip(
  clip: ClipValue,
  at: number,
  minLength = 0
): [left: ClipValue, right: ClipValue] | null {
  const end = clipEnd(clip);
  const floor = Math.max(minLength, Number.EPSILON);
  if (!(at - clip.start >= floor && end - at >= floor)) {
    return null;
  }
  const { fadeOutShape: _cutOut, ...leftBase } = clip;
  const left = fitFades({
    ...leftBase,
    fadeOut: 0,
    length: at - clip.start,
  });
  const { fadeInShape: _cutIn, ...rightBase } = clip;
  const right = fitFades({
    ...rightBase,
    fadeIn: 0,
    length: end - at,
    offset: clip.offset + (at - clip.start),
    start: at,
  });
  return [left, right];
}

/**
 * A copy of the clip placed right after it, or as late as the timeline
 * allows when there is not room for it.
 */
export function duplicateClip(clip: ClipValue, limits: ClipLimits): ClipValue {
  return moveClip(clip, clipEnd(clip), limits);
}

/**
 * What a clip laid on a lane leaves of the clips already there: they are
 * covered, not stacked. A clip the new one lies wholly over goes; one it
 * overlaps by an edge is trimmed to what is left; one it lies inside is cut
 * in two around it. Items are anything with a `value`, so the rest of what
 * the app keeps about a clip travels with each piece. `split` makes the
 * second piece's item from the first's. Only the timeline's length is read
 * from `limits`: covering only shortens a clip, so no source limits it.
 */
export function coverClips<Item extends { value: ClipValue }>(
  items: readonly Item[],
  placed: ClipValue,
  limits: Pick<ClipLimits, "duration">,
  split: (item: Item, value: ClipValue) => Item
): Item[] {
  const from = placed.start;
  const to = clipEnd(placed);
  const loose = { duration: limits.duration, minLength: 0 };
  const result: Item[] = [];
  for (const item of items) {
    const { value } = item;
    const end = clipEnd(value);
    if (end <= from || value.start >= to) {
      result.push(item);
      continue;
    }
    const keepsLeft = value.start < from;
    const keepsRight = end > to;
    if (keepsLeft) {
      result.push({
        ...item,
        value: trimClipEnd(value, from, loose),
      });
    }
    if (keepsRight) {
      const right = trimClipStart(value, to, loose);
      result.push(keepsLeft ? split(item, right) : { ...item, value: right });
    }
  }
  return result;
}

/** The part of `clip` between `from` and `to`, or null when it has none there. */
function clipPart(
  clip: ClipValue,
  from: number,
  to: number,
  limits: Pick<ClipLimits, "duration">
): ClipValue | null {
  if (clipEnd(clip) <= from || clip.start >= to) {
    return null;
  }
  const loose = { duration: limits.duration, minLength: 0 };
  const started = clip.start < from ? trimClipStart(clip, from, loose) : clip;
  return clipEnd(started) > to ? trimClipEnd(started, to, loose) : started;
}

/**
 * What the stretch from `from` to `to` holds of `items`: the part of each
 * clip inside it, moved so the stretch starts at 0. Each part keeps its
 * place in its source. Lay them back at `at` by adding `at` to their starts.
 */
export function copyRange<Item extends { value: ClipValue }>(
  items: readonly Item[],
  from: number,
  to: number,
  limits: Pick<ClipLimits, "duration">
): Item[] {
  const parts: Item[] = [];
  for (const item of items) {
    const part = clipPart(item.value, from, to, limits);
    if (part) {
      parts.push({ ...item, value: { ...part, start: part.start - from } });
    }
  }
  return parts;
}

/**
 * Takes the stretch from `from` to `to` out of the timeline: what is in it
 * goes, and everything after it moves back to close the gap. A clip across
 * it keeps its two ends, which then meet; `split` makes the second piece's
 * item from the first's, as with `coverClips`.
 */
export function removeTime<Item extends { value: ClipValue }>(
  items: readonly Item[],
  from: number,
  to: number,
  limits: Pick<ClipLimits, "duration">,
  split: (item: Item, value: ClipValue) => Item
): Item[] {
  const gap = to - from;
  if (!(gap > 0)) {
    return [...items];
  }
  const span = { fadeIn: 0, fadeOut: 0, length: gap, offset: 0, start: from };
  return coverClips(items, span, limits, split).map((item) =>
    item.value.start >= to
      ? { ...item, value: { ...item.value, start: item.value.start - gap } }
      : item
  );
}

/**
 * Opens a stretch `length` long at `at`: everything from there moves later,
 * and a clip across `at` is cut in two around the gap. What would then run
 * past the end of the timeline is cut off there, or dropped.
 */
export function insertTime<Item extends { value: ClipValue }>(
  items: readonly Item[],
  at: number,
  length: number,
  limits: Pick<ClipLimits, "duration">,
  split: (item: Item, value: ClipValue) => Item
): Item[] {
  if (!(length > 0)) {
    return [...items];
  }
  const loose = { duration: limits.duration, minLength: 0 };
  const later = (item: Item, value: ClipValue): Item[] => {
    const start = value.start + length;
    if (start >= limits.duration) {
      return [];
    }
    const moved = { ...value, start };
    return [
      {
        ...item,
        value:
          clipEnd(moved) > limits.duration
            ? trimClipEnd(moved, limits.duration, loose)
            : moved,
      },
    ];
  };
  return items.flatMap((item) => {
    const { value } = item;
    if (clipEnd(value) <= at) {
      return [item];
    }
    if (value.start >= at) {
      return later(item, value);
    }
    const cut = splitClip(value, at);
    if (!cut) {
      return [item];
    }
    const [left, right] = cut;
    return [{ ...item, value: left }, ...later(split(item, right), right)];
  });
}
