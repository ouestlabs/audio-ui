import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../test/helpers";
import { XYPad } from "./xypad";

/** Defaults: 0-100 on both axes, step 1, defaultValue {0,0}. */
function renderXYPad(props: XYPad.RootProps = {}) {
  const onValueChange = mock(() => undefined);
  const onValueCommit = mock(() => undefined);
  const view = render(
    <XYPad.Root
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      {...props}
    >
      <XYPad.Slider data-testid="pad">
        <XYPad.Grid />
        <XYPad.Crosshair orientation="vertical" />
        <XYPad.Crosshair orientation="horizontal" />
        <XYPad.Cursor data-testid="cursor" />
      </XYPad.Slider>
      <XYPad.ValueDisplay data-testid="display" />
      <XYPad.Label data-testid="label" />
    </XYPad.Root>
  );
  return {
    cursor: view.getByTestId("cursor"),
    display: view.getByTestId("display"),
    label: view.getByTestId("label"),
    onValueChange,
    onValueCommit,
    pad: view.getByTestId("pad"),
    view,
  };
}

describe("XYPad value semantics", () => {
  test("defaults to {0,0} with role group and accessible label", () => {
    const { pad, cursor, label } = renderXYPad();
    expect(pad.getAttribute("role")).toBe("group");
    expect(pad.getAttribute("aria-label")).toBe("XY Pad");
    expect(cursor.style.left).toBe("0%");
    expect(cursor.style.top).toBe("100%");
    expect(label.textContent).toBe("X: 0.0, Y: 0.0");
  });

  test("clamps out-of-range controlled values per axis", () => {
    const { cursor, display } = renderXYPad({ value: { x: 150, y: -20 } });
    expect(cursor.style.left).toBe("100%");
    expect(cursor.style.top).toBe("100%");
    expect(display.textContent).toBe("100, 0");
  });

  test("treats a NaN axis as that axis's min", () => {
    const { display } = renderXYPad({ value: { x: Number.NaN, y: 50 } });
    expect(display.textContent).toBe("0, 50");
  });

  test("positions the cursor from both axes (y inverted)", () => {
    const { cursor } = renderXYPad({ defaultValue: { x: 25, y: 75 } });
    expect(cursor.style.left).toBe("25%");
    expect(cursor.style.top).toBe("25%");
  });
});

describe("XYPad keyboard (from {50,50})", () => {
  const start = { defaultValue: { x: 50, y: 50 } };
  const cases: [string, { x: number; y: number }][] = [
    ["ArrowRight", { x: 51, y: 50 }],
    ["ArrowLeft", { x: 49, y: 50 }],
    ["ArrowUp", { x: 50, y: 51 }],
    ["ArrowDown", { x: 50, y: 49 }],
    ["Home", { x: 0, y: 100 }],
    ["End", { x: 100, y: 0 }],
    ["PageUp", { x: 50, y: 60 }],
    ["PageDown", { x: 50, y: 40 }],
  ];

  for (const [key, expected] of cases) {
    test(`${key} commits {${expected.x},${expected.y}}`, () => {
      const { pad, onValueCommit } = renderXYPad(start);
      fireEvent.keyDown(pad, { key });
      expect(onValueCommit).toHaveBeenLastCalledWith(expected);
    });
  }

  test("ignores keys when disabled", () => {
    const { pad, onValueCommit } = renderXYPad({
      ...start,
      disabled: true,
    });
    fireEvent.keyDown(pad, { key: "ArrowUp" });
    expect(onValueCommit).not.toHaveBeenCalled();
    expect(pad.tabIndex).toBe(-1);
  });
});

describe("XYPad drag (pad 200×200 at origin)", () => {
  test("pointer down jumps to the pointed value, drag updates, release commits", () => {
    const { pad, onValueChange, onValueCommit } = renderXYPad();
    mockRect(pad, { height: 200, width: 200 });

    fireEvent.pointerDown(pad, { clientX: 100, clientY: 50, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith({ x: 50, y: 75 });

    fireEvent.pointerMove(pad, { clientX: 150, clientY: 150, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith({ x: 75, y: 25 });

    fireEvent.pointerUp(pad, { clientX: 150, clientY: 150, pointerId: 1 });
    expect(onValueCommit).toHaveBeenLastCalledWith({ x: 75, y: 25 });
  });
});

describe("XYPad wheel (pad 200×200 at origin)", () => {
  test("deltaY moves y, deltaX moves x inverted, both commit", () => {
    const { pad, onValueCommit } = renderXYPad({
      defaultValue: { x: 50, y: 50 },
    });
    mockRect(pad, { height: 200, width: 200 });

    fireEvent.wheel(pad, { deltaX: 0, deltaY: 100 });
    expect(onValueCommit).toHaveBeenLastCalledWith({ x: 50, y: 100 });

    fireEvent.wheel(pad, { deltaX: 100, deltaY: 0 });
    expect(onValueCommit).toHaveBeenLastCalledWith({ x: 0, y: 100 });
  });
});
