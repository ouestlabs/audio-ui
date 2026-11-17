/**
 * Where playback is, counted in frames: the audio clock's frames on one side
 * (a context's `currentFrame`), the arrangement's on the other. Every part of
 * an engine that plays an arrangement (a player per track, the scheduler of
 * the notes, the playhead) reads the same state, so they agree to the frame.
 * Whole frames on both sides keep a loop of any length from drifting, and
 * make a part that reads a recording at speed 1 copy it exactly.
 */

/** What the transport does from a frame of the audio clock on. */
export interface PlaybackState {
  /** The frame of the audio clock this state holds from. */
  at: number;
  /** The loop, `[start, end)` in frames of the arrangement, while it is on. */
  loop: readonly [number, number] | null;
  /** Whether the arrangement plays from `at`. */
  playing: boolean;
  /** The frame of the arrangement that plays at `at` (where it stays, stopped). */
  position: number;
}

/** A stretch of a block that plays frames of the arrangement one after the other. */
export interface PlaybackRun {
  /** How many frames it lasts. */
  length: number;
  /** Where it starts in the block. */
  offset: number;
  /** The frame of the arrangement at its first frame. */
  position: number;
}

/** Stopped at the start, from the first frame on. */
export const STOPPED: PlaybackState = {
  at: 0,
  loop: null,
  playing: false,
  position: 0,
};

/** A time in seconds as a whole number of frames: the nearest one. */
export function toFrames(seconds: number, sampleRate: number): number {
  return Math.round(seconds * sampleRate);
}

/** The loop when it can loop: one frame long at least. */
function loopOf(state: PlaybackState): readonly [number, number] | null {
  const { loop } = state;
  return loop && loop[1] > loop[0] ? loop : null;
}

/**
 * Whether the state's playback comes round its loop: only when it starts
 * before the loop's end. Started past it, it plays on.
 */
function loops(state: PlaybackState): boolean {
  const loop = loopOf(state);
  return loop !== null && state.position < loop[1];
}

/**
 * The frame of the arrangement that plays at the audio clock's `frame`, at or
 * after `state.at`: the state's position while stopped.
 */
export function arrangementFrame(state: PlaybackState, frame: number): number {
  if (!state.playing) {
    return state.position;
  }
  const unwrapped = state.position + Math.max(0, frame - state.at);
  const loop = loopOf(state);
  if (!(loop && loops(state)) || unwrapped < loop[1]) {
    return unwrapped;
  }
  return loop[0] + ((unwrapped - loop[0]) % (loop[1] - loop[0]));
}

/**
 * The runs of the block of `count` frames from the audio clock's `frame`: the
 * arrangement's frames it plays, cut where the loop comes round. Frames
 * before `state.at` belong to the state before it, so they are left out;
 * stopped, there are none.
 */
export function playbackRuns(
  state: PlaybackState,
  frame: number,
  count: number
): PlaybackRun[] {
  if (!state.playing || count <= 0) {
    return [];
  }
  const first = Math.max(frame, state.at);
  const end = frame + count;
  const runs: PlaybackRun[] = [];
  // Started past the loop, its end is never reached.
  const [loopStart, loopEnd] = (loops(state) ? loopOf(state) : null) ?? [
    0,
    Number.POSITIVE_INFINITY,
  ];
  let offset = first - frame;
  let position = arrangementFrame(state, first);
  while (offset < count) {
    const left = end - (frame + offset);
    const length =
      position < loopEnd ? Math.min(left, loopEnd - position) : left;
    runs.push({ length, offset, position });
    offset += length;
    position += length;
    if (position === loopEnd) {
      position = loopStart;
    }
  }
  return runs;
}

/**
 * Whether going from `before` to `after` at `after.at` carries on without a
 * break: both play, and the frame of the arrangement at `after.at` is the
 * same in both. A change of loop that leaves the playhead where it is carries
 * on; a jump does not.
 */
export function continuesFrom(
  before: PlaybackState,
  after: PlaybackState
): boolean {
  return (
    before.playing &&
    after.playing &&
    arrangementFrame(before, after.at) === after.position
  );
}

/**
 * The frame of the audio clock heard at the speakers at `contextTime`, the
 * context's time of what is heard now (`getOutputTimestamp().contextTime`, or
 * `currentTime` less the output latency where the browser has no timestamp),
 * less `delay` frames the engine adds on the way (its delay compensation).
 */
export function heardFrame(
  contextTime: number,
  sampleRate: number,
  delay = 0
): number {
  return Math.floor(contextTime * sampleRate) - delay;
}

/**
 * The state that carries on from the audio clock's frame `at` once every time
 * of the arrangement is `ratio` times what it was (a change of tempo: half the
 * tempo makes every time twice as late): the position playing at `at`, and the
 * loop, scaled, so the playhead stays on its bar and beat.
 */
export function rescaled(
  state: PlaybackState,
  ratio: number,
  at: number
): PlaybackState {
  const scale = (frame: number) => Math.round(frame * ratio);
  return {
    at,
    loop: state.loop ? [scale(state.loop[0]), scale(state.loop[1])] : null,
    playing: state.playing,
    position: scale(arrangementFrame(state, at)),
  };
}

/**
 * The items that start in the block of `count` frames from the audio clock's
 * `frame`, each with the frame of the clock it starts at: what a scheduler of
 * notes asks for its look-ahead window. `startOf` gives an item's frame on the
 * arrangement. An item comes once per pass of the loop that plays it.
 */
export function startsInWindow<Item>(
  state: PlaybackState,
  frame: number,
  count: number,
  items: readonly Item[],
  startOf: (item: Item) => number
): { at: number; item: Item }[] {
  const starts: { at: number; item: Item }[] = [];
  for (const run of playbackRuns(state, frame, count)) {
    const end = run.position + run.length;
    for (const item of items) {
      const start = startOf(item);
      if (start >= run.position && start < end) {
        starts.push({ at: frame + run.offset + start - run.position, item });
      }
    }
  }
  return starts.sort((a, b) => a.at - b.at);
}
