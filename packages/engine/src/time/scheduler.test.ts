import { describe, expect, test } from "bun:test";
import {
  advance,
  anchoredCursor,
  anchorForTempoChange,
  positionAt,
  SCHEDULE_AHEAD_SECONDS,
  type SchedulerConfig,
} from "./index.ts";

// bpm 120, stepsPerBeat 4 => 60 / 120 / 4
const STEP = 0.125;
const fullGrid = (totalSteps: number): SchedulerConfig => ({
  regionEnd: totalSteps,
  regionStart: 0,
  secondsPerStep: STEP,
});

describe("advance, look-ahead emission", () => {
  test("emits only the boundaries within the 0.1s horizon", () => {
    const config = fullGrid(4);
    const { boundaries, cursor } = advance(anchoredCursor(0, 0), 0, config);
    // horizon = 0.1; step 0 @0 is in, step 1 @0.125 is past it
    expect(boundaries).toEqual([{ step: 0, time: 0 }]);
    expect(cursor).toEqual({ nextStep: 1, nextStepTime: STEP });
  });

  test("the horizon is exactly SCHEDULE_AHEAD_SECONDS", () => {
    expect(SCHEDULE_AHEAD_SECONDS).toBe(0.1);
  });

  test("keeps the cursor drift-free across successive polls", () => {
    const config = fullGrid(4);
    const first = advance(anchoredCursor(0, 0), 0, config);
    const second = advance(first.cursor, 0.05, config);
    expect(second.boundaries).toEqual([{ step: 1, time: STEP }]);
    // times stay exact multiples of STEP, no accumulation of poll jitter
    expect(second.cursor.nextStepTime).toBeCloseTo(0.25, 10);
  });
});

describe("advance, self-correcting catch-up", () => {
  test("a poll delayed past several steps emits all the missed boundaries", () => {
    const config = fullGrid(4);
    // one poll never fired; now jumps straight to 0.3
    const { boundaries } = advance(anchoredCursor(0, 0), 0.3, config);
    expect(boundaries.map((b) => b.step)).toEqual([0, 1, 2, 3]);
    expect(boundaries.map((b) => b.time)).toEqual([0, 0.125, 0.25, 0.375]);
  });
});

describe("advance, loop region", () => {
  test("cycles the step only within [regionStart, regionEnd)", () => {
    const config: SchedulerConfig = {
      regionEnd: 3,
      regionStart: 1,
      secondsPerStep: STEP,
    };
    const { boundaries } = advance(anchoredCursor(0, 1), 0.5, config);
    expect(boundaries.map((b) => b.step)).toEqual([1, 2, 1, 2, 1]);
  });

  test("re-wraps a cursor left stale by a shrunk region", () => {
    // cursor points at step 5, but the region is now [0, 3)
    const config: SchedulerConfig = {
      regionEnd: 3,
      regionStart: 0,
      secondsPerStep: STEP,
    };
    const { boundaries } = advance({ nextStep: 5, nextStepTime: 0 }, 0, config);
    expect(boundaries[0]?.step).toBe(2); // 5 wrapped into [0,3)
  });
});

describe("positionAt, continuous playhead", () => {
  test("sits exactly on the anchor step at the anchor time", () => {
    expect(positionAt(0, { step: 0, time: 0 }, fullGrid(4))).toBe(0);
  });

  test("advances one full step per secondsPerStep", () => {
    expect(positionAt(STEP, { step: 0, time: 0 }, fullGrid(4))).toBeCloseTo(
      1,
      10
    );
    expect(positionAt(STEP / 2, { step: 0, time: 0 }, fullGrid(4))).toBeCloseTo(
      0.5,
      10
    );
  });

  test("wraps within the region and reports full-grid coordinates", () => {
    const config: SchedulerConfig = {
      regionEnd: 3,
      regionStart: 1,
      secondsPerStep: STEP,
    };
    expect(positionAt(0, { step: 1, time: 0 }, config)).toBe(1);
    expect(positionAt(STEP, { step: 1, time: 0 }, config)).toBeCloseTo(2, 10);
    // one region-length later, back to the region start
    expect(positionAt(STEP * 2, { step: 1, time: 0 }, config)).toBeCloseTo(
      1,
      10
    );
  });

  test("reflects a seek, anchoring a mid-region step at now", () => {
    // seek to step 2 at now = 0.4
    expect(positionAt(0.4, { step: 2, time: 0.4 }, fullGrid(4))).toBe(2);
  });
});

