import {
  type ClipValue,
  copyRange,
  coverClips,
  insertTime,
  removeTime,
} from "@audio-ui/react";

/** A clip laid on a track of an arrangement. */
export interface Arranged {
  /** A clip switched off stays on the page, drained, and is not heard. */
  disabled?: boolean;
  id: string;
  name: string;
  /** How long the recording behind the clip is: trimming stops where it runs out. */
  sourceLength: number;
  /** The id of the track it lies on. */
  track: string;
  /** Where the clip sits, how much of its source it plays, and its fades. */
  value: ClipValue;
}

/** A track of an arrangement. */
export interface ArrangementTrack {
  /** An index into the colors a track can take. */
  color: number;
  id: string;
  name: string;
}

/** What a track's header sets: how loud it is, where it sits in the stereo field, and whether it is silenced or soloed. */
export interface Mix {
  /** An index into the colors a track can take. */
  color: number;
  gain: number;
  muted: boolean;
  /** From -1 (left) to 1 (right). */
  pan: number;
  soloed: boolean;
}

export const UNITY_MIX: Mix = {
  color: 0,
  gain: 1,
  muted: false,
  pan: 0,
  soloed: false,
};

let pieceCount = 0;

/** A new id for a piece of the clip `id`. */
function pieceId(id: string) {
  pieceCount += 1;
  return `${id}-c${pieceCount}`;
}

/** Makes the second piece of a cut clip from the first, with an id of its own. */
const splitPiece = (item: Arranged, value: ClipValue): Arranged => ({
  ...item,
  id: pieceId(item.id),
  value,
});

/**
 * Lays `placed` on its track: it covers what was under it, as a DAW's does,
 * rather than stacking on it. Pieces cut from a clip it lies inside get ids of
 * their own.
 */
export function lay(
  all: Arranged[],
  placed: Arranged,
  duration: number
): Arranged[] {
  const others = all.filter((clip) => clip.id !== placed.id);
  const onTrack = others.filter((clip) => clip.track === placed.track);
  const elsewhere = others.filter((clip) => clip.track !== placed.track);
  const covered = coverClips(
    onTrack,
    placed.value,
    { duration, sourceLength: placed.sourceLength },
    splitPiece
  );
  return [...elsewhere, ...covered, placed];
}

/** The track `shift` tracks away in `order`, kept on the arrangement. */
export function shiftTrack(
  order: readonly string[],
  track: string,
  shift: number
): string {
  const target = Math.min(
    order.length - 1,
    Math.max(0, order.indexOf(track) + shift)
  );
  return order[target] ?? track;
}

/** The rest of a selection that holds `id`: what a drop with no sideways move has no change event to have noted. */
export function otherSelected(selected: string[], id: string): string[] {
  return selected.length > 1 && selected.includes(id)
    ? selected.filter((other) => other !== id)
    : [];
}

export interface Landing {
  /** The ids the copies of the originals take. */
  copyIds: string[];
  duration: number;
  /** The other clips of a dragged group. */
  group: string[];
  /** The clip that was dragged. */
  id: string;
  /** The track ids, top to bottom. */
  order: readonly string[];
  /** The originals of a copy drag, which stay where they were. */
  origins: Arranged[];
  /** The track the clip was dropped on, if it left its own. */
  track: string | undefined;
}

/**
 * Lays down what a drag moved: the dragged clip and its group land where they
 * were put, covering what they lie over; in a copy drag the originals stay
 * where they were, as copies of their own, under what was moved.
 */
export function land(all: Arranged[], landing: Landing): Arranged[] {
  const { copyIds, duration, group, id, order, origins, track } = landing;
  const current = all.find((clip) => clip.id === id);
  if (!current) {
    return all;
  }
  const placed = track ? { ...current, track } : current;
  const movedIds = new Set([id, ...group]);
  // A group dropped on another track moves by as many tracks as the dragged clip did.
  const shift = track ? order.indexOf(track) - order.indexOf(current.track) : 0;
  const moved = all
    .filter((clip) => movedIds.has(clip.id))
    .map((clip) =>
      clip.id === id
        ? clip
        : { ...clip, track: shiftTrack(order, clip.track, shift) }
    );
  let laid = origins.length
    ? all.filter((clip) => !movedIds.has(clip.id))
    : all;
  laid = origins.reduce(
    (kept, origin, index) =>
      lay(kept, { ...origin, id: copyIds[index] ?? origin.id }, duration),
    laid
  );
  for (const clip of origins.length ? moved : [placed]) {
    laid = lay(laid, clip.id === id ? placed : clip, duration);
  }
  // The rest of a dragged group lands too, covering what it lies over.
  if (!origins.length) {
    for (const other of group) {
      const grouped = moved.find((clip) => clip.id === other);
      if (grouped) {
        laid = lay(laid, grouped, duration);
      }
    }
  }
  return laid;
}

