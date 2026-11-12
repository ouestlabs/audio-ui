/**
 * The pure parts of editing one sound on a track of an arrangement: taking
 * time out, the crossfade at its seam, the fades and level of a stretch, and
 * what a key press is for. `use-clip-edits` puts them behind the keyboard and
 * the menus.
 */
import type { FadeShape } from "@audio-ui/react";
import type { Arranged } from "@/registry-audio/bases/base/lib/arrangement";
import type { ArrangementCommand } from "@/registry-audio/bases/base/lib/arrangement-state";

/** The crossfade of an edit's seam: half of it each side of the cut, in seconds. */
export const SPLICE = 0.005;

/** How near an edge a pause has to start or end to be the silence at the start or the end of the sound, in seconds. */
export const EDGE_EPS = 0.01;

/** The length a shrunk pause keeps, in seconds, as audio.js's `shrink` does by default. */
export const SHRINK_GAP = 0.3;

/** The lengths a pause can be shrunk to: 0 takes it out whole. */
export const SHRINK_GAPS = [0, 0.1, 0.3, 0.5] as const;

/** How far Louder and Quieter move the selection's level, in dB. */
export const LEVEL_NUDGE = 3;

/** A selection's level range, in dB: silence at the bottom, a boost of 6 dB at the top. */
export const MIN_DB = -60;
export const MAX_DB = 6;

/** Whether a key went to a field you type in, where its keys are its own. */
export function typing(target: EventTarget | null) {
  return (
    (target instanceof HTMLInputElement && target.type !== "range") ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/** Taking the time from `from` to `to` out, the time after it moving in: nothing when it is empty. */
export const removing = (from: number, to: number): ArrangementCommand[] =>
  to > from ? [{ from, to, type: "remove-time" }] : [];

/** The crossfade of an edit's seam at `at`, in a sound `length` long: the clip that ends there and the one that starts there play through each other. None at either end. */
export const splice = (
  track: string,
  at: number,
  length: number
): ArrangementCommand[] =>
  at > 0 && at < length
    ? [
        {
          time: { range: [at - SPLICE, at + SPLICE], tracks: [track] },
          type: "fade-time",
        },
      ]
    : [];

/** What fades and level on a selection set: the fades at its two ends, their curves, and its level in dB. */
export interface StretchShape {
  fadeIn: number;
  fadeInShape: FadeShape;
  fadeOut: number;
  fadeOutShape: FadeShape;
  gain: number;
}

export const FLAT: StretchShape = {
  fadeIn: 0,
  fadeInShape: "linear",
  fadeOut: 0,
  fadeOutShape: "linear",
  gain: 0,
};

export const clipEnd = (clip: Arranged) => clip.value.start + clip.value.length;
/** Two times the same, to the frame. */
export const near = (a: number, b: number) => Math.abs(a - b) < 1e-4;

/** What the selection has now: the shape of the one clip it covers exactly, or none. */
export function shapeOf(
  clips: readonly Arranged[],
  [from, to]: readonly [number, number]
): StretchShape {
  const clip = clips.find(
    (item) => near(item.value.start, from) && near(clipEnd(item), to)
  );
  return clip
    ? {
        fadeIn: clip.value.fadeIn,
        fadeInShape: clip.value.fadeInShape ?? "linear",
        fadeOut: clip.value.fadeOut,
        fadeOutShape: clip.value.fadeOutShape ?? "linear",
        gain: clip.gain ?? 0,
      }
    : FLAT;
}

/** A clip's piece from `from` to `to` on the timeline, the source following, with no fades of its own. */
export function pieceOf(
  clip: Arranged,
  id: string,
  from: number,
  to: number
): Arranged {
  return {
    ...clip,
    id,
    value: {
      ...clip.value,
      fadeIn: 0,
      fadeOut: 0,
      length: to - from,
      offset: clip.value.offset + (from - clip.value.start),
      start: from,
    },
  };
}

/**
 * The track's clips with the stretch from `from` to `to` cut out of them as
 * clips of their own, the shape on those: the fade-in on the first, the
 * fade-out on the last, the level on all. What is outside keeps its fade on
 * its own outer end, and a piece on a clip's own edge keeps its fade there,
 * the crossfade of a seam. The commands that make it, as one step.
 */
export function shapeStretch(
  clips: readonly Arranged[],
  [from, to]: readonly [number, number],
  shape: StretchShape
): ArrangementCommand[] {
  const touched = clips.filter(
    (clip) => clip.value.start < to && clipEnd(clip) > from
  );
  const outside: Arranged[] = [];
  const inside: Arranged[] = [];
  for (const clip of touched) {
    const { start } = clip.value;
    const end = clipEnd(clip);
    const a = Math.max(start, from);
    const b = Math.min(end, to);
    if (start < from) {
      outside.push({
        ...pieceOf(clip, clip.id, start, from),
        value: {
          ...pieceOf(clip, clip.id, start, from).value,
          fadeIn: Math.min(clip.value.fadeIn, from - start),
        },
      });
    }
    const piece = pieceOf(
      clip,
      start < from ? `${clip.id}@${a}` : clip.id,
      a,
      b
    );
    // A clip's own edge keeps its fade: the crossfade of a seam there.
    inside.push({
      ...piece,
      value: {
        ...piece.value,
        fadeIn: a === start ? clip.value.fadeIn : 0,
        fadeOut: b === end ? clip.value.fadeOut : 0,
      },
    });
    if (end > to) {
      const after = pieceOf(clip, `${clip.id}@${to}`, to, end);
      outside.push({
        ...after,
        value: {
          ...after.value,
          fadeOut: Math.min(clip.value.fadeOut, end - to),
        },
      });
    }
  }
  const last = inside.length - 1;
  // The selection's own fades on its two ends, when it has them; elsewhere, what the pieces keep of their clips'.
  const ownIn = (index: number) => index === 0 && shape.fadeIn > 0;
  const ownOut = (index: number) => index === last && shape.fadeOut > 0;
  const shaped = inside.map((clip, index) => ({
    ...clip,
    gain: shape.gain,
    value: {
      ...clip.value,
      fadeIn: ownIn(index)
        ? Math.min(shape.fadeIn, clip.value.length)
        : clip.value.fadeIn,
      fadeInShape: ownIn(index) ? shape.fadeInShape : clip.value.fadeInShape,
      fadeOut: ownOut(index)
        ? Math.min(shape.fadeOut, clip.value.length)
        : clip.value.fadeOut,
      fadeOutShape: ownOut(index)
        ? shape.fadeOutShape
        : clip.value.fadeOutShape,
    },
  }));
  return [
    ...touched.map((clip) => ({ id: clip.id, type: "remove-clip" as const })),
    ...[...outside, ...shaped].map((clip) => ({
      clip,
      type: "add-clip" as const,
    })),
  ];
}
