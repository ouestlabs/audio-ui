import { describe, expect, mock, test } from "bun:test";
import {
  boxElement,
  dragWithSecondFinger,
  ONE_FINGER,
} from "../../../test/helpers.ts";
import { createSequencerController } from "./controller.ts";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

const PATTERN = [
  [false, true, false],
  [true, false, false],
];

describe("Sequencer controller value", () => {
  test("holds the pattern and its size when uncontrolled", () => {
    const sequencer = createSequencerController({ defaultValue: PATTERN });
    const snapshot = sequencer.getSnapshot();
    expect(snapshot.rows).toBe(2);
    expect(snapshot.steps).toBe(3);
  });

  test("a snapshot is the same object while nothing it shows has changed", () => {
    const sequencer = createSequencerController({ value: PATTERN });
    expect(sequencer.getSnapshot()).toBe(sequencer.getSnapshot());
  });

  test("a controlled pattern is shown as given, and a toggle only reports itself", () => {
    const onValueChange = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const sequencer = createSequencerController({
      onValueChange,
      onValueCommitted,
      value: PATTERN,
    });
    sequencer.toggleCell({ row: 0, step: 0 }, key(" "));
    expect(sequencer.getSnapshot().value).toEqual(PATTERN);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
  });

  test("a toggle on an uncontrolled pattern flips the cell and commits the new pattern", () => {
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const sequencer = createSequencerController({
      defaultValue: PATTERN,
      onValueCommitted,
    });
    sequencer.toggleCell({ row: 0, step: 0 }, key("Enter"));
    expect(sequencer.getSnapshot().value[0]?.[0]).toBe(true);
    const committed = onValueCommitted.mock
      .calls[0]?.[0] as unknown as boolean[][];
    expect(committed[0]?.[0]).toBe(true);
  });
});

describe("Sequencer controller focus", () => {
  test("arrows move the tab stop inside the grid and report where it went", () => {
    const sequencer = createSequencerController({ defaultValue: PATTERN });
    const next = sequencer.moveFocusFrom(
      { row: 0, step: 0 },
      key("ArrowRight")
    );
    expect(next).toEqual({ row: 0, step: 1 });
    expect(sequencer.getSnapshot().tabStop).toEqual({ row: 0, step: 1 });
  });

  test("a key that is not the grid's moves nothing", () => {
    const sequencer = createSequencerController({ defaultValue: PATTERN });
    expect(sequencer.moveFocusFrom({ row: 0, step: 0 }, key("a"))).toBeNull();
  });

  test("the tab stop is kept inside a pattern that shrank", () => {
    const sequencer = createSequencerController({ defaultValue: PATTERN });
    sequencer.setTabStop({ row: 5, step: 9 });
    expect(sequencer.getSnapshot().tabStop).toEqual({ row: 1, step: 2 });
  });
});

describe("Sequencer controller velocities", () => {
  test("a velocity is clamped to 0…1 and committed at once", () => {
    const onVelocityCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const sequencer = createSequencerController({
      defaultValue: PATTERN,
      onVelocityCommitted,
    });
    sequencer.setVelocity(
      { row: 0, step: 1 },
      -1,
      "input-change",
      new Event("input")
    );
    expect(sequencer.getSnapshot().velocities[0]?.[1]).toBe(0);
    sequencer.setVelocity({ row: 0, step: 1 }, 2, "keyboard", key("PageUp"));
    expect(sequencer.getSnapshot().velocities[0]?.[1]).toBe(1);
    expect(onVelocityCommitted).toHaveBeenCalledTimes(2);
  });

  test("a reset back to full commits with a reset reason", () => {
    const onVelocityCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const sequencer = createSequencerController({
      defaultVelocities: [[0.2, 0.2, 0.2]],
      defaultValue: PATTERN,
      onVelocityCommitted,
    });
    sequencer.setVelocity(
      { row: 0, step: 0 },
      1,
      "reset",
      new Event("dblclick")
    );
    const committed = onVelocityCommitted.mock
      .calls[0]?.[0] as unknown as number[][];
    expect(committed[0]).toEqual([1, 0.2, 0.2]);
  });
});

describe("Sequencer controller subscriptions", () => {
  test("subscribers hear every change, and stop when they unsubscribe", () => {
    const sequencer = createSequencerController({ defaultValue: PATTERN });
    const listener = mock(() => undefined);
    const unsubscribe = sequencer.subscribe(listener);
    sequencer.toggleCell({ row: 0, step: 0 }, key(" "));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    sequencer.toggleCell({ row: 0, step: 0 }, key(" "));
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("Sequencer controller pointers", () => {
  test("a second finger painting is ignored, and the first goes on painting", () => {
    const onValueChange = mock(() => undefined);
    const onValueCommitted = mock(() => undefined);
    const sequencer = createSequencerController({
      defaultValue: PATTERN,
      onValueChange,
      onValueCommitted,
    });
    const root = boxElement(30, 20);
    // The cells, 10px squares: row 0 on top, step 0 on the left.
    const nodes = new Map(
      [0, 1].flatMap((row) =>
        [0, 1, 2].map((step) => {
          const cell = boxElement(10, 10);
          cell.getBoundingClientRect = () =>
            new DOMRect(step * 10, row * 10, 10, 10);
          return [`${row}:${step}`, cell] as const;
        })
      )
    );
    let cell = { row: 0, step: 0 };
    const result = dragWithSecondFinger({
      changes: () => onValueChange.mock.calls.length,
      commits: () => onValueCommitted.mock.calls.length,
      first: [
        [5, 5],
        [25, 5],
        [15, 15],
      ],
      press: (event) => {
        sequencer.pressCell(cell, event, root, nodes);
        cell = { row: 1, step: 0 };
      },
      second: [
        [5, 15],
        [25, 15],
      ],
    });
    expect(result).toEqual(ONE_FINGER);
  });
});
