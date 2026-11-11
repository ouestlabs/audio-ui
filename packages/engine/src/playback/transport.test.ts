import { describe, expect, test } from "bun:test";
import {
  arrangementFrame,
  continuesFrom,
  heardFrame,
  type PlaybackState,
  playbackRuns,
  rescaled,
  startsInWindow,
} from "./transport.ts";

const playing = (
  position: number,
  at = 0,
  loop: [number, number] | null = null
): PlaybackState => ({ at, loop, playing: true, position });

describe("the transport", () => {
  test("TRN-005: past the loop's end comes its start, with no gap and no overlap", () => {
    // A loop of 1001 frames, which no block size divides.
    const state = playing(500, 0, [100, 1101]);
    const runs = playbackRuns(state, 0, 2000);
    const frames = runs.flatMap((run) =>
      Array.from({ length: run.length }, (_, index) => run.position + index)
    );
    expect(frames).toHaveLength(2000);
    expect(frames[600]).toBe(1100);
    expect(frames[601]).toBe(100);
    expect(frames[1602]).toBe(100);
    for (const [index, frame] of frames.entries()) {
      expect(frame).toBe(arrangementFrame(state, index));
    }
  });

  test("TRN-005: a long run of loops does not drift", () => {
    const state = playing(0, 0, [0, 1001]);
    // Ten thousand passes on: the frame is where the loop says, to the frame.
    expect(arrangementFrame(state, 1001 * 10_000 + 7)).toBe(7);
  });

  test("TRN-006: started past the loop's end, playback never loops", () => {
    const state = playing(2000, 0, [100, 1100]);
    expect(arrangementFrame(state, 5000)).toBe(7000);
    expect(playbackRuns(state, 0, 4096)).toEqual([
      { length: 4096, offset: 0, position: 2000 },
    ]);
  });

  test("TRN-006: started before the loop, playback plays into it and repeats it", () => {
    const state = playing(0, 0, [100, 200]);
    expect(arrangementFrame(state, 50)).toBe(50);
    expect(arrangementFrame(state, 199)).toBe(199);
    expect(arrangementFrame(state, 200)).toBe(100);
  });

  test("TRN-009: the frame heard is the clock's frame less the delay on the way", () => {
    expect(heardFrame(1, 48_000)).toBe(48_000);
    expect(heardFrame(1, 48_000, 128)).toBe(47_872);
  });

  test("TRN-012: a change of tempo keeps the playhead on its bar and beat", () => {
    // At 120 BPM a bar of 4/4 is 96000 frames; the playhead is a beat into bar 3.
    const state = playing(0);
    const at = 2 * 96_000 + 24_000;
    // At 60 BPM every time is twice as late.
    const next = rescaled(state, 2, at);
    expect(next.position).toBe(2 * (2 * 96_000 + 24_000));
    expect(next.at).toBe(at);
    expect(continuesFrom(state, next)).toBe(false);
  });

  test("TRN-015 and MID-002: an item starts on the frame its place on the arrangement plays at", () => {
    const state = playing(1000, 480);
    const notes = [{ start: 1000 }, { start: 1100 }, { start: 5000 }];
    expect(startsInWindow(state, 0, 1024, notes, (note) => note.start)).toEqual(
      [
        { at: 480, item: { start: 1000 } },
        { at: 580, item: { start: 1100 } },
      ]
    );
  });

  test("MID-002: a looped item starts on every pass", () => {
    const state = playing(0, 0, [0, 100]);
    const starts = startsInWindow(
      state,
      0,
      350,
      [{ start: 10 }],
      (note) => note.start
    );
    expect(starts.map((start) => start.at)).toEqual([10, 110, 210, 310]);
  });

  test("a new loop around the playhead carries on, a jump does not", () => {
    const before = playing(0);
    expect(continuesFrom(before, playing(1000, 1000, [0, 4000]))).toBe(true);
    expect(continuesFrom(before, playing(3000, 1000))).toBe(false);
  });
});
