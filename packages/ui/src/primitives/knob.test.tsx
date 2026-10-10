import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { Knob } from "./knob";

/** Defaults: min 0, max 100, step 1 → midpoint default value 50. */
function renderKnob(props: Knob.RootProps = {}) {
  const onValueChange = mock(() => undefined);
  const onValueCommit = mock(() => undefined);
  const view = render(
    <Knob.Root
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      {...props}
    >
      <Knob.Slider data-testid="knob">
        <Knob.Arc />
        <Knob.Body />
        <Knob.Indicator />
      </Knob.Slider>
    </Knob.Root>
  );
  return {
    knob: view.getByTestId("knob"),
    onValueChange,
    onValueCommit,
    view,
  };
}

describe("Knob value semantics", () => {
  test("defaults to the midpoint with role slider on the Slider part", () => {
    const { knob } = renderKnob();
    expect(knob.getAttribute("role")).toBe("slider");
    expect(knob.getAttribute("aria-valuemin")).toBe("0");
    expect(knob.getAttribute("aria-valuemax")).toBe("100");
    expect(knob.getAttribute("aria-valuenow")).toBe("50");
  });

  test("respects defaultValue when uncontrolled", () => {
    const { knob } = renderKnob({ defaultValue: 0 });
    expect(knob.getAttribute("aria-valuenow")).toBe("0");
  });

  test("clamps an out-of-range controlled value", () => {
    const { knob } = renderKnob({ value: 400 });
    expect(knob.getAttribute("aria-valuenow")).toBe("100");
  });
});

describe("Knob keyboard", () => {
  const cases: [string, number][] = [
    ["ArrowUp", 51],
    ["ArrowRight", 51],
    ["Home", 0],
    ["End", 100],
    ["PageUp", 60],
  ];

  for (const [key, expected] of cases) {
    test(`${key} commits ${expected} from the default 50`, () => {
      const { knob, onValueCommit } = renderKnob();
      fireEvent.keyDown(knob, { key });
      expect(onValueCommit).toHaveBeenLastCalledWith(expected);
    });
  }

  test("ignores keys when disabled", () => {
    const { knob, onValueCommit } = renderKnob({ disabled: true });
    fireEvent.keyDown(knob, { key: "ArrowUp" });
    expect(onValueCommit).not.toHaveBeenCalled();
    expect(knob.tabIndex).toBe(-1);
  });
});

describe("Knob wheel", () => {
  test("wheel up commits +step", () => {
    const { knob, onValueCommit } = renderKnob();
    fireEvent.wheel(knob, { deltaY: -100 });
    expect(onValueCommit).toHaveBeenLastCalledWith(51);
  });
});

describe("Knob double-tap reset", () => {
  test("two quick motionless taps reset to defaultValue", () => {
    const { knob, onValueCommit } = renderKnob({ defaultValue: 50 });
    fireEvent.keyDown(knob, { key: "End" });
    expect(knob.getAttribute("aria-valuenow")).toBe("100");

    fireEvent.pointerDown(knob, { clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerUp(knob, { clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerDown(knob, { clientX: 5, clientY: 5, pointerId: 2 });
    fireEvent.pointerUp(knob, { clientX: 5, clientY: 5, pointerId: 2 });

    expect(onValueCommit).toHaveBeenLastCalledWith(50);
    expect(knob.getAttribute("aria-valuenow")).toBe("50");
  });
});

describe("Knob double-tap reset without defaultValue", () => {
  test("resets to the midpoint of min…max", () => {
    const { knob, onValueCommit } = renderKnob({ max: 20_000, min: 20 });
    fireEvent.keyDown(knob, { key: "Home" });
    expect(knob.getAttribute("aria-valuenow")).toBe("20");

    fireEvent.pointerDown(knob, { clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerUp(knob, { clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerDown(knob, { clientX: 5, clientY: 5, pointerId: 2 });
    fireEvent.pointerUp(knob, { clientX: 5, clientY: 5, pointerId: 2 });

    expect(onValueCommit).toHaveBeenLastCalledWith(10_010);
  });
});
