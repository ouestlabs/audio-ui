import { describe, expect, test } from "bun:test";
import {
  clearPattern,
  createDrumMachineTools,
  type DrumMachineState,
  setRowAt,
  toggleStepAt,
} from "@/registry-audio/bases/base/lib/drum-machine-tools";

const KIT = ["kick", "snare", "hihat", "clap"] as const;
const STEPS = 16;
const drum = createDrumMachineTools({ instruments: KIT, stepCount: STEPS });

function emptyState(): DrumMachineState {
  return { bpm: 120, pattern: clearPattern(KIT.length, STEPS) };
}

/** A row with `true` at the given step indices. */
function row(...ons: number[]): boolean[] {
  return Array.from({ length: STEPS }, (_, i) => ons.includes(i));
}

describe("clearPattern (index-based)", () => {
  test("rowCount silent rows of stepCount", () => {
    const pattern = clearPattern(4, 8);
    expect(pattern).toHaveLength(4);
    expect(
      pattern.every((r) => r.length === 8 && r.every((cell) => cell === false))
    ).toBe(true);
  });
});

describe("setRowAt / toggleStepAt (index-based, immutable)", () => {
  test("setRowAt replaces only the target row", () => {
    const pattern = setRowAt(clearPattern(4, STEPS), 2, row(0, 4));
    expect(pattern[2]?.[0]).toBe(true);
    expect(pattern[0]?.every((cell) => !cell)).toBe(true);
  });

  test("toggleStepAt flips one cell and leaves the input untouched", () => {
    const before = clearPattern(4, STEPS);
    const after = toggleStepAt(before, 1, 3);
    expect(after[1]?.[3]).toBe(true);
    expect(before[1]?.[3]).toBe(false);
  });
});

describe("createDrumMachineTools — arbitrary kits (not a fixed 3)", () => {
  test("addresses instruments by the consumer's own names", () => {
    // "clap" is the 4th voice — impossible in a hard-coded kick/snare/hihat kit
    const next = drum.setInstrument.apply(emptyState(), {
      instrument: "clap",
      steps: row(4, 12),
    });
    expect(next.pattern[3]?.[4]).toBe(true);
    expect(next.pattern[3]?.[12]).toBe(true);
  });

  test("works for a 2-instrument kit on an 8-step grid", () => {
    const mini = createDrumMachineTools({
      instruments: ["boom", "tick"],
      stepCount: 8,
    });
    const state: DrumMachineState = { bpm: 100, pattern: clearPattern(2, 8) };
    const next = mini.toggleStep.apply(state, { instrument: "tick", step: 7 });
    expect(next.pattern[1]?.[7]).toBe(true);
    expect(next.pattern[1]).toHaveLength(8);
  });
});

describe("drum.setPattern", () => {
  test("replaces the whole grid; instruments omitted from the call are cleared", () => {
    const seeded: DrumMachineState = {
      bpm: 120,
      pattern: setRowAt(clearPattern(KIT.length, STEPS), 3, row(0, 1, 2)),
    };
    const next = drum.setPattern.apply(seeded, {
      rows: [
        { instrument: "kick", steps: row(0, 4, 8, 12) },
        { instrument: "snare", steps: row(4, 12) },
      ],
    });
    expect(next.pattern[0]?.[0]).toBe(true);
    expect(next.pattern[1]?.[4]).toBe(true);
    expect(next.pattern[3]?.every((cell) => !cell)).toBe(true);
  });
});

describe("drum.setTempo", () => {
  test("clamps into range and rounds", () => {
    expect(drum.setTempo.apply(emptyState(), { bpm: 999 }).bpm).toBe(200);
    expect(drum.setTempo.apply(emptyState(), { bpm: 90.4 }).bpm).toBe(90);
  });
});

describe("schemas reject malformed AI arguments", () => {
  test("unknown instrument rejected, known one accepted (kit-aware)", () => {
    expect(
      drum.toggleStep.schema.safeParse({ instrument: "cowbell", step: 0 })
        .success
    ).toBe(false);
    expect(
      drum.toggleStep.schema.safeParse({ instrument: "clap", step: 0 }).success
    ).toBe(true);
  });

  test("out-of-range step rejected", () => {
    expect(
      drum.toggleStep.schema.safeParse({ instrument: "kick", step: STEPS })
        .success
    ).toBe(false);
  });

  test("wrong-length row rejected", () => {
    expect(
      drum.setInstrument.schema.safeParse({
        instrument: "kick",
        steps: [true, false],
      }).success
    ).toBe(false);
  });
});
