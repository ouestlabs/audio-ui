import { fadeGain } from "../../primitives/timeline/clip.ts";
import { createWarpReader, type PlayedClip } from "./clip.ts";
import {
  continuesFrom,
  type PlaybackState,
  playbackRuns,
  STOPPED,
} from "./transport.ts";

/** A recording a clip plays, decoded: one array of samples per channel. */
export interface Recording {
  readonly channels: readonly Float32Array[];
  readonly sampleRate: number;
}

/** The recordings a player can read, by id. */
export type Recordings = ReadonlyMap<string, Recording>;

/** How long a stop or a jump fades the sound out, and the sound after a jump in. */
export const DECLICK_SECONDS = 0.002;

/** A sample at a fractional index, through a 4-point cubic (Catmull-Rom); outside the recording it is silence. */
function interpolate(data: Float32Array, at: number): number {
  const index = Math.floor(at);
  const t = at - index;
  const y0 = data[index - 1] ?? 0;
  const y1 = data[index] ?? 0;
  const y2 = data[index + 1] ?? 0;
  const y3 = data[index + 2] ?? 0;
  const c1 = 0.5 * (y2 - y0);
  const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
  return ((c3 * t + c2) * t + c1) * t + y1;
}

/** The clip's own frame at the arrangement's frame `frame`, folded into its loop once it passes the loop's end. */
function ownFrame(clip: PlayedClip, frame: number): number {
  const own = frame + clip.shift;
  const { loop } = clip;
  if (!loop || own < loop[1]) {
    return own;
  }
  return loop[0] + ((own - loop[0]) % (loop[1] - loop[0]));
}

/** The clip's gain at the arrangement's frame `frame`: its gain, through its fades. */
function gainAt(clip: PlayedClip, frame: number): number {
  let { gain } = clip;
  const fromStart = frame - clip.start;
  if (fromStart < clip.fadeIn) {
    gain *= fadeGain(clip.fadeInShape, fromStart / clip.fadeIn);
  }
  const toEnd = clip.end - frame;
  if (toEnd <= clip.fadeOut) {
    gain *= fadeGain(clip.fadeOutShape, toEnd / clip.fadeOut);
  }
  return gain;
}

/**
 * Where in the recording the clip reads its own frame `read`, in frames of the
 * recording: a whole frame at speed 1 on the engine's sample rate, a
 * fractional one when it is warped or the recording is at another rate.
 */
function locator(
  clip: PlayedClip,
  recording: Recording,
  sampleRate: number
): (read: number) => number {
  const rate = recording.sampleRate;
  if (clip.warp === null && rate === sampleRate) {
    const first = Math.round(clip.sourceFrom * rate);
    return (read) => first + read;
  }
  const unwarp = clip.warp ? createWarpReader(clip.warp) : null;
  const first = clip.sourceFrom * rate;
  return (read) =>
    first + (unwarp ? unwarp(read / sampleRate) : read / sampleRate) * rate;
}

/**
 * Adds what `clip` plays over `length` frames of the arrangement from
 * `position` into `output` from index `at`. At speed 1, on the engine's
 * sample rate, it copies the recording's frames as they are; warped, or from
 * a recording at another rate, it reads them through the interpolator.
 */
function renderClip(
  output: readonly Float32Array[],
  at: number,
  length: number,
  position: number,
  clip: PlayedClip,
  recording: Recording,
  sampleRate: number
) {
  const from = Math.max(position, clip.start);
  const to = Math.min(position + length, clip.end);
  const [left, right = left] = recording.channels;
  const [outLeft, outRight] = output;
  if (from >= to || !left || !right || !outLeft) {
    return;
  }
  const exact = clip.warp === null && recording.sampleRate === sampleRate;
  const sample = (data: Float32Array, source: number) =>
    exact ? (data[source] ?? 0) : interpolate(data, source);
  const locate = locator(clip, recording, sampleRate);
  for (let frame = from; frame < to; frame += 1) {
    const own = ownFrame(clip, frame);
    const read = clip.reversed ? clip.span - 1 - own : own;
    if (read >= 0 && read < clip.span) {
      const index = at + frame - position;
      const gain = gainAt(clip, frame);
      const source = locate(read);
      outLeft[index] = (outLeft[index] as number) + sample(left, source) * gain;
      if (outRight) {
        outRight[index] =
          (outRight[index] as number) + sample(right, source) * gain;
      }
    }
  }
}

/**
 * Adds what `clips` play over `length` frames of the arrangement from
 * `position` into `output`, from index `at`. A clip whose recording is not
 * there plays silence.
 */
export function renderClips(
  output: readonly Float32Array[],
  at: number,
  length: number,
  position: number,
  clips: readonly PlayedClip[],
  recordings: Recordings,
  sampleRate: number
): void {
  const end = position + length;
  for (const clip of clips) {
    if (clip.start >= end) {
      break;
    }
    const recording = recordings.get(clip.recording);
    if (clip.end > position && recording) {
      renderClip(output, at, length, position, clip, recording, sampleRate);
    }
  }
}

/** Zeroes `buffers` over `[at, at + length)`. */
function clear(buffers: Float32Array[], at: number, length: number) {
  for (const buffer of buffers) {
    buffer.fill(0, at, at + length);
  }
}

