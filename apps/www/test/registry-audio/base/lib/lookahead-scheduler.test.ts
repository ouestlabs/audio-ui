import { describe, expect, test } from "bun:test";
import {
  advance,
  anchoredCursor,
  positionAt,
  SCHEDULE_AHEAD_SECONDS,
  type SchedulerConfig,
} from "@/registry-audio/bases/base/lib/lookahead-scheduler";

// bpm 120, stepsPerBeat 4 => 60 / 120 / 4
const STEP = 0.125;
const fullGrid = (totalSteps: number): SchedulerConfig => ({
  regionEnd: totalSteps,
  regionStart: 0,
  secondsPerStep: STEP,
});

describe("advance — look-ahead emission", () => {
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
    // times stay exact multiples of STEP — no accumulation of poll jitter
    expect(second.cursor.nextStepTime).toBeCloseTo(0.25, 10);
  });
});

describe("advance — self-correcting catch-up", () => {
  test("a poll delayed past several steps emits all the missed boundaries", () => {
    const config = fullGrid(4);
    // one poll never fired; now jumps straight to 0.3
    const { boundaries } = advance(anchoredCursor(0, 0), 0.3, config);
    expect(boundaries.map((b) => b.step)).toEqual([0, 1, 2, 3]);
    expect(boundaries.map((b) => b.time)).toEqual([0, 0.125, 0.25, 0.375]);
  });
});

describe("advance — loop region", () => {
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

describe("positionAt — continuous playhead", () => {
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

  test("reflects a seek — anchoring a mid-region step at now", () => {
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
