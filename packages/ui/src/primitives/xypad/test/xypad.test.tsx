import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../../../test/helpers";
import type { Point } from "../../../utils";
import { XYPad } from "../../../xypad";

/** Defaults: 0-100 on both axes, step 1 → default value at the center {50,50}. */
function renderXYPad(
  props: XYPad.Root.Props = {},
  thumbProps: XYPad.Thumb.Props = {}
) {
  const onValueChange = mock(
    (_value: Point, _details: XYPad.Root.ChangeEventDetails) => undefined
  );
  const onValueCommitted = mock(
    (_value: Point, _details: XYPad.Root.CommitEventDetails) => undefined
  );
  const view = render(
    <XYPad.Root
      data-testid="root"
      locale="en-US"
      onValueChange={onValueChange}
      onValueCommitted={onValueCommitted}
      {...props}
    >
      <XYPad.Control data-testid="pad">
        <XYPad.Thumb aria-label="Filter" data-testid="thumb" {...thumbProps} />
      </XYPad.Control>
      <XYPad.Value data-testid="value" />
    </XYPad.Root>
  );
  const pad = view.getByTestId("pad");
  // a 200×200 pad at the origin
  mockRect(pad, { bottom: 200, height: 200, right: 200, width: 200 });
  const [inputX, inputY] = view.getAllByRole("slider") as [
    HTMLInputElement,
    HTMLInputElement,
  ];
  return {
    inputX,
    inputY,
    onValueChange,
    onValueCommitted,
    pad,
    root: view.getByTestId("root"),
    thumb: view.getByTestId("thumb"),
    value: view.getByTestId("value"),
    view,
  };
}

const lastCall = <T extends unknown[]>(fn: { mock: { calls: T[] } }) =>
  fn.mock.calls.at(-1) as T;

describe("XYPad value semantics", () => {
  test("defaults to the center, with one named native range input per axis", () => {
    const { inputX, inputY } = renderXYPad();
    expect(inputX.value).toBe("50");
    expect(inputY.value).toBe("50");
    expect(inputX.getAttribute("aria-label")).toBe("Filter X");
    expect(inputY.getAttribute("aria-label")).toBe("Filter Y");
    expect(inputX.getAttribute("aria-orientation")).toBe("horizontal");
    expect(inputY.getAttribute("aria-orientation")).toBe("vertical");
    // only the X input is a tab stop; the arrow keys reach both axes from it
    expect(inputY.tabIndex).toBe(-1);
  });

  test("getAriaLabel names the axes after what they control", () => {
    const { inputX, inputY } = renderXYPad(
      {},
      { getAriaLabel: (axis) => (axis === "x" ? "Cutoff" : "Resonance") }
    );
    expect(inputX.getAttribute("aria-label")).toBe("Cutoff");
    expect(inputY.getAttribute("aria-label")).toBe("Resonance");
  });

  test("clamps out-of-range controlled values per axis", () => {
    const { inputX, inputY } = renderXYPad({ value: { x: 400, y: -20 } });
    expect(inputX.value).toBe("100");
    expect(inputY.value).toBe("0");
  });

  test("treats a NaN axis as that axis's min", () => {
    const { inputX, inputY } = renderXYPad({ value: { x: Number.NaN, y: 30 } });
    expect(inputX.value).toBe("0");
    expect(inputY.value).toBe("30");
  });

  test("positions the thumb and exposes the position as CSS variables (y from the top)", () => {
    const { root, thumb } = renderXYPad({ value: { x: 25, y: 80 } });
    expect(thumb.style.left).toBe("25%");
    expect(thumb.style.top).toBe("20%");
    expect(root.style.getPropertyValue("--xy-pad-x")).toBe("25%");
    expect(root.style.getPropertyValue("--xy-pad-y")).toBe("20%");
  });

  test("Value prints both formatted axes", () => {
    const { value } = renderXYPad({ value: { x: 25, y: 80 } });
    expect(value.textContent).toBe("25, 80");
  });

  test("Value joins the axes with a semicolon where the decimal mark is a comma", () => {
    const { value } = renderXYPad({
      locale: "fr-FR",
      stepX: 0.1,
      stepY: 0.1,
      value: { x: 2.5, y: 0.5 },
    });
    expect(value.textContent).toBe("2,5; 0,5");
  });
});

