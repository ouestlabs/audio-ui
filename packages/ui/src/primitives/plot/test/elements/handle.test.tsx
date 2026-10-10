import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { useCallback, useState } from "react";
import { mockRect } from "../../../../../test/helpers";
import { Plot } from "../../../../plot";
import { lastCall, renderPlot } from "../helpers";

function drag(
  element: Element,
  from: readonly [number, number],
  to: readonly [number, number],
  init: { shiftKey?: boolean } = {}
) {
  fireEvent.pointerDown(element, {
    button: 0,
    clientX: from[0],
    clientY: from[1],
    pointerId: 1,
    ...init,
  });
  fireEvent.pointerMove(element, {
    clientX: to[0],
    clientY: to[1],
    pointerId: 1,
    ...init,
  });
  fireEvent.pointerUp(element, {
    clientX: to[0],
    clientY: to[1],
    pointerId: 1,
    ...init,
  });
}

describe("Plot.Handle", () => {
  test("sits at its value, in the axes' units", () => {
    const { handle } = renderPlot();
    expect(handle.style.left).toBe("50%");
    expect(handle.style.top).toBe("50%");
  });

  test("moves from where it is, never jumping to the pointer", () => {
    const { handle, onValueChange, onValueCommitted } = renderPlot();
    // 40px right is 20 units; 20px up is 2 units.
    drag(handle, [100, 50], [140, 30]);
    expect(lastCall(onValueChange)[0]).toEqual({ x: 70, y: 7 });
    expect(lastCall(onValueChange)[1].reason).toBe("drag");
    expect(lastCall(onValueCommitted)[0]).toEqual({ x: 70, y: 7 });
    expect(handle.style.left).toBe("70%");
  });

  test("is four times finer with Shift", () => {
    const { onValueChange, handle } = renderPlot();
    drag(handle, [100, 50], [140, 50], { shiftKey: true });
    expect(lastCall(onValueChange)[0].x).toBeCloseTo(55);
  });

  test("stays within the axes", () => {
    const { handle, onValueCommitted } = renderPlot();
    drag(handle, [100, 50], [900, -900]);
    expect(lastCall(onValueCommitted)[0]).toEqual({ x: 100, y: 10 });
  });

  test("holds to one axis when asked", () => {
    const { handle, inputs, onValueCommitted } = renderPlot({}, { axis: "x" });
    expect(inputs).toHaveLength(1);
    drag(handle, [100, 50], [140, 10]);
    expect(lastCall(onValueCommitted)[0]).toEqual({ x: 70, y: 5 });
  });

  test("moves along a logarithmic axis by even ratios", () => {
    const { handle, onValueCommitted } = renderPlot(
      { minX: 10, scaleX: "log" },
      { defaultValue: { x: 100, y: 5 } }
    );
    // 10…100 spans 200px at 100px per decade: 100 is at the right edge.
    expect(handle.style.left).toBe("100%");
    drag(handle, [200, 50], [100, 50]);
    expect(lastCall(onValueCommitted)[0].x).toBeCloseTo(31.62, 1);
  });

  test("commits nothing for a press that moves nothing", () => {
    const { handle, onValueChange, onValueCommitted } = renderPlot();
    drag(handle, [100, 50], [100, 50]);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommitted).not.toHaveBeenCalled();
  });

  test("can be cancelled", () => {
    const { handle } = renderPlot(
      {},
      { onValueChange: (_value, details) => details.cancel() }
    );
    drag(handle, [100, 50], [140, 50]);
    expect(handle.style.left).toBe("50%");
  });

  test("shows a controlled value as given, even mid-drag", () => {
    const { handle, onValueCommitted } = renderPlot(
      {},
      { defaultValue: undefined, value: { x: 50, y: 5 } }
    );
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      clientY: 50,
      pointerId: 1,
    });
    fireEvent.pointerMove(handle, { clientX: 140, clientY: 50, pointerId: 1 });
    expect(handle.style.left).toBe("50%");
    fireEvent.pointerUp(handle, { clientX: 140, clientY: 50, pointerId: 1 });
    expect(lastCall(onValueCommitted)[0].x).toBe(70);
    expect(handle.style.left).toBe("50%");
  });

  test("holds a slider per axis, named after the handle", () => {
    const { inputs } = renderPlot();
    expect(inputs).toHaveLength(2);
    expect(inputs.map((input) => input.getAttribute("aria-label"))).toEqual([
      "Band X",
      "Band Y",
    ]);
    expect(inputs[0]?.tabIndex).not.toBe(-1);
    expect(inputs[1]?.tabIndex).toBe(-1);
    expect(inputs[0]?.getAttribute("aria-valuetext")).toBe("50");
  });

  test("announces values through getAriaValueText", () => {
    const { inputs } = renderPlot(
      {},
      { getAriaValueText: (value, axis) => `${axis}=${value}` }
    );
    expect(inputs[1]?.getAttribute("aria-valuetext")).toBe("y=5");
  });

  test("moves a hundredth of the axis with the arrow keys, a tenth with Shift", () => {
    const { inputs, onValueCommitted } = renderPlot();
    fireEvent.keyDown(inputs[0] as HTMLInputElement, { key: "ArrowRight" });
    expect(lastCall(onValueCommitted)[0].x).toBeCloseTo(51);
    expect(lastCall(onValueCommitted)[1].reason).toBe("keyboard");
    fireEvent.keyDown(inputs[0] as HTMLInputElement, {
      key: "ArrowUp",
      shiftKey: true,
    });
    expect(lastCall(onValueCommitted)[0].y).toBeCloseTo(6);
  });

  test("jumps to the ends of its axis with Home and End", () => {
    const { inputs, onValueCommitted } = renderPlot();
    fireEvent.keyDown(inputs[0] as HTMLInputElement, { key: "End" });
    expect(lastCall(onValueCommitted)[0].x).toBe(100);
    fireEvent.keyDown(inputs[0] as HTMLInputElement, { key: "Home" });
    expect(lastCall(onValueCommitted)[0].x).toBe(0);
  });

  test("takes changes made through an input", () => {
    const { inputs, onValueCommitted } = renderPlot();
    fireEvent.change(inputs[1] as HTMLInputElement, {
      target: { value: "0.8" },
    });
    expect(lastCall(onValueCommitted)[0].y).toBeCloseTo(8);
    expect(lastCall(onValueCommitted)[1].reason).toBe("input-change");
  });

  test("ignores everything when disabled", () => {
    const { handle, inputs, onValueChange } = renderPlot({ disabled: true });
    drag(handle, [100, 50], [140, 50]);
    fireEvent.keyDown(inputs[0] as HTMLInputElement, { key: "ArrowRight" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(handle.hasAttribute("data-disabled")).toBe(true);
  });

  test("starts in the middle of the plot without a value", () => {
    const { handle } = renderPlot({}, { defaultValue: undefined });
    expect(handle.style.left).toBe("50%");
    expect(handle.style.top).toBe("50%");
  });

  test("keeps a controlled value inside the axes", () => {
    const { handle } = renderPlot(
      {},
      { defaultValue: undefined, value: { x: 500, y: -4 } }
    );
    expect(handle.style.left).toBe("100%");
    expect(handle.style.top).toBe("100%");
  });

  test("holds one input and moves vertically only along y", () => {
    const { inputs, onValueCommitted } = renderPlot({}, { axis: "y" });
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.getAttribute("aria-orientation")).toBe("vertical");
    expect(inputs[0]?.tabIndex).not.toBe(-1);
    fireEvent.keyDown(inputs[0] as HTMLInputElement, { key: "ArrowRight" });
    expect(onValueCommitted).not.toHaveBeenCalled();
    fireEvent.keyDown(inputs[0] as HTMLInputElement, { key: "End" });
    expect(lastCall(onValueCommitted)[0]).toEqual({ x: 50, y: 10 });
  });

  test("moves a tenth of the axis with Page Up and Page Down", () => {
    const { inputs, onValueCommitted } = renderPlot();
    fireEvent.keyDown(inputs[0] as HTMLInputElement, { key: "PageUp" });
    expect(lastCall(onValueCommitted)[0].y).toBeCloseTo(6);
    fireEvent.keyDown(inputs[0] as HTMLInputElement, { key: "PageDown" });
    fireEvent.keyDown(inputs[0] as HTMLInputElement, { key: "PageDown" });
    expect(lastCall(onValueCommitted)[0].y).toBeCloseTo(4);
  });

  test("ignores other keys", () => {
    const { inputs, onValueChange } = renderPlot();
    fireEvent.keyDown(inputs[0] as HTMLInputElement, { key: "a" });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("slows down when Shift is pressed mid-drag, carrying on from where it was", () => {
    const { handle, onValueCommitted } = renderPlot();
    const at = (clientX: number, shiftKey = false) => ({
      clientX,
      clientY: 50,
      pointerId: 1,
      shiftKey,
    });
    fireEvent.pointerDown(handle, { ...at(100), button: 0 });
    fireEvent.pointerMove(handle, at(120));
    fireEvent.pointerMove(handle, at(140, true));
    fireEvent.pointerMove(handle, at(180, true));
    fireEvent.pointerUp(handle, at(180, true));
    // 20px normally (10 units); Shift rebases at 140, then 40px at a quarter (5 units).
    expect(lastCall(onValueCommitted)[0].x).toBeCloseTo(65);
  });

  test("ignores a second pointer while one is dragging, and other buttons", () => {
    const { handle, onValueChange } = renderPlot();
    fireEvent.pointerDown(handle, {
      button: 2,
      clientX: 100,
      clientY: 50,
      pointerId: 1,
    });
    fireEvent.pointerMove(handle, { clientX: 140, clientY: 50, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      clientY: 50,
      pointerId: 1,
    });
    fireEvent.pointerMove(handle, { clientX: 140, clientY: 50, pointerId: 2 });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("a cancelled keyboard move leaves the handle where it was", () => {
    const { handle, inputs } = renderPlot(
      {},
      { onValueChange: (_value, details) => details.cancel() }
    );
    fireEvent.keyDown(inputs[0] as HTMLInputElement, { key: "ArrowRight" });
    expect(handle.style.left).toBe("50%");
  });

  test("is marked while dragging", () => {
    const { handle } = renderPlot();
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      clientY: 50,
      pointerId: 1,
    });
    expect(handle.hasAttribute("data-dragging")).toBe(true);
    fireEvent.pointerUp(handle, { clientX: 100, clientY: 50, pointerId: 1 });
    expect(handle.hasAttribute("data-dragging")).toBe(false);
  });

  test("a one-axis handle keeps the other axis from its controlled value while dragging", () => {
    // y is derived from x, as a point riding a curve is: y = x / 10.
    function OnTheCurve() {
      const [x, setX] = useState(50);
      const move = useCallback((next: Plot.Handle.Value) => setX(next.x), []);
      return (
        <Plot.Root data-testid="root" maxX={100} maxY={10} minX={0} minY={0}>
          <Plot.Handle
            aria-label="Riding"
            axis="x"
            data-testid="riding"
            onValueChange={move}
            value={{ x, y: x / 10 }}
          />
        </Plot.Root>
      );
    }
    const view = render(<OnTheCurve />);
    mockRect(view.getByTestId("root"), {
      bottom: 100,
      height: 100,
      right: 200,
      width: 200,
    });
    const handle = view.getByTestId("riding");
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      clientY: 50,
      pointerId: 1,
    });
    fireEvent.pointerMove(handle, { clientX: 140, clientY: 90, pointerId: 1 });
    // Moved 20 units across, and 4 down by the pointer: the value says y = 7.
    expect(handle.style.left).toBe("70%");
    expect(Number.parseFloat(handle.style.top)).toBeCloseTo(30);
    fireEvent.pointerUp(handle, { clientX: 140, clientY: 90, pointerId: 1 });
    expect(Number.parseFloat(handle.style.top)).toBeCloseTo(30);
  });
});