/** A clip's positions and lengths, all in seconds, scaled when the tempo changes. */
export function scaleValue(value: ClipValue, ratio: number): ClipValue {
  return {
    ...value,
    fadeIn: value.fadeIn * ratio,
    fadeOut: value.fadeOut * ratio,
    length: value.length * ratio,
    offset: value.offset * ratio,
    start: value.start * ratio,
  };
}

/** A stretch of time on some tracks: what a drag across bare lanes selects. */
export interface TimeSelection {
  range: readonly [number, number];
  /** The tracks it spans, top to bottom. */
  tracks: string[];
}

/** What a copy holds: how long it is, and the part of each clip in it, from 0, with how many tracks below the first one it came from. */
export interface Clipping {
  length: number;
  parts: (Arranged & { row: number })[];
}

/** The parts of the clips in a stretch of time on some tracks, ready to paste. */
export function copyTime(
  all: Arranged[],
  { range: [from, to], tracks }: TimeSelection,
  order: readonly string[],
  duration: number
): Clipping {
  const rows = tracks.map((track) => order.indexOf(track));
  const first = Math.min(...rows);
  const parts = copyRange(
    all.filter((clip) => tracks.includes(clip.track)),
    from,
    to,
    { duration }
  ).map((part) => ({ ...part, row: order.indexOf(part.track) - first }));
  return { length: to - from, parts };
}

/** The selected clips, whole, ready to paste: their span from the first start to the last end. */
export function copyClips(
  chosen: Arranged[],
  order: readonly string[],
  duration: number
): Clipping {
  if (chosen.length === 0) {
    return { length: 0, parts: [] };
  }
  const from = Math.min(...chosen.map((clip) => clip.value.start));
  const to = Math.max(
    ...chosen.map((clip) => clip.value.start + clip.value.length)
  );
  return copyTime(
    chosen,
    {
      range: [from, to],
      tracks: [...new Set(chosen.map((clip) => clip.track))],
    },
    order,
    duration
  );
}

/** Empties a stretch of time on its tracks: what lies in it goes, the clips across its edges are cut there. */
export function clearTime(
  all: Arranged[],
  { range: [from, to], tracks }: TimeSelection,
  duration: number
): Arranged[] {
  const span = {
    fadeIn: 0,
    fadeOut: 0,
    length: to - from,
    offset: 0,
    start: from,
  };
  const onTracks = all.filter((clip) => tracks.includes(clip.track));
  return [
    ...all.filter((clip) => !tracks.includes(clip.track)),
    ...coverClips(onTracks, span, { duration }, splitPiece),
  ];
}

/**
 * Lays a copy down at `at`, its first row on the track `track` and the rest
 * on the tracks below it (those that would fall off the bottom are left out),
 * covering what is there. Returns the arrangement and the ids of the new clips.
 */
export function pasteTime(
  all: Arranged[],
  clipping: Clipping,
  at: number,
  track: string,
  order: readonly string[],
  duration: number
): { clips: Arranged[]; ids: string[] } {
  const top = order.indexOf(track);
  let laid = all;
  const ids: string[] = [];
  for (const part of clipping.parts) {
    const onto = order[top + part.row];
    const start = at + part.value.start;
    if (!onto || start >= duration) {
      continue;
    }
    const { row: _row, ...clip } = part;
    const length = Math.min(part.value.length, duration - start);
    const placed = {
      ...clip,
      id: pieceId(part.id),
      track: onto,
      value: { ...part.value, length, start },
    };
    ids.push(placed.id);
    laid = lay(laid, placed, duration);
  }
  return { clips: laid, ids };
}

