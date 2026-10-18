import { type Breakpoint, levelAt } from "@audio-ui/core/envelope";
import type { Note } from "@audio-ui/core/piano-roll";
import { type WarpMarker, warpedTime } from "@audio-ui/core/time";
import type { ClipValue } from "@audio-ui/react";

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
  /** What its header sets: a track that has none plays at unity. Undo takes it back, and a duplicate of the track keeps it. */
  mix?: Mix;
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

/** What a track's header shows: its mix, over unity, with the track's own color. */
export function mixOf(track: ArrangementTrack): Mix {
  return { ...UNITY_MIX, ...track.mix, color: track.color };
}

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
