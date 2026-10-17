import { type Breakpoint, levelAt } from "@audio-ui/core/envelope";
import type { Note } from "@audio-ui/core/piano-roll";
import { type WarpMarker, warpedTime } from "@audio-ui/core/time";
import {
  type ClipValue,
  copyRange,
  coverClips,
  insertTime,
  removeTime,
} from "@audio-ui/react";

/** What a clip's menu does to it. */
export type ClipAction =
  | "duplicate"
  | "edit"
  | "remove"
  | "rename"
  | "split"
  | "toggle";

/** A clip laid on a track of an arrangement. */
export interface Arranged {
  /** A clip switched off stays on the page, drained, and is not heard. */
  disabled?: boolean;
  /** How much louder or quieter it plays, in dB. @default 0 */
  gain?: number;
  id: string;
  /**
   * A stretch of the source, `[start, end]` in the source's own time, that
   * repeats for as long as the clip lasts: a looped clip can be longer than
   * its source.
   */
  loop?: readonly [number, number];
  name: string;
  /**
   * A MIDI clip's notes, in its source's time: a note's `start` is seconds
   * from where the source begins, as an audio clip's offset is, so trimming
   * or moving the clip leaves each note where it was in the source.
   */
  notes?: readonly Note[];
  /** Whether its source plays backwards. */
  reversed?: boolean;
  /** Where its source begins in the recording it was cut from, once cropped. @default 0 */
  sourceFrom?: number;
  /** How long the recording behind the clip is: trimming stops where it runs out. */
  sourceLength: number;
  /** The id of the track it lies on. */
  track: string;
  /** How far it is transposed, in semitones. @default 0 */
  transpose?: number;
  /** Where the clip sits, how much of its source it plays, and its fades. */
  value: ClipValue;
  /**
   * Markers pinning times in the source to times on the clip: the source is
   * stretched between them, and the clip's other times (where it starts in
   * its source, its loop) are on the clip.
   */
  warp?: readonly WarpMarker[];
}

/** What a track holds: recordings, or notes for an instrument to play. */
export type TrackKind = "audio" | "midi";

/** What a track's automation can move: its volume, or where it sits in the stereo field. */
export type AutomatedParameter = "pan" | "volume";

/**
 * A track's automation: for each parameter it moves, the points of its
 * envelope across the whole arrangement, `x` from its start (0) to its end
 * (1) and `y` the parameter's value from 0 to 1, with the curve of the
 * segment leaving each point. Being shares of the song, the points keep
 * their musical place when the tempo changes.
 */
export type TrackAutomation = Partial<
  Record<AutomatedParameter, readonly Breakpoint[]>
>;

