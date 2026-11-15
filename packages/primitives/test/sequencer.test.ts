import { describe, expect, mock, test } from "bun:test";
import { sequencer } from "../src/sequencer/index.ts";

const PATTERN = [
  [true, false, false, false],
  [false, false, true, false],
];

/** The sequencer with no framework: the kernel's instance, driven through its controller. */
function instance(options: Record<string, unknown> = {}) {
  const onValueChange = mock(
    (_value: boolean[][], _details: { reason: string; source?: string }) =>
      undefined
  );
  const onVelocityChange = mock(
    (_velocities: number[][], _details: { reason: string }) => undefined
  );
  const grid = sequencer({
    defaultValue: PATTERN,
    id: "s",
    onValueChange,
    onVelocityChange,
    ...options,
  } as never);
  return { grid, onValueChange, onVelocityChange };
}

const space = () => new KeyboardEvent("keydown", { key: " " });

describe("the sequencer primitive", () => {
  test("shows the pattern's rows and steps", () => {
    const { grid } = instance();
    expect(grid.get().view.rows).toBe(2);
    expect(grid.get().view.steps).toBe(4);
  });

  test("a key flips a step, reporting a keyboard change with its source", () => {
    const { grid, onValueChange } = instance();
    grid.api.controller.toggleCell({ row: 0, step: 1 }, space());
    const [value, details] = onValueChange.mock.calls[0] ?? [];
    expect(value?.[0]).toEqual([true, true, false, false]);
    expect(details).toMatchObject({ reason: "keyboard", source: "keyboard" });
    expect(grid.get().view.value[0]).toEqual([true, true, false, false]);
  });

  test("a change an app refuses is not applied", () => {
    const { grid } = instance({
      onValueChange: (_value: unknown, details: { cancel: () => void }) =>
        details.cancel(),
    });
    grid.api.controller.toggleCell({ row: 0, step: 1 }, space());
    expect(grid.get().view.value[0]).toEqual([true, false, false, false]);
  });

  test("a velocity is set, and reported apart from the pattern", () => {
    const { grid, onVelocityChange } = instance();
    grid.api.controller.setVelocity(
      { row: 0, step: 0 },
      0.4,
      "keyboard",
      new KeyboardEvent("keydown", { key: "ArrowUp" })
    );
    expect(onVelocityChange.mock.calls[0]?.[1].reason).toBe("keyboard");
    expect(grid.get().view.velocities[0]?.[0]).toBe(0.4);
  });

  test("a controlled pattern follows the options it is given", () => {
    const { grid } = instance({ value: PATTERN });
    expect(grid.get().view.value).toEqual(PATTERN);
    const next = [[false, true]];
    grid.setOptions({ id: "s", value: next } as never);
    expect(grid.get().view.value).toEqual(next);
  });
});
