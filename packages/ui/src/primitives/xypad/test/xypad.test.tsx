import { describe, expect, mock, test } from "bun:test";
import type { Point } from "@audio-ui/core";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../../../test/helpers";
import { XYPad } from "../../../entries/xypad";

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

describe("XYPad reset", () => {
  test("a double click, an Alt + click and Delete return to the default", () => {
    const { inputX, onValueChange, pad } = renderXYPad({
      defaultValue: { x: 20, y: 80 },
    });
    fireEvent.pointerDown(pad, { clientX: 150, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(pad, { pointerId: 1 });
    fireEvent.doubleClick(pad);
    expect(lastCall(onValueChange)[0]).toEqual({ x: 20, y: 80 });
    expect(lastCall(onValueChange)[1].reason).toBe("reset");

    fireEvent.pointerDown(pad, { clientX: 150, clientY: 50, pointerId: 2 });
    fireEvent.pointerUp(pad, { pointerId: 2 });
    fireEvent.pointerDown(pad, {
      altKey: true,
      button: 0,
      clientX: 150,
      clientY: 50,
      pointerId: 3,
    });
    expect(lastCall(onValueChange)[0]).toEqual({ x: 20, y: 80 });

    fireEvent.pointerDown(pad, { clientX: 150, clientY: 50, pointerId: 4 });
    fireEvent.pointerUp(pad, { pointerId: 4 });
    fireEvent.keyDown(inputX, { key: "Delete" });
    expect(lastCall(onValueChange)[0]).toEqual({ x: 20, y: 80 });
  });
});

describe("XYPad lost release", () => {
  test("a mouse coming back with no button down ends the drag instead of resuming it", () => {
    const { onValueChange, onValueCommitted, pad } = renderXYPad();
    const mouse = { pointerId: 1, pointerType: "mouse" };
    fireEvent.pointerDown(pad, { clientX: 50, clientY: 150, ...mouse });
    fireEvent.pointerMove(pad, {
      buttons: 1,
      clientX: 100,
      clientY: 100,
      ...mouse,
    });
    const changes = onValueChange.mock.calls.length;
    expect(changes).toBeGreaterThan(0);

    fireEvent.pointerMove(pad, {
      buttons: 0,
      clientX: 150,
      clientY: 50,
      ...mouse,
    });
    expect(onValueChange.mock.calls.length).toBe(changes);
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
  });
});

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

describe("XYPad state attributes", () => {
  test("data-dragging is on the root and the pad only while a pointer drags", () => {
    const { pad, root } = renderXYPad();
    expect(root.hasAttribute("data-dragging")).toBe(false);
    fireEvent.pointerDown(pad, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(root.hasAttribute("data-dragging")).toBe(true);
    expect(pad.hasAttribute("data-dragging")).toBe(true);
    fireEvent.pointerUp(pad, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(root.hasAttribute("data-dragging")).toBe(false);
  });

  test("data-disabled is present on every part when disabled", () => {
    const { pad, root, thumb } = renderXYPad({ disabled: true });
    expect(root.hasAttribute("data-disabled")).toBe(true);
    expect(pad.hasAttribute("data-disabled")).toBe(true);
    expect(thumb.hasAttribute("data-disabled")).toBe(true);
  });

  test("a disabled pad ignores the pointer", () => {
    const { onValueChange, pad } = renderXYPad({ disabled: true });
    fireEvent.pointerDown(pad, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(pad, { clientX: 60, clientY: 60, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("XYPad axes", () => {
  test("each axis has its own range and step", () => {
    const { onValueChange, pad } = renderXYPad({
      defaultValue: { x: 0, y: 0 },
      maxX: 1,
      maxY: 1000,
      minX: -1,
      minY: 0,
      stepX: 0.5,
      stepY: 100,
    });
    // The right edge is x = 1, a quarter of the way up is y = 250, which steps to 300
    fireEvent.pointerDown(pad, { clientX: 200, clientY: 150, pointerId: 1 });
    expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual({ x: 1, y: 300 });
  });

  test("the native inputs carry each axis's bounds", () => {
    const { inputX, inputY } = renderXYPad({
      maxX: 1,
      maxY: 1000,
      minX: -1,
      minY: 10,
      stepX: 0.5,
      stepY: 100,
    });
    expect([inputX.min, inputX.max, inputX.step]).toEqual(["-1", "1", "0.5"]);
    expect([inputY.min, inputY.max, inputY.step]).toEqual([
      "10",
      "1000",
      "100",
    ]);
  });

  test("typing into an axis's native input moves that axis and says it came from the input", () => {
    const { inputX, onValueChange, onValueCommitted } = renderXYPad();
    fireEvent.change(inputX, { target: { value: "80" } });
    expect(onValueChange.mock.calls.at(-1)).toEqual([
      { x: 80, y: 50 },
      expect.objectContaining({ reason: "input-change" }),
    ]);
    expect(onValueCommitted.mock.calls.at(-1)?.[0]).toEqual({ x: 80, y: 50 });
  });
});

describe("XYPad.Label", () => {
  test("names the pad's inputs through aria-labelledby", () => {
    const view = render(
      <XYPad.Root locale="en-US">
        <XYPad.Label data-testid="label">Filter</XYPad.Label>
        <XYPad.Control>
          <XYPad.Thumb />
        </XYPad.Control>
      </XYPad.Root>
    );
    const label = view.getByTestId("label");
    const [inputX] = view.getAllByRole("slider");
    expect(label.id).not.toBe("");
    expect(inputX?.getAttribute("aria-labelledby")).toContain(label.id);
  });
});

describe("XYPad in a form", () => {
  test("submits both axes as name.x and name.y", () => {
    const view = render(
      <form data-testid="form">
        <XYPad.Root defaultValue={{ x: 10, y: 20 }} name="pad">
          <XYPad.Control>
            <XYPad.Thumb aria-label="Pad" />
          </XYPad.Control>
        </XYPad.Root>
      </form>
    );
    const data = new FormData(view.getByTestId("form") as HTMLFormElement);
    expect([...data.entries()]).toEqual([
      ["pad.x", "10"],
      ["pad.y", "20"],
    ]);
  });

  test("submits nothing without a name", () => {
    const view = render(
      <form data-testid="form">
        <XYPad.Root>
          <XYPad.Control>
            <XYPad.Thumb aria-label="Pad" />
          </XYPad.Control>
        </XYPad.Root>
      </form>
    );
    expect([
      ...new FormData(view.getByTestId("form") as HTMLFormElement).entries(),
    ]).toEqual([]);
  });
});