/** A track of an arrangement. */
export interface ArrangementTrack {
  /** Its automation, by parameter. */
  automation?: TrackAutomation;
  /** An index into the colors a track can take. */
  color: number;
  id: string;
  /** @default "audio" */
  kind?: TrackKind;
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

/**
 * How far a clip can be stretched on the timeline: `undefined` when it loops,
 * since it has no end then, as far as its warp stretches its source when it
 * is warped, otherwise the length of its source.
 */
export function clipReach(clip: Arranged): number | undefined {
  if (clip.loop) {
    return;
  }
  return clip.warp
    ? warpedTime(clip.warp, clip.sourceLength)
    : clip.sourceLength;
}

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
 * their own. Covering only shortens a clip, so the reach of `placed` has no
 * say in what is left of the others.
 */
export function lay(
  all: Arranged[],
  placed: Arranged,
  duration: number
): Arranged[] {
  const others = all.filter((clip) => clip.id !== placed.id);
  const onTrack = others.filter((clip) => clip.track === placed.track);
  const elsewhere = others.filter((clip) => clip.track !== placed.track);
  const covered = coverClips(onTrack, placed.value, { duration }, splitPiece);
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

/**
 * A clip at a new tempo, `ratio` times as long: where it sits and its source.
 * A MIDI clip's notes and loop are in beats at heart, so they follow the
 * tempo too; a recording's loop stays where it is in the recording.
 */
export function scaleClip(clip: Arranged, ratio: number): Arranged {
  const scaled: Arranged = {
    ...clip,
    sourceLength: clip.sourceLength * ratio,
    value: scaleValue(clip.value, ratio),
  };
  if (!clip.notes) {
    return scaled;
  }
  return {
    ...scaled,
    loop: clip.loop && [clip.loop[0] * ratio, clip.loop[1] * ratio],
    notes: clip.notes.map((note) => ({
      ...note,
      length: note.length * ratio,
      start: note.start * ratio,
    })),
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

/**
 * Cuts a clip's source down to what it plays: the loop when it has one, else
 * the stretch from where it starts to where it ends. The clip sounds the same,
 * and its source no longer holds what it never reached.
 */
export function cropClip(clip: Arranged): Arranged {
  const [from, to] = clip.loop ?? [
    clip.value.offset,
    clip.value.offset + clip.value.length,
  ];
  return {
    ...clip,
    loop: clip.loop ? [0, to - from] : undefined,
    sourceFrom: (clip.sourceFrom ?? 0) + from,
    sourceLength: to - from,
    value: { ...clip.value, offset: Math.max(0, clip.value.offset - from) },
  };
}

/** Where a note of a MIDI clip plays in the arrangement, transposed with the clip. */
export interface PlayedNote extends Note {
  /** The id of the note in the clip's source, which a looped clip plays more than once. */
  sourceId: Note["id"];
}

/**
 * The notes a MIDI clip plays, where they play in the arrangement: the ones
 * starting inside it, from where it starts in its source, and round its loop
 * again and again when it has one. A note runs to the clip's end at most,
 * and is transposed as the clip is. Each gets an id of its own, since a loop
 * plays a note more than once.
 */
export function playedNotes(clip: Arranged): PlayedNote[] {
  const notes = clip.notes ?? [];
  const { length, offset, start } = clip.value;
  const end = start + length;
  const transpose = clip.transpose ?? 0;
  const played: PlayedNote[] = [];
  const place = (from: number, to: number, shift: number) => {
    for (const note of notes) {
      const at = note.start + shift;
      if (note.start < from || note.start >= to || at >= end) {
        continue;
      }
      played.push({
        ...note,
        id: `${note.id}@${at}`,
        length: Math.min(note.length, end - at),
        pitch: note.pitch + transpose,
        sourceId: note.id,
        start: at,
      });
    }
  };
  if (!clip.loop) {
    place(offset, offset + length, start - offset);
    return played;
  }
  const [loopStart, loopEnd] = clip.loop;
  const span = loopEnd - loopStart;
  // The first pass plays from the offset to the loop's end, then the loop repeats.
  place(offset, loopEnd, start - offset);
  if (span > 0) {
    for (let pass = start + loopEnd - offset; pass < end; pass += span) {
      place(loopStart, loopEnd, pass - loopStart);
    }
  }
  return played;
}

/** The quietest a volume envelope reaches before silence, in dB, and its loudest. */
const VOLUME_FLOOR_DB = -60;
const VOLUME_CEILING_DB = 6;

/** A volume envelope's value, 0…1, as a gain: 0 is silence, then -60 dB up to +6 dB along the way. */
export function volumeGain(value: number): number {
  if (value <= 0) {
    return 0;
  }
  const db =
    VOLUME_FLOOR_DB +
    Math.min(1, value) * (VOLUME_CEILING_DB - VOLUME_FLOOR_DB);
  return 10 ** (db / 20);
}

/** The volume envelope's value, 0…1, that plays at `gain`: unity is 0 dB. */
export function volumeValue(gain: number): number {
  if (gain <= 0) {
    return 0;
  }
  const db = 20 * Math.log10(gain);
  return Math.min(
    1,
    Math.max(0, (db - VOLUME_FLOOR_DB) / (VOLUME_CEILING_DB - VOLUME_FLOOR_DB))
  );
}

/** A pan envelope's value, 0…1, as a pan from -1 (left) to 1 (right). */
export const panPosition = (value: number) =>
  Math.min(1, Math.max(-1, value * 2 - 1));

/** Where a parameter's envelope starts when it is first drawn: the mix's value, flat. */
export function flatAutomation(value: number): Breakpoint[] {
  return [
    { x: 0, y: value },
    { x: 1, y: value },
  ];
}

/**
 * An envelope's value at `x`, 0…1 of the arrangement: along the curve of the
 * segment it falls in, the first point's value before it, the last's after.
 */
export function automationAt(points: readonly Breakpoint[], x: number): number {
  const [first] = points;
  if (!first) {
    return 0;
  }
  if (x <= first.x) {
    return first.y;
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index] as Breakpoint;
    const to = points[index + 1] as Breakpoint;
    if (x < to.x) {
      const span = to.x - from.x;
      return span > 0 ? levelAt(from, to, (x - from.x) / span) : to.y;
    }
  }
  return (points.at(-1) as Breakpoint).y;
}

/**
 * A track's gain and pan at `x`, 0…1 of the arrangement: its envelopes where
 * it has them, its mix where it has none or where a change by hand has
 * `overridden` them, until the automation is enabled again.
 */
export function mixAt(
  track: ArrangementTrack,
  mix: Mix,
  x: number,
  overridden: readonly AutomatedParameter[] = []
): { gain: number; pan: number } {
  const followed = (parameter: AutomatedParameter) =>
    overridden.includes(parameter) ? undefined : track.automation?.[parameter];
  const volume = followed("volume");
  const pan = followed("pan");
  return {
    gain: volume ? volumeGain(automationAt(volume, x)) : mix.gain,
    pan: pan ? panPosition(automationAt(pan, x)) : mix.pan,
  };
}
