import { fadeGain } from "@audio-ui/core/timeline";
import {
  createWarpReader,
  type PlayedClip,
  type PlayedStretch,
} from "./clip.ts";
import { type RecordingStream, slotOffset, streamedSample } from "./stream.ts";
import {
  continuesFrom,
  type PlaybackState,
  playbackRuns,
  STOPPED,
} from "./transport.ts";

/** A recording held in memory, decoded: one array of samples per channel. */
export interface DecodedRecording {
  readonly channels: readonly Float32Array[];
  readonly sampleRate: number;
}

/** A recording read from the pages of a stream, which something else keeps filled ahead of playback. */
export interface StreamedRecording {
  readonly sampleRate: number;
  readonly stream: RecordingStream;
}

/** A recording a clip plays: decoded in memory, or streamed. */
export type Recording = DecodedRecording | StreamedRecording;

/** A streamed channel's sample at an index of the recording, fractional when it is interpolated. */
type Sampler = (source: number) => number;

/** The recordings a player can read, by id. */
export type Recordings = ReadonlyMap<string, Recording>;

/** How long a stop or a jump fades the sound out, and the sound after a jump in. */
export const DECLICK_SECONDS = 0.002;

/** The 4-point cubic (Catmull-Rom) through four samples, at `t` between the middle two. */
function cubic(y0: number, y1: number, y2: number, y3: number, t: number) {
  const c1 = 0.5 * (y2 - y0);
  const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
  return ((c3 * t + c2) * t + c1) * t + y1;
}

/** A sample at a fractional index, through the cubic; outside the recording it is silence. */
function interpolate(data: Float32Array, at: number): number {
  const index = Math.floor(at);
  return cubic(
    data[index - 1] ?? 0,
    data[index] ?? 0,
    data[index + 1] ?? 0,
    data[index + 2] ?? 0,
    at - index
  );
}

