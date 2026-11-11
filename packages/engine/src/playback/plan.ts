import type { PlayedClip } from "./clip.ts";
import { sourceIndexer } from "./render.ts";
import type { PageRequest } from "./stream.ts";
import { type PlaybackState, playbackRuns } from "./transport.ts";

/**
 * How finely a clip's reading is followed: eight times a page, so no page is
 * skipped where a warp reads its recording up to eight times faster than it
 * was recorded.
 */
const STEPS_PER_PAGE = 8;

/** What the planner needs of a recording: its rate and its length in frames. */
export interface PlannedRecording {
  length: number;
  sampleRate: number;
}

/**
 * The pages a track's clips read over the `count` frames of the audio clock
 * from `frame`, the soonest read first: what a loader should have in the pool
 * before then. Stopped, it plans as if playback started from the state's
 * position at `frame`, so the place a play would start from is ready. Each
 * read takes the pages of the frames around it too, which an interpolated
 * read touches.
 */
export function pagesAhead(
  state: PlaybackState,
  clips: readonly PlayedClip[],
  frame: number,
  count: number,
  recordings: (id: string) => PlannedRecording | undefined,
  sampleRate: number,
  pageFrames: number
): PageRequest[] {
  const playing = state.playing
    ? state
    : { ...state, at: frame, playing: true };
  const first = new Map<string, { at: number; request: PageRequest }>();
  const add = (
    recording: string,
    length: number,
    source: number,
    at: number
  ) => {
    if (Number.isNaN(source)) {
      return;
    }
    const index = Math.floor(source);
    for (const read of [index - 1, index + 2]) {
      if (read >= 0 && read < length) {
        const page = Math.floor(read / pageFrames);
        const key = `${recording}\u0000${page}`;
        if (!first.has(key)) {
          first.set(key, { at, request: { page, recording } });
        }
      }
    }
  };
  const step = Math.max(1, Math.floor(pageFrames / STEPS_PER_PAGE));
  for (const run of playbackRuns(playing, frame, count)) {
    const runEnd = run.position + run.length;
    for (const clip of clips) {
      const from = Math.max(run.position, clip.start);
      const to = Math.min(runEnd, clip.end);
      const recording = recordings(clip.recording);
      if (from >= to || !recording) {
        continue;
      }
      const sourceAt = sourceIndexer(clip, recording.sampleRate, sampleRate);
      const clockOf = (position: number) =>
        frame + run.offset + position - run.position;
      for (let position = from; position < to; position += step) {
        add(
          clip.recording,
          recording.length,
          sourceAt(position),
          clockOf(position)
        );
      }
      add(clip.recording, recording.length, sourceAt(to - 1), clockOf(to - 1));
    }
  }
  return [...first.values()]
    .sort((a, b) => a.at - b.at)
    .map((entry) => entry.request);
}
