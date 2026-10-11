import { type ClipValue, coverClips } from "@audio-ui/react";

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
    (item, value) => {
      pieceCount += 1;
      return { ...item, id: `${item.id}-c${pieceCount}`, value };
    }
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