/** How each channel of a stream is sampled, a mono one in both: a copy of the frame when `exact`, the cubic otherwise. */
function streamSamplers(
  stream: RecordingStream,
  exact: boolean
): readonly [Sampler, Sampler] {
  const { pageFrames, samples } = stream.pool;
  const of = (channel: number): Sampler => {
    const read = (index: number) => streamedSample(stream, channel, index);
    return exact
      ? read
      : (at) => {
          const index = Math.floor(at);
          const page = Math.floor((index - 1) / pageFrames);
          const slot = stream.directory[page] ?? -1;
          // The four points on one page, as they nearly always are: found once.
          if (
            slot >= 0 &&
            index - 1 >= 0 &&
            index + 2 < stream.length &&
            Math.floor((index + 2) / pageFrames) === page
          ) {
            const base =
              slotOffset(stream.pool, slot, channel) +
              index -
              page * pageFrames;
            return cubic(
              samples[base - 1] as number,
              samples[base] as number,
              samples[base + 1] as number,
              samples[base + 2] as number,
              at - index
            );
          }
          return cubic(
            read(index - 1),
            read(index),
            read(index + 1),
            read(index + 2),
            at - index
          );
        };
  };
  return [of(0), of(stream.channels > 1 ? 1 : 0)];
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
  rate: number,
  sampleRate: number
): (read: number) => number {
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
 * Where in its recording `clip` reads at the arrangement's frame `frame`, in
 * frames of the recording (fractional when warped or at another rate), or
 * NaN where it plays nothing: what both the player and the planner of a
 * stream's pages follow. `rate` is the recording's sample rate. A clip that
 * stretches time reads its grain's own stretch.
 */
export function sourceIndexer(
  clip: PlayedClip,
  rate: number,
  sampleRate: number
): (frame: number) => number {
  const locate = locator(clip, rate, sampleRate);
  const { stretch } = clip;
  const step = stretch ? (stretch.speed * rate) / sampleRate : 0;
  return (frame) => {
    const own = ownFrame(clip, frame);
    const read = clip.reversed ? clip.span - 1 - own : own;
    if (!(read >= 0 && read < clip.span)) {
      return Number.NaN;
    }
    if (!stretch) {
      return locate(read);
    }
    const start = Math.floor(read / stretch.hop) * stretch.hop;
    return locate(start) + (read - start) * step;
  };
}

/** How far each way a grain of Tones may move to line up on the last, in seconds: a period of a note down to about 83 Hz. */
const ALIGN_SECONDS = 0.006;
/** How finely it first looks, then looks again around the best, in frames of the recording. */
const COARSE_STEP = 4;
const FINE_REACH = 3;
/** How many points of the sound it compares: what keeps it far inside a render quantum. */
const COMPARE_POINTS = 60;
/** What the grain before reads, kept here so it is read once and nothing is allocated. */
const comparing = new Float32Array(COMPARE_POINTS);

/** Where each of a clip's grains of Tones was moved to line up on the last, in frames of the recording. */
interface Alignment {
  /** The last grain worked out. */
  last: number;
  moved: Float32Array;
}

const alignments = new WeakMap<PlayedClip, Alignment>();

/** Where in its grain each clip works the next one out, as a share of it: spread apart, so clips that start together do not all do it in one block. It changes when the work is done, never what comes out. */
const lookAheadShares = new WeakMap<PlayedClip, number>();
let clipsLookingAhead = 0;
const GOLDEN_SHARE = 0.618_033_988_75;

function lookAheadShare(clip: PlayedClip): number {
  let share = lookAheadShares.get(clip);
  if (share === undefined) {
    clipsLookingAhead += 1;
    share = (clipsLookingAhead * GOLDEN_SHARE) % 1;
    lookAheadShares.set(clip, share);
  }
  return share;
}

/**
 * How far the grain `index` of `clip` moves to line up on the one before it:
 * where what they share matches best, read on whole frames (close enough to
 * line up on, and a quarter of the reads), worked out once, from the grain before
 * it. A jump starts the chain again there, unmoved.
 */
function alignedAt(
  clip: PlayedClip,
  stretch: PlayedStretch,
  index: number,
  locate: (read: number) => number,
  nearest: Sampler,
  step: number,
  rate: number
): number {
  let alignment = alignments.get(clip);
  if (!alignment) {
    alignment = {
      last: -1,
      moved: new Float32Array(Math.ceil(clip.span / stretch.hop) + 2),
    };
    alignments.set(clip, alignment);
  }
  const { moved } = alignment;
  if (index <= alignment.last) {
    return moved[index] ?? 0;
  }
  if (index > alignment.last + 1) {
    // Played from here: the chain starts again.
    moved[index] = 0;
    alignment.last = index;
    return 0;
  }
  const reach = Math.round(ALIGN_SECONDS * rate);
  const before = (moved[index - 1] ?? 0) + locate((index - 1) * stretch.hop);
  const here = locate(index * stretch.hop);
  const { hop } = stretch;
  const spacing = hop / COMPARE_POINTS;
  // They share the stretch before this grain's start, where it crosses in.
  for (let point = 0; point < COMPARE_POINTS; point += 1) {
    comparing[point] = nearest(before + point * spacing * step);
  }
  const score = (shift: number) => {
    let sum = 0;
    for (let point = 0; point < COMPARE_POINTS; point += 1) {
      sum +=
        (comparing[point] as number) *
        nearest(here + shift + (point * spacing - hop) * step);
    }
    return sum;
  };
  let best = 0;
  let bestScore = score(0);
  const look = (from: number, to: number, by: number) => {
    for (let shift = from; shift <= to; shift += by) {
      const value = score(shift);
      if (value > bestScore) {
        bestScore = value;
        best = shift;
      }
    }
  };
  look(-reach, reach, COARSE_STEP);
  look(best - FINE_REACH, best + FINE_REACH, 1);
  moved[index] = best;
  alignment.last = index;
  return best;
}

/**
 * Adds what a clip that stretches time plays over `length` frames from
 * `position`: its grains, each from where the warp places its start at its own
 * speed. The next grain crosses in before its start, so it is at full level
 * from there on: an attack on a slice's start keeps its shape.
 */
function renderStretchedClip(
  output: readonly Float32Array[],
  at: number,
  length: number,
  position: number,
  clip: PlayedClip,
  stretch: PlayedStretch,
  left: Sampler,
  right: Sampler,
  nearest: Sampler,
  rate: number,
  sampleRate: number
) {
  const from = Math.max(position, clip.start);
  const to = Math.min(position + length, clip.end);
  const [outLeft, outRight] = output;
  if (from >= to || !outLeft) {
    return;
  }
  const locate = locator(clip, rate, sampleRate);
  const { fade, hop } = stretch;
  const step = (stretch.speed * rate) / sampleRate;
  const startOf = (index: number) =>
    locate(index * hop) +
    (stretch.aligned
      ? alignedAt(clip, stretch, index, locate, nearest, step, rate)
      : 0);
  const aheadAt = stretch.aligned
    ? lookAheadShare(clip) * hop
    : Number.POSITIVE_INFINITY;
  const add = (out: number, l: number, r: number, gain: number) => {
    outLeft[out] = (outLeft[out] as number) + l * gain;
    if (outRight) {
      outRight[out] = (outRight[out] as number) + r * gain;
    }
  };
  let grain = -1;
  let start = 0;
  let next = 0;
  let ahead = -1;
  for (let frame = from; frame < to; frame += 1) {
    const own = ownFrame(clip, frame);
    const read = clip.reversed ? clip.span - 1 - own : own;
    if (read >= 0 && read < clip.span) {
      const index = Math.floor(read / hop);
      if (index !== grain) {
        grain = index;
        start = startOf(index);
        next = startOf(index + 1);
      }
      const into = read - index * hop;
      if (into >= aheadAt && ahead !== index) {
        ahead = index;
        startOf(index + 2);
      }
      const here = start + into * step;
      let l = left(here);
      let r = right(here);
      const crossing = into - (hop - fade);
      if (crossing >= 0) {
        const rise = crossing / fade;
        const coming = next + (into - hop) * step;
        l = l * (1 - rise) + left(coming) * rise;
        r = r * (1 - rise) + right(coming) * rise;
      }
      add(at + frame - position, l, r, gainAt(clip, frame));
    }
  }
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
  if ("stream" in recording) {
    renderStreamedClip(
      output,
      at,
      length,
      position,
      clip,
      recording,
      sampleRate
    );
    return;
  }
  const from = Math.max(position, clip.start);
  const to = Math.min(position + length, clip.end);
  const [left, right = left] = recording.channels;
  const [outLeft, outRight] = output;
  if (from >= to || !left || !right || !outLeft) {
    return;
  }
  if (clip.stretch) {
    renderStretchedClip(
      output,
      at,
      length,
      position,
      clip,
      clip.stretch,
      (source) => interpolate(left, source),
      (source) => interpolate(right, source),
      (source) => left[Math.round(source)] ?? 0,
      recording.sampleRate,
      sampleRate
    );
    return;
  }
  // The loop of every block, kept as plain array reads: the fast path.
  const exact = clip.warp === null && recording.sampleRate === sampleRate;
  const sample = (data: Float32Array, source: number) =>
    exact ? (data[source] ?? 0) : interpolate(data, source);
  const locate = locator(clip, recording.sampleRate, sampleRate);
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

/** What `renderClip` does for a recording read through the pages of its stream. */
function renderStreamedClip(
  output: readonly Float32Array[],
  at: number,
  length: number,
  position: number,
  clip: PlayedClip,
  recording: StreamedRecording,
  sampleRate: number
) {
  const from = Math.max(position, clip.start);
  const to = Math.min(position + length, clip.end);
  const [outLeft, outRight] = output;
  if (from >= to || !outLeft) {
    return;
  }
  const exact =
    clip.warp === null &&
    clip.stretch === null &&
    recording.sampleRate === sampleRate;
  const [left, right] = streamSamplers(recording.stream, exact);
  if (clip.stretch) {
    renderStretchedClip(
      output,
      at,
      length,
      position,
      clip,
      clip.stretch,
      left,
      right,
      (source) => streamedSample(recording.stream, 0, Math.round(source)),
      recording.sampleRate,
      sampleRate
    );
    return;
  }
  const sourceAt = sourceIndexer(clip, recording.sampleRate, sampleRate);
  for (let frame = from; frame < to; frame += 1) {
    const source = sourceAt(frame);
    if (!Number.isNaN(source)) {
      const index = at + frame - position;
      const gain = gainAt(clip, frame);
      outLeft[index] = (outLeft[index] as number) + left(source) * gain;
      if (outRight) {
        outRight[index] = (outRight[index] as number) + right(source) * gain;
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