/** Takes a stretch out of every track and closes the gap: what came after it moves back. */
export function deleteTime(
  all: Arranged[],
  from: number,
  to: number,
  duration: number
): Arranged[] {
  return removeTime(all, from, to, { duration }, splitPiece);
}

/** Opens a stretch `length` long at `at` on every track: what came after it moves later. */
export function openTime(
  all: Arranged[],
  at: number,
  length: number,
  duration: number
): Arranged[] {
  return insertTime(all, at, length, { duration }, splitPiece);
}

/**
 * Makes one clip per track of a stretch of time: on each track that has
 * anything in it, a clip spanning the stretch replaces what was there, named
 * after the first clip it takes in.
 */
export function consolidate(
  all: Arranged[],
  selection: TimeSelection,
  duration: number
): { clips: Arranged[]; ids: string[] } {
  const [from, to] = selection.range;
  const length = to - from;
  const made = selection.tracks.flatMap((track) => {
    const [first] = all
      .filter(
        (clip) =>
          clip.track === track &&
          clip.value.start < to &&
          clip.value.start + clip.value.length > from
      )
      .sort((a, b) => a.value.start - b.value.start);
    return first
      ? [
          {
            ...first,
            disabled: false,
            id: pieceId(first.id),
            sourceLength: length,
            value: { fadeIn: 0, fadeOut: 0, length, offset: 0, start: from },
          },
        ]
      : [];
  });
  const cleared = clearTime(all, selection, duration);
  return { clips: [...cleared, ...made], ids: made.map((clip) => clip.id) };
}

/** How close two edges are to count as touching, in the timeline's units. */
const TOUCHING = 1e-6;

/**
 * Gives the clip `id`'s fade at `edge` to the clip it touches there, on its
 * track: the fade-out of the clip that ends where it starts, or the fade-in
 * of the clip that starts where it ends, as long as it can be. Two clips that
 * meet then fade across their meeting point together.
 */
export function crossfade(
  all: Arranged[],
  id: string,
  edge: "in" | "out"
): Arranged[] {
  const clip = all.find((item) => item.id === id);
  if (!clip) {
    return all;
  }
  const { fadeIn, fadeOut, length, start } = clip.value;
  const meeting = edge === "in" ? start : start + length;
  const fade = edge === "in" ? fadeIn : fadeOut;
  return all.map((other) => {
    if (other.id === id || other.track !== clip.track) {
      return other;
    }
    const { value } = other;
    if (
      edge === "in" &&
      Math.abs(value.start + value.length - meeting) < TOUCHING
    ) {
      const fadeOutLength = Math.min(fade, value.length - value.fadeIn);
      return { ...other, value: { ...value, fadeOut: fadeOutLength } };
    }
    if (edge === "out" && Math.abs(value.start - meeting) < TOUCHING) {
      const fadeInLength = Math.min(fade, value.length - value.fadeOut);
      return { ...other, value: { ...value, fadeIn: fadeInLength } };
    }
    return other;
  });
}

/**
 * Fades made from a stretch of time on its tracks: a clip whose start it
 * covers fades in up to where the stretch ends (or the clip does), and one
 * whose end it covers fades out from where it begins. Across two clips that
 * meet, that is a crossfade.
 */
export function fadeTime(
  all: Arranged[],
  { range: [from, to], tracks }: TimeSelection
): Arranged[] {
  return all.map((clip) => {
    if (!tracks.includes(clip.track)) {
      return clip;
    }
    const { length, start } = clip.value;
    const end = start + length;
    let { fadeIn, fadeOut } = clip.value;
    if (from <= start && start < to) {
      fadeIn = Math.min(to, end) - start;
    }
    if (from < end && end <= to) {
      fadeOut = end - Math.max(from, start);
    }
    // Both from one stretch over a whole clip: they share its length.
    if (fadeIn + fadeOut > length) {
      const scale = length / (fadeIn + fadeOut);
      fadeIn *= scale;
      fadeOut *= scale;
    }
    return fadeIn === clip.value.fadeIn && fadeOut === clip.value.fadeOut
      ? clip
      : { ...clip, value: { ...clip.value, fadeIn, fadeOut } };
  });
}
