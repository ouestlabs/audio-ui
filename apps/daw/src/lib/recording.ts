import type { Note } from "@audio-ui/core/piano-roll";
import {
  type Arranged,
  withEdgeFades,
} from "@/lib/arrangement";

/** What came in from an input, block by block: each block's first frame on the audio clock, and its channels. */
export interface RecordedBlock {
  channels: readonly Float32Array[];
  frame: number;
}

/**
 * Where on the audio clock a take's sound was played: `from` and `to` on the
 * arrangement, in seconds, while playback ran from `playFrom` at clock frame
 * `playAt`. What came in at a clock frame was played `latency` seconds
 * earlier (the input's and the output's, REC-008), so the frames are that
 * much later.
 */
export function takeFrames({
  from,
  latency,
  playAt,
  playFrom,
  sampleRate,
  to,
}: {
  from: number;
  latency: number;
  playAt: number;
  playFrom: number;
  sampleRate: number;
  to: number;
}): readonly [number, number] {
  const frameOf = (time: number) =>
    playAt + Math.round((time - playFrom + latency) * sampleRate);
  return [frameOf(from), frameOf(Math.max(from, to))];
}

/** The frames `[from, to)` of the clock out of `blocks`, as one channel array each: silence where no block came in. */
export function sliceBlocks(
  blocks: readonly RecordedBlock[],
  [from, to]: readonly [number, number],
  channelCount: number
): Float32Array[] {
  const length = Math.max(0, to - from);
  const channels = Array.from(
    { length: channelCount },
    () => new Float32Array(length)
  );
  for (const block of blocks) {
    const blockLength = block.channels[0]?.length ?? 0;
    const start = Math.max(from, block.frame);
    const end = Math.min(to, block.frame + blockLength);
    if (start >= end) {
      continue;
    }
    for (const [index, channel] of channels.entries()) {
      const source = block.channels[index] ?? block.channels[0];
      if (source) {
        channel.set(
          source.subarray(start - block.frame, end - block.frame),
          start - from
        );
      }
    }
  }
  return channels;
}

/** The clip an audio take becomes: from where it started, as long as it lasted, over what lies under it. */
export function audioTakeClip({
  id,
  length,
  name,
  recording,
  start,
  track,
}: {
  id: string;
  length: number;
  name: string;
  recording: string;
  start: number;
  track: string;
}): Arranged {
  return {
    id,
    name,
    recording,
    sourceLength: length,
    track,
    value: withEdgeFades({ length, offset: 0, start }),
  };
}

/** A note played while recording, on the arrangement: where it started and ended, in seconds. A note still held has no end. */
export interface PlayedNote {
  end?: number;
  pitch: number;
  start: number;
  /** 0…1. */
  velocity: number;
}

/** The record quantizations: none, or a note value as a share of a whole note. */
export const RECORD_QUANTIZE = [0, 1 / 4, 1 / 8, 1 / 16, 1 / 32] as const;

/**
 * The notes of a MIDI take between `from` and `to`, in seconds from `origin`:
 * each as long as it was held (to `to` when it is still held), its start moved
 * to the nearest `quantize` seconds from `origin` when it is not 0 (REC-009).
 */
export function takeNotes(
  played: readonly PlayedNote[],
  {
    from,
    idPrefix,
    origin,
    quantize = 0,
    to,
  }: {
    from: number;
    idPrefix: string;
    origin: number;
    quantize?: number;
    to: number;
  }
): Note[] {
  const notes: Note[] = [];
  for (const [index, note] of played.entries()) {
    const end = Math.min(note.end ?? to, to);
    if (note.start >= to || end <= from) {
      continue;
    }
    const begin = Math.max(note.start, from);
    const placed =
      quantize > 0
        ? origin + Math.round((begin - origin) / quantize) * quantize
        : begin;
    notes.push({
      id: `${idPrefix}-${index + 1}`,
      length: Math.max(1e-3, end - begin),
      pitch: note.pitch,
      start: placed - origin,
      velocity: note.velocity,
    });
  }
  return notes;
}

/** The MIDI clip a take becomes, from `from` to `to` on the arrangement, over what lies under it. */
export function midiTakeClip({
  from,
  id,
  name,
  played,
  quantize,
  to,
  track,
}: {
  from: number;
  id: string;
  name: string;
  played: readonly PlayedNote[];
  quantize?: number;
  to: number;
  track: string;
}): Arranged {
  const length = Math.max(0, to - from);
  return {
    id,
    name,
    notes: takeNotes(played, {
      from,
      idPrefix: id,
      origin: from,
      quantize,
      to,
    }),
    sourceLength: length,
    track,
    value: { fadeIn: 0, fadeOut: 0, length, offset: 0, start: from },
  };
}

/**
 * A MIDI clip with a take's notes added to its own (Overdub on, REC-009):
 * placed in its source's time, so they sound where they were played.
 */
export function overdubbed(
  clip: Arranged,
  played: readonly PlayedNote[],
  {
    from,
    quantize,
    to,
  }: {
    from: number;
    quantize?: number;
    to: number;
  }
): Arranged {
  const origin = clip.value.start - clip.value.offset;
  const taken = Math.max(clip.value.start, from);
  const added = takeNotes(played, {
    from: taken,
    idPrefix: `${clip.id}-take-${(clip.notes ?? []).length}`,
    origin,
    quantize,
    to: Math.min(to, clip.value.start + clip.value.length),
  });
  return { ...clip, notes: [...(clip.notes ?? []), ...added] };
}