describe("XYPad keyboard (from {50,50})", () => {
  const cases: [string, Partial<KeyboardEventInit>, Point][] = [
    ["ArrowUp", {}, { x: 50, y: 51 }],
    ["ArrowDown", {}, { x: 50, y: 49 }],
    ["ArrowRight", {}, { x: 51, y: 50 }],
    ["ArrowLeft", {}, { x: 49, y: 50 }],
    ["ArrowRight", { shiftKey: true }, { x: 60, y: 50 }],
    ["PageUp", {}, { x: 50, y: 60 }],
    ["PageDown", {}, { x: 50, y: 40 }],
    ["Home", {}, { x: 0, y: 50 }],
    ["End", {}, { x: 100, y: 50 }],
  ];

  for (const [key, init, expected] of cases) {
    test(`${init.shiftKey ? "Shift+" : ""}${key} changes and commits {${expected.x},${expected.y}}`, () => {
      const { inputX, onValueChange, onValueCommitted } = renderXYPad();
      fireEvent.keyDown(inputX, { key, ...init });
      const [value, details] = lastCall(onValueChange);
      expect(value).toEqual(expected);
      expect(details.reason).toBe("keyboard");
      expect(lastCall(onValueCommitted)[0]).toEqual(expected);
    });
  }

  test("ignores keys when disabled", () => {
    const { inputX, onValueChange } = renderXYPad({ disabled: true });
    fireEvent.keyDown(inputX, { key: "ArrowUp" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(inputX.disabled).toBe(true);
  });
});

describe("XYPad pointer (pad 200×200 at origin)", () => {
  test("a press jumps to the pointed value, a drag follows, release commits", () => {
    const { pad, thumb, onValueChange, onValueCommitted } = renderXYPad();

    fireEvent.pointerDown(pad, { clientX: 50, clientY: 150, pointerId: 1 });
    expect(lastCall(onValueChange)).toEqual([
      { x: 25, y: 25 },
      expect.objectContaining({ reason: "press" }),
    ]);
    expect(thumb.hasAttribute("data-dragging")).toBe(true);

    fireEvent.pointerMove(pad, { clientX: 200, clientY: 0, pointerId: 1 });
    expect(lastCall(onValueChange)).toEqual([
      { x: 100, y: 100 },
      expect.objectContaining({ reason: "drag" }),
    ]);

    fireEvent.pointerUp(pad, { clientX: 200, clientY: 0, pointerId: 1 });
    expect(lastCall(onValueCommitted)).toEqual([
      { x: 100, y: 100 },
      expect.objectContaining({ reason: "drag" }),
    ]);
    expect(thumb.hasAttribute("data-dragging")).toBe(false);
  });

  test("a press without a drag commits with a press reason", () => {
    const { pad, onValueCommitted } = renderXYPad();
    fireEvent.pointerDown(pad, { clientX: 50, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(pad, { clientX: 50, clientY: 150, pointerId: 1 });
    expect(lastCall(onValueCommitted)).toEqual([
      { x: 25, y: 25 },
      expect.objectContaining({ reason: "press" }),
    ]);
  });

  test("a controlled value that lags behind doesn't pull the thumb back mid-drag", () => {
    const { pad, inputX } = renderXYPad({ value: { x: 10, y: 10 } });
    fireEvent.pointerDown(pad, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(inputX.value).toBe("50");
    fireEvent.pointerUp(pad, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(inputX.value).toBe("10");
  });

  test("eventDetails.cancel() rejects the change", () => {
    const { pad, inputX } = renderXYPad({
      onValueChange: (_value, details) => details.cancel(),
    });
    fireEvent.pointerDown(pad, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(inputX.value).toBe("50");
  });
});

describe("XYPad wheel (pad 200×200 at origin)", () => {
  test("moves the point by the scrolled distance: wheel up raises y, wheel right raises x", () => {
    const { pad, onValueChange, onValueCommitted } = renderXYPad();
    fireEvent.wheel(pad, { deltaX: 20, deltaY: -40 });
    expect(lastCall(onValueChange)).toEqual([
      { x: 60, y: 70 },
      expect.objectContaining({ reason: "wheel" }),
    ]);
    expect(lastCall(onValueCommitted)[0]).toEqual({ x: 60, y: 70 });
  });
});

describe("XYPad.Control", () => {
  test("sets touch-action: none and accepts render", () => {
    const { pad } = renderXYPad();
    expect(pad.style.touchAction).toBe("none");
  });
});

describe("XYPad commit", () => {
  test("a gesture that changed the value commits even when it ends back on the start value", () => {
    const { pad, onValueCommitted } = renderXYPad();
    fireEvent.pointerDown(pad, { clientX: 50, clientY: 150, pointerId: 1 });
    fireEvent.pointerMove(pad, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(pad, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(lastCall(onValueCommitted)[0]).toEqual({ x: 50, y: 50 });
  });
});