describe("tempo", () => {
  test("a slower secondsPerStep spaces the boundaries further apart", () => {
    const slow: SchedulerConfig = {
      regionEnd: 4,
      regionStart: 0,
      secondsPerStep: 0.25,
    };
    const { boundaries } = advance(anchoredCursor(0, 0), 0.3, slow);
    expect(boundaries.map((b) => b.time)).toEqual([0, 0.25]);
  });
});

describe("a tempo change while playing", () => {
  const slow: SchedulerConfig = { ...fullGrid(16), secondsPerStep: 0.25 };

  test("rereading the time since the anchor at the new tempo moves the playhead", () => {
    // 3 s at 120 BPM is 24 steps, so the loop of 16 is at step 8 ...
    expect(positionAt(3, { step: 0, time: 0 }, fullGrid(16))).toBe(8);
    // ... which is not what the same anchor says once the spacing doubles.
    expect(positionAt(3, { step: 0, time: 0 }, slow)).toBe(12);
  });

  test("the carried anchor keeps the position at the change and counts from there", () => {
    const anchor = anchorForTempoChange(3, { step: 0, time: 0 }, fullGrid(16));
    expect(anchor).toEqual({ step: 8, time: 3 });
    expect(positionAt(3, anchor, slow)).toBe(8);
    // Half a second later, at one step per 0.25 s: two steps on.
    expect(positionAt(3.5, anchor, slow)).toBe(10);
  });

  test("a loop region wraps the same way before and after the change", () => {
    const region = (secondsPerStep: number): SchedulerConfig => ({
      regionEnd: 12,
      regionStart: 8,
      secondsPerStep,
    });
    // Anchored on step 10, 0.375 s (3 steps) later the loop of [8, 12) sits on 9.
    const anchor = anchorForTempoChange(
      0.375,
      { step: 10, time: 0 },
      region(0.125)
    );
    expect(anchor.step).toBe(9);
    // Then two slow steps (0.5 s): 9 + 2 = 11.
    expect(positionAt(0.875, anchor, region(0.25))).toBe(11);
  });
});

describe("a scheduler that cannot hang", () => {
  const spacings = [0, -0.125, Number.NaN, Number.POSITIVE_INFINITY];

  test("emits nothing and keeps its cursor for a spacing that is not a step forward", () => {
    for (const secondsPerStep of spacings) {
      const cursor = anchoredCursor(0, 3);
      const result = advance(cursor, 5, { ...fullGrid(16), secondsPerStep });
      expect(result.boundaries).toEqual([]);
      expect(result.cursor).toEqual(cursor);
    }
  });

  test("keeps a playhead at the start of its region when the spacing is no step", () => {
    const config = { regionEnd: 8, regionStart: 2, secondsPerStep: 0 };
    expect(positionAt(10, { step: 5, time: 0 }, config)).toBe(2);
  });
});

describe("a stall too long to catch up on", () => {
  test("catches up on a stall within MAX_CATCH_UP_SECONDS, late but whole", () => {
    const { boundaries } = advance(anchoredCursor(0, 0), 0.5, fullGrid(16));
    // Every step from 0 to the horizon at 0.6 s: 0.625 is not yet due.
    expect(boundaries.map((b) => b.step)).toEqual([0, 1, 2, 3, 4]);
    expect(boundaries.map((b) => b.time)).toEqual([0, 0.125, 0.25, 0.375, 0.5]);
  });

  test("skips ahead past MAX_CATCH_UP_SECONDS, whole steps, where the time is now", () => {
    const grid = fullGrid(16);
    const { boundaries, cursor } = advance(anchoredCursor(0, 0), 3600, grid);
    // An hour is 28,800 steps: none of them is played, the next ones are.
    expect(boundaries.length).toBeLessThanOrEqual(2);
    expect(boundaries[0]?.time).toBeGreaterThanOrEqual(3600 - STEP);
    // The step still matches the time: step = (time / STEP) mod 16, no phase lost.
    for (const boundary of boundaries) {
      expect(boundary.step).toBe(Math.round(boundary.time / STEP) % 16);
    }
    expect(cursor.nextStepTime).toBeGreaterThanOrEqual(3600);
  });

  test("keeps the loop region's phase when it skips", () => {
    const config: SchedulerConfig = {
      regionEnd: 6,
      regionStart: 2,
      secondsPerStep: STEP,
    };
    const { boundaries } = advance(anchoredCursor(0, 2), 100, config);
    const [first] = boundaries;
    const steps = Math.round((first?.time ?? 0) / STEP);
    // Four steps in the loop: step 2 + steps elapsed, wrapped into [2, 6).
    expect(first?.step).toBe(2 + (steps % 4));
  });
});
