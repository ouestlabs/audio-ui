import { describe, expect, test } from "bun:test";
import type { Note } from "@audio-ui/core/piano-roll";
import {
  filledEvery,
  type StepGrid,
  stepsOf,
  withStep,
  withStepLevel,
} from "@/registry-audio/bases/base/lib/drum-steps";

/** A kick on 36 and a snare on 38, sixteen sixteenths of a beat of 0.5 s. */
const grid: StepGrid = { notes: [36, 38], step: 0.125, steps: 16 };

const note = (
  id: number,
  pitch: number,
  start: number,
  velocity = 1
): Note => ({
  id,
  length: 0.125,
  pitch,
  start,
  velocity,
});

describe("stepsOf", () => {
  test("a note plays the step it starts in, on its pad's row, as loud as it is", () => {
    const steps = stepsOf([note(1, 36, 0), note(2, 38, 0.5, 0.6)], grid);
    expect(steps.pattern[0]?.[0]).toBe(true);
    expect(steps.pattern[1]?.[4]).toBe(true);
    expect(steps.pattern[1]?.[0]).toBe(false);
    expect(steps.velocities[1]?.[4]).toBe(0.6);
  });

  test("a note off the grid still lights its step, and shows how late it is", () => {
    const steps = stepsOf([note(1, 36, 0.125 + 0.03)], grid);
    expect(steps.pattern[0]?.[1]).toBe(true);
    expect(steps.shifts[0]?.[1]).toBeCloseTo(0.24, 9);
  });

  test("notes of no pad, or past the last step, light nothing", () => {
    const steps = stepsOf([note(1, 60, 0), note(2, 36, 2)], grid);
    expect(steps.pattern.flat().some(Boolean)).toBe(false);
  });
});

describe("withStep", () => {
  test("switched on, a step gets a note a step long on its pad, under a new id", () => {
    const notes = withStep([note(1, 36, 0)], grid, { row: 1, step: 4 }, true);
    expect(notes).toHaveLength(2);
    const added = notes.find((item) => item.pitch === 38);
    expect(added).toMatchObject({ length: 0.125, start: 0.5 });
    expect(added?.id).not.toBe(1);
  });

  test("switched off, a step loses every note in it, and only those", () => {
    const notes = withStep(
      [note(1, 36, 0), note(2, 36, 0.02), note(3, 36, 0.125)],
      grid,
      { row: 0, step: 0 },
      false
    );
    expect(notes.map((item) => item.id)).toEqual([3]);
  });

  test("switching on a step that plays changes nothing", () => {
    const notes = [note(1, 36, 0)];
    expect(withStep(notes, grid, { row: 0, step: 0 }, true)).toBe(notes);
  });
});

describe("withStepLevel", () => {
  test("sets the velocity, the chance or the shift of the notes in a step", () => {
    const notes = [note(1, 38, 0.5), note(2, 36, 0.5)];
    const cell = { row: 1, step: 4 };
    const louder = withStepLevel(notes, grid, cell, "velocity", 0.3);
    expect(louder.map((item) => item.velocity)).toEqual([0.3, 1]);
    const maybe = withStepLevel(notes, grid, cell, "chance", 0.5);
    expect(maybe[0]?.chance).toBe(0.5);
    const late = withStepLevel(notes, grid, cell, "shift", 0.4);
    expect(late[0]?.start).toBeCloseTo(0.5 + 0.05, 9);
    expect(stepsOf(late, grid).pattern[1]?.[4]).toBe(true);
  });
});

describe("filledEvery", () => {
  test("a row on every nth step, from the first, its other steps cleared", () => {
    const notes = filledEvery([note(1, 38, 0.375)], grid, 1, 4);
    const steps = stepsOf(notes, grid);
    expect(steps.pattern[1]).toEqual(
      Array.from({ length: 16 }, (_, step) => step % 4 === 0)
    );
  });
});

describe("a grid from the loop's start", () => {
  test("counts its steps from there, and puts a new note there", () => {
    const late: StepGrid = { ...grid, start: 1 };
    expect(stepsOf([note(1, 36, 1.125)], late).pattern[0]?.[1]).toBe(true);
    const notes = withStep([], late, { row: 1, step: 2 }, true);
    expect(notes[0]?.start).toBe(1.25);
  });
});
