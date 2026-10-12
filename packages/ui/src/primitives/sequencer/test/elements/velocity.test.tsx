import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../../../../test/helpers.ts";
import { Sequencer } from "../../../../entries/sequencer.ts";

type Details = Sequencer.Root.VelocityChangeDetails;
type Committed = Sequencer.Root.VelocityCommitDetails;

/** Two rows of four steps; each velocity bar is 10 wide and 100 tall, at (10 × step, 100 × row). */
function renderVelocities(props: Sequencer.Root.Props = {}) {
  const onVelocityChange = mock(
    (_velocities: number[][], _details: Details) => undefined
  );
  const onVelocityCommitted = mock(
    (_velocities: number[][], _details: Committed) => undefined
  );
  const view = render(
    <Sequencer.Root
      defaultValue={[
        [true, false, false, false],
        [false, false, true, false],
      ]}
      onVelocityChange={onVelocityChange}
      onVelocityCommitted={onVelocityCommitted}
      {...props}
    >
      <Sequencer.Rows>
        {(row) => (
          <Sequencer.Row aria-label={`Velocity ${row + 1}`} index={row}>
            <Sequencer.Cells>
              {(step) => (
                <Sequencer.Velocity
                  aria-label={`Row ${row + 1}, step ${step + 1} velocity`}
                  data-testid={`bar-${row}-${step}`}
                  step={step}
                />
              )}
            </Sequencer.Cells>
          </Sequencer.Row>
        )}
      </Sequencer.Rows>
    </Sequencer.Root>
  );
  for (let row = 0; row < 2; row += 1) {
    for (let step = 0; step < 4; step += 1) {
      mockRect(view.getByTestId(`bar-${row}-${step}`), {
        bottom: row * 100 + 100,
        height: 100,
        left: step * 10,
        right: step * 10 + 10,
        top: row * 100,
        width: 10,
      });
    }
  }
  return {
    bar: (row: number, step: number) => view.getByTestId(`bar-${row}-${step}`),
    input: (row: number, step: number) =>
      view.getByLabelText(`Row ${row + 1}, step ${step + 1} velocity`),
    onVelocityChange,
    onVelocityCommitted,
    view,
  };
}

const last = <T extends unknown[]>(fn: { mock: { calls: T[] } }) =>
  fn.mock.calls.at(-1) as T;

describe("Sequencer.Velocity", () => {
  test("stands at full until it is set, as a range input and a CSS variable", () => {
    const { bar, input } = renderVelocities();
    expect((input(0, 1) as HTMLInputElement).value).toBe("1");
    expect(bar(0, 1).style.getPropertyValue("--sequencer-velocity")).toBe("1");
    expect(input(0, 1).getAttribute("aria-valuetext")).toBe("100%");
  });

  test("a press sets the velocity where the pointer is on the bar", () => {
    const { bar, onVelocityChange, onVelocityCommitted } = renderVelocities();
    fireEvent.pointerDown(bar(0, 1), {
      button: 0,
      clientX: 15,
      clientY: 75,
      pointerId: 1,
    });
    expect(last(onVelocityChange)[0][0]).toEqual([1, 0.25, 1, 1]);
    expect(last(onVelocityChange)[1].reason).toBe("drag");
    fireEvent.pointerUp(bar(0, 1), { pointerId: 1 });
    expect(last(onVelocityCommitted)[1].reason).toBe("drag");
    expect(bar(0, 1).style.getPropertyValue("--sequencer-velocity")).toBe(
      "0.25"
    );
  });

  test("dragging across the row draws the steps it crosses, not another row", () => {
    const { bar, onVelocityChange } = renderVelocities();
    fireEvent.pointerDown(bar(0, 0), {
      button: 0,
      clientX: 5,
      clientY: 50,
      pointerId: 1,
    });
    fireEvent.pointerMove(bar(0, 0), {
      buttons: 1,
      clientX: 25,
      clientY: 20,
      pointerId: 1,
    });
    fireEvent.pointerMove(bar(0, 0), {
      buttons: 1,
      clientX: 35,
      clientY: 180,
      pointerId: 1,
    });
    fireEvent.pointerUp(bar(0, 0), { pointerId: 1 });
    const [velocities] = last(onVelocityChange);
    expect(velocities[0]).toEqual([0.5, 1, 0.8, 0]);
    expect(velocities[1]).toEqual([1, 1, 1, 1]);
  });

  test("steps with the arrow keys, further with Page Up/Down, to the ends with Home/End", () => {
    const { input, onVelocityChange, onVelocityCommitted } = renderVelocities();
    fireEvent.keyDown(input(0, 0), { key: "ArrowDown" });
    expect(last(onVelocityChange)[0][0]?.[0]).toBeCloseTo(0.95);
    expect(last(onVelocityChange)[1].reason).toBe("keyboard");
    expect(last(onVelocityCommitted)[1].reason).toBe("keyboard");
    fireEvent.keyDown(input(0, 0), { key: "PageDown" });
    expect(last(onVelocityChange)[0][0]?.[0]).toBeCloseTo(0.7);
    fireEvent.keyDown(input(0, 0), { key: "Home" });
    expect(last(onVelocityChange)[0][0]?.[0]).toBe(0);
    fireEvent.keyDown(input(0, 0), { key: "End" });
    expect(last(onVelocityChange)[0][0]?.[0]).toBe(1);
  });

  test("Alt + click and Delete bring a step back to full", () => {
    const { bar, input, onVelocityChange } = renderVelocities({
      defaultVelocities: [[0.2, 0.2, 0.2, 0.2]],
    });
    fireEvent.pointerDown(bar(0, 0), {
      altKey: true,
      button: 0,
      clientX: 5,
      clientY: 90,
      pointerId: 1,
    });
    expect(last(onVelocityChange)[0][0]?.[0]).toBe(1);
    expect(last(onVelocityChange)[1].reason).toBe("reset");
    fireEvent.keyDown(input(0, 1), { key: "Delete" });
    expect(last(onVelocityChange)[0][0]).toEqual([1, 1, 0.2, 0.2]);
  });

  test("cancelling a change keeps the velocity", () => {
    const { input } = renderVelocities({
      onVelocityChange: (_velocities, details) => details.cancel(),
    });
    fireEvent.keyDown(input(0, 0), { key: "ArrowDown" });
    expect((input(0, 0) as HTMLInputElement).value).toBe("1");
  });

  test("follows controlled velocities", () => {
    const { input, view } = renderVelocities({
      velocities: [[0.5, 1, 1, 1]],
    });
    expect((input(0, 0) as HTMLInputElement).value).toBe("0.5");
    expect(view.container.querySelectorAll("input")).toHaveLength(8);
  });

  test("leaves the pattern alone", () => {
    const onValueChange = mock(() => undefined);
    const { bar } = renderVelocities({ onValueChange });
    fireEvent.pointerDown(bar(0, 1), {
      button: 0,
      clientX: 15,
      clientY: 50,
      pointerId: 1,
    });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