/**
 * What one track plays, block after block: its clips, through the states of
 * the transport it is given, each from its own frame of the audio clock. It
 * is the whole of a track's player but the audio thread: an AudioWorklet calls
 * `render` with each block's `currentFrame`, a test with any frames it likes.
 *
 * A state that arrives late takes over at once, and still plays the frames
 * its own clock says (a track that heard of a play a block late joins it in
 * step, a block in). A stop or a jump fades what was playing out over
 * `DECLICK_SECONDS`, and after a jump the new place fades in over the same
 * time; a start from a stop does not, so playing from a stop stays neutral.
 */
export class TrackRenderer {
  private clips: PlayedClip[] = [];
  private readonly declick: number;
  /** When the current state fades in after a jump: its first frame of the audio clock. */
  private fadeInFrom: number | null = null;
  private readonly queue: PlaybackState[] = [];
  private readonly recordings: Recordings;
  private readonly sampleRate: number;
  private scratch: Float32Array[] = [
    new Float32Array(128),
    new Float32Array(128),
  ];
  private current: PlaybackState = STOPPED;
  /** What was playing before a stop or a jump, fading out from a frame of the audio clock. */
  private tail: { from: number; state: PlaybackState } | null = null;

  constructor(sampleRate: number, recordings: Recordings) {
    this.sampleRate = sampleRate;
    this.recordings = recordings;
    this.declick = Math.max(1, Math.round(DECLICK_SECONDS * sampleRate));
  }

  /** The clips it plays from the next block on, in any order. */
  setClips(clips: readonly PlayedClip[]): void {
    this.clips = [...clips].sort((a, b) => a.start - b.start);
  }

  /** A state of the transport, to take over at its `at`; one at the same frame as a queued one replaces it. */
  schedule(state: PlaybackState): void {
    const index = this.queue.findIndex((queued) => queued.at >= state.at);
    if (index === -1) {
      this.queue.push(state);
    } else if ((this.queue[index] as PlaybackState).at === state.at) {
      this.queue[index] = state;
    } else {
      this.queue.splice(index, 0, state);
    }
  }

  /** The state in force at the last frame rendered. */
  get state(): PlaybackState {
    return this.current;
  }

  /** Adds `count` frames from the audio clock's `frame` into `output`. */
  render(output: Float32Array[], frame: number, count: number): void {
    const [scratch] = this.scratch;
    if (scratch && scratch.length < count) {
      this.scratch = [new Float32Array(count), new Float32Array(count)];
    }
    let done = 0;
    while (done < count) {
      const now = frame + done;
      let [next] = this.queue;
      while (next && next.at <= now) {
        this.enter(next, now);
        this.queue.shift();
        [next] = this.queue;
      }
      const until = next ? Math.min(count, next.at - frame) : count;
      this.renderSpan(output, frame, done, until - done);
      done = until;
    }
  }

  private enter(next: PlaybackState, now: number) {
    const before = this.current;
    const broken = before.playing && !continuesFrom(before, next);
    // A change that carries on (a new loop around the playhead) keeps any fade under way.
    if (broken) {
      this.tail = { from: now, state: before };
      this.fadeInFrom = next.playing ? now : null;
    } else if (!next.playing) {
      this.fadeInFrom = null;
    }
    this.current = next;
  }

  /** Renders `state` over `length` frames from index `at` (the audio clock's `frame + at`) into `target`. */
  private renderState(
    state: PlaybackState,
    target: readonly Float32Array[],
    frame: number,
    at: number,
    length: number
  ) {
    for (const run of playbackRuns(state, frame + at, length)) {
      renderClips(
        target,
        at + run.offset,
        run.length,
        run.position,
        this.clips,
        this.recordings,
        this.sampleRate
      );
    }
  }

  /** Renders `state` into the scratch over a span, then adds it into `output` through `ramp`. */
  private renderRamped(
    state: PlaybackState,
    output: Float32Array[],
    frame: number,
    at: number,
    length: number,
    ramp: (clockFrame: number) => number
  ) {
    clear(this.scratch, at, length);
    this.renderState(state, this.scratch, frame, at, length);
    for (const [channel, buffer] of output.entries()) {
      const scratch = this.scratch[channel] ?? this.scratch[0];
      if (!scratch) {
        continue;
      }
      for (let index = at; index < at + length; index += 1) {
        buffer[index] =
          (buffer[index] as number) +
          (scratch[index] as number) * ramp(frame + index);
      }
    }
  }

  private renderSpan(
    output: Float32Array[],
    frame: number,
    at: number,
    length: number
  ) {
    const start = frame + at;
    const end = start + length;
    const { declick, fadeInFrom, tail } = this;
    if (this.current.playing) {
      const fadeEnd = fadeInFrom === null ? start : fadeInFrom + declick;
      const ramped = Math.max(0, Math.min(end, fadeEnd) - start);
      if (ramped > 0 && fadeInFrom !== null) {
        this.renderRamped(
          this.current,
          output,
          frame,
          at,
          ramped,
          (clock) => (clock - fadeInFrom) / declick
        );
      }
      if (fadeInFrom !== null && end >= fadeEnd) {
        this.fadeInFrom = null;
      }
      if (ramped < length) {
        this.renderState(
          this.current,
          output,
          frame,
          at + ramped,
          length - ramped
        );
      }
    }
    if (tail) {
      const fadeEnd = tail.from + declick;
      const faded = Math.max(0, Math.min(end, fadeEnd) - start);
      if (faded > 0) {
        this.renderRamped(
          tail.state,
          output,
          frame,
          at,
          faded,
          (clock) => 1 - (clock - tail.from) / declick
        );
      }
      if (end >= fadeEnd) {
        this.tail = null;
      }
    }
  }
}
