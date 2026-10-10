import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../../../test/helpers";
import { Knob } from "../../../knob";

/** Defaults: min 0, max 100, step 1 → midpoint default value 50. */
function renderKnob(
  props: Knob.Root.Props = {},
  thumbProps: Knob.Thumb.Props = {}
) {
  const onValueChange = mock(
    (_value: number, _details: Knob.Root.ChangeEventDetails) => undefined
  );
  const onValueCommitted = mock(
    (_value: number, _details: Knob.Root.CommitEventDetails) => undefined
  );
  const view = render(
    <Knob.Root
      onValueChange={onValueChange}
      onValueCommitted={onValueCommitted}
      {...props}
    >
      <Knob.Control data-testid="control">
        <Knob.Track data-testid="track" />
        <Knob.Indicator data-testid="indicator" />
        <Knob.Thumb aria-label="Cutoff" data-testid="thumb" {...thumbProps} />
      </Knob.Control>
      <Knob.Value data-testid="value" />
    </Knob.Root>
  );
  const control = view.getByTestId("control");
  // a 100×100 knob at the origin: center (50, 50)
  mockRect(control, { bottom: 100, height: 100, right: 100, width: 100 });
  return {
    control,
    indicator: view.getByTestId("indicator"),
    input: view.getByRole("slider") as HTMLInputElement,
    onValueChange,
    onValueCommitted,
    thumb: view.getByTestId("thumb"),
    track: view.getByTestId("track"),
    value: view.getByTestId("value"),
    view,
  };
}

const disabledClassName = (state: Knob.Control.State) =>
  state.disabled ? "is-disabled" : "";

const lastCall = <T extends unknown[]>(fn: { mock: { calls: T[] } }) =>
  fn.mock.calls.at(-1) as T;

function tap(control: HTMLElement, pointerId: number) {
  fireEvent.pointerDown(control, { clientX: 50, clientY: 10, pointerId });
  fireEvent.pointerUp(control, { clientX: 50, clientY: 10, pointerId });
}

describe("Knob value semantics", () => {
  test("defaults to the midpoint, with an accessible native range input", () => {
    const { input } = renderKnob();
    expect(input.type).toBe("range");
    expect(input.value).toBe("50");
    expect(input.min).toBe("0");
    expect(input.max).toBe("100");
    expect(input.getAttribute("aria-label")).toBe("Cutoff");
  });

  test("respects defaultValue and clamps an out-of-range controlled value", () => {
    expect(renderKnob({ defaultValue: 12 }).input.value).toBe("12");
  });

  test("clamps an out-of-range controlled value", () => {
    expect(renderKnob({ value: 400 }).input.value).toBe("100");
  });

  test("formats the value for Knob.Value and aria-valuetext", () => {
    const { input, value } = renderKnob({
      format: { style: "percent" },
      max: 1,
      min: 0,
      step: 0.01,
      value: 0.25,
    });
    expect(value.textContent).toBe("25%");
    expect(input.getAttribute("aria-valuetext")).toBe("25%");
  });

  test("getAriaValueText customizes the announced value", () => {
    const { input } = renderKnob(
      { max: 6, min: -60, value: -6 },
      { getAriaValueText: (formatted) => `${formatted} dB` }
    );
    expect(input.getAttribute("aria-valuetext")).toBe("-6 dB");
  });
});

describe("Knob rendering", () => {
  test("the thumb rotates with the value over a 288° sweep from 216°", () => {
    const atMin = renderKnob({ value: 0 });
    expect(atMin.thumb.style.rotate).toBe("216deg");
    atMin.view.unmount();
    expect(renderKnob({ value: 100 }).thumb.style.rotate).toBe("504deg");
  });

  test("Track draws the full arc; Indicator draws nothing at its anchor", () => {
    const { track, indicator } = renderKnob({ value: 0 });
    expect(track.querySelector("path")).not.toBeNull();
    expect(indicator.querySelector("path")).toBeNull();
  });

  test("Indicator grows from the anchor", () => {
    const { indicator } = renderKnob({
      anchor: 0,
      max: 1,
      min: -1,
      value: 0.5,
    });
    expect(indicator.querySelector("path")).not.toBeNull();
  });

  test("className and style accept functions of state; render swaps the element", () => {
    const view = render(
      <Knob.Root disabled>
        <Knob.Control
          className={disabledClassName}
          data-testid="control"
          render={<section />}
        >
          <Knob.Thumb aria-label="Cutoff" />
        </Knob.Control>
      </Knob.Root>
    );
    const control = view.getByTestId("control");
    expect(control.tagName).toBe("SECTION");
    expect(control.className).toBe("is-disabled");
    expect(control.hasAttribute("data-disabled")).toBe(true);
    expect(control.style.touchAction).toBe("none");
  });
});

describe("Knob keyboard", () => {
  const cases: [string, Partial<KeyboardEventInit>, number][] = [
    ["ArrowUp", {}, 51],
    ["ArrowRight", {}, 51],
    ["ArrowDown", {}, 49],
    ["ArrowUp", { shiftKey: true }, 60],
    ["PageUp", {}, 60],
    ["PageDown", {}, 40],
    ["Home", {}, 0],
    ["End", {}, 100],
  ];

  for (const [key, init, expected] of cases) {
    test(`${init.shiftKey ? "Shift+" : ""}${key} changes and commits ${expected}`, () => {
      const { input, onValueChange, onValueCommitted } = renderKnob();
      fireEvent.keyDown(input, { key, ...init });
      const [value, details] = lastCall(onValueChange);
      expect(value).toBe(expected);
      expect(details.reason).toBe("keyboard");
      expect(lastCall(onValueCommitted)[0]).toBe(expected);
      expect(input.value).toBe(String(expected));
    });
  }

  test("a consumer onKeyDown on the thumb runs alongside keyboard control", () => {
    const onKeyDown = mock(() => undefined);
    const { input, onValueChange } = renderKnob({}, { onKeyDown });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onKeyDown).toHaveBeenCalled();
    expect(lastCall(onValueChange)[0]).toBe(51);
  });

  test("is ignored when disabled", () => {
    const { input, onValueChange } = renderKnob({ disabled: true });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.disabled).toBe(true);
  });
});

describe("Knob wheel", () => {
  test("wheel up changes and commits +step with a wheel reason", () => {
    const { control, onValueChange, onValueCommitted } = renderKnob();
    fireEvent.wheel(control, { deltaY: -100 });
    expect(lastCall(onValueChange)).toEqual([
      51,
      expect.objectContaining({ reason: "wheel" }),
    ]);
    expect(lastCall(onValueCommitted)[0]).toBe(51);
  });

  test("eventDetails.cancel() rejects the change", () => {
    const { control, input, onValueCommitted } = renderKnob({
      onValueChange: (_value, details) => details.cancel(),
    });
    fireEvent.wheel(control, { deltaY: -100 });
    expect(input.value).toBe("50");
    expect(onValueCommitted).not.toHaveBeenCalled();
  });
});

describe("Knob drag modes", () => {
  test("circular: a quarter turn clockwise adds a quarter turn of the 288° sweep", () => {
    const { control, onValueChange, onValueCommitted } = renderKnob();
    fireEvent.pointerDown(control, { clientX: 50, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(control, { clientX: 100, clientY: 50, pointerId: 1 });
    // 90° / 288° × 100 = 31.25 → 81 after the step snap
    expect(lastCall(onValueChange)).toEqual([
      81,
      expect.objectContaining({ reason: "drag" }),
    ]);
    fireEvent.pointerUp(control, { clientX: 100, clientY: 50, pointerId: 1 });
    expect(lastCall(onValueCommitted)).toEqual([
      81,
      expect.objectContaining({ reason: "drag" }),
    ]);
  });

  test("revolution: a quarter turn adds a quarter of the range", () => {
    const { control, onValueChange } = renderKnob({ dragMode: "revolution" });
    fireEvent.pointerDown(control, { clientX: 50, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(control, { clientX: 100, clientY: 50, pointerId: 1 });
    expect(lastCall(onValueChange)[0]).toBe(75);
  });

  test("vertical: 150 px of upward travel spans the whole range", () => {
    const { control, onValueChange } = renderKnob({ dragMode: "vertical" });
    fireEvent.pointerDown(control, { clientX: 50, clientY: 90, pointerId: 1 });
    fireEvent.pointerMove(control, { clientX: 50, clientY: 75, pointerId: 1 });
    expect(lastCall(onValueChange)[0]).toBe(60);
  });

  test("marks the parts with data-dragging while a pointer drags", () => {
    const { control, thumb } = renderKnob();
    fireEvent.pointerDown(control, { clientX: 50, clientY: 0, pointerId: 1 });
    expect(thumb.hasAttribute("data-dragging")).toBe(true);
    fireEvent.pointerUp(control, { clientX: 50, clientY: 0, pointerId: 1 });
    expect(thumb.hasAttribute("data-dragging")).toBe(false);
  });

  test("a controlled value that lags behind doesn't pull the knob back mid-drag", () => {
    const { control, input } = renderKnob({ dragMode: "vertical", value: 10 });
    fireEvent.pointerDown(control, { clientX: 50, clientY: 90, pointerId: 1 });
    fireEvent.pointerMove(control, { clientX: 50, clientY: 75, pointerId: 1 });
    expect(input.value).toBe("20");
    fireEvent.pointerUp(control, { clientX: 50, clientY: 75, pointerId: 1 });
    expect(input.value).toBe("10");
  });
});

describe("Knob double-tap reset", () => {
  test("two quick taps reset to defaultValue with a reset reason", () => {
    const { control, input, onValueCommitted } = renderKnob({
      defaultValue: 30,
    });
    fireEvent.keyDown(input, { key: "End" });
    tap(control, 1);
    tap(control, 2);
    expect(input.value).toBe("30");
    expect(lastCall(onValueCommitted)).toEqual([
      30,
      expect.objectContaining({ reason: "reset" }),
    ]);
  });

  test("without defaultValue, resets to the midpoint of min…max", () => {
    const { control, input } = renderKnob({ max: 20_000, min: 20 });
    fireEvent.keyDown(input, { key: "Home" });
    tap(control, 1);
    tap(control, 2);
    expect(input.value).toBe("10010");
  });
});

describe("Knob fine drag", () => {
  test("Shift turns the knob four times slower than the pointer moves", () => {
    const { control, onValueChange } = renderKnob({ dragMode: "vertical" });
    fireEvent.pointerDown(control, { clientX: 50, clientY: 90, pointerId: 1 });
    fireEvent.pointerMove(control, {
      clientX: 50,
      clientY: 30,
      pointerId: 1,
      shiftKey: true,
    });
    // 60px is 40 at full speed, 10 when fine
    expect(lastCall(onValueChange)[0]).toBe(60);
  });

  test("only the stretch moved with Shift held is fine", () => {
    const { control, onValueChange } = renderKnob({ dragMode: "vertical" });
    fireEvent.pointerDown(control, { clientX: 50, clientY: 90, pointerId: 1 });
    fireEvent.pointerMove(control, { clientX: 50, clientY: 75, pointerId: 1 });
    fireEvent.pointerMove(control, {
      clientX: 50,
      clientY: 15,
      pointerId: 1,
      shiftKey: true,
    });
    // 15px at full speed is 10, then 60px fine is 10 more
    expect(lastCall(onValueChange)[0]).toBe(70);
  });

  test("small fine moves add up rather than rounding away", () => {
    const { control, onValueChange } = renderKnob({ dragMode: "vertical" });
    fireEvent.pointerDown(control, { clientX: 50, clientY: 90, pointerId: 1 });
    for (let y = 89; y >= 84; y -= 1) {
      fireEvent.pointerMove(control, {
        clientX: 50,
        clientY: y,
        pointerId: 1,
        shiftKey: true,
      });
    }
    // Six 1px moves, each a sixth of a step when fine: one step in all
    expect(lastCall(onValueChange)[0]).toBe(51);
  });
});

describe("Knob scale", () => {
  const frequency = { max: 20_000, min: 20, scale: "log" as const };

  test("log puts the geometric middle at the middle of the dial", () => {
    const { thumb } = renderKnob({ ...frequency, value: 632.4555 });
    // 216° at min plus half of the 288° sweep
    expect(Number.parseFloat(thumb.style.rotate)).toBeCloseTo(360, 1);
  });

  test("without a defaultValue, starts and resets at the middle of the travel", () => {
    const { input } = renderKnob(frequency);
    expect(input.value).toBe("632");
  });

  test("a drag moves along the travel, not the values", () => {
    const { control, onValueChange } = renderKnob({
      ...frequency,
      defaultValue: 20,
      dragMode: "vertical",
    });
    fireEvent.pointerDown(control, { clientX: 50, clientY: 90, pointerId: 1 });
    fireEvent.pointerMove(control, { clientX: 50, clientY: 40, pointerId: 1 });
    // A third of the travel: from 20 Hz up a decade
    expect(lastCall(onValueChange)[0]).toBe(200);
  });

  test("away from linear, keys move a share of the travel", () => {
    const { input, onValueChange } = renderKnob({
      ...frequency,
      defaultValue: 1000,
    });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    // 1% of three decades is a factor of 10^0.03
    expect(lastCall(onValueChange)[0]).toBe(Math.round(1000 * 10 ** 0.03));
    fireEvent.keyDown(input, { key: "PageDown" });
    expect(lastCall(onValueChange)[0]).toBe(
      Math.round(Math.round(1000 * 10 ** 0.03) * 10 ** -0.3)
    );
  });

  test("a key always moves at least one step", () => {
    const { input, onValueChange } = renderKnob({
      ...frequency,
      defaultValue: 20,
      step: 5,
    });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(lastCall(onValueChange)[0]).toBe(25);
  });

  test("the indicator grows from an anchor placed on the scale", () => {
    const { indicator } = renderKnob({
      ...frequency,
      anchor: 632.4555,
      value: 632.4555,
    });
    expect(indicator.querySelector("path")).toBeNull();
  });

  test("takes a scale of your own", () => {
    const squared = {
      toPosition: (value: number, min: number, max: number) =>
        Math.sqrt((value - min) / (max - min)),
      toValue: (position: number, min: number, max: number) =>
        min + position ** 2 * (max - min),
    };
    const { thumb } = renderKnob({ scale: squared, value: 25 });
    expect(thumb.style.rotate).toBe("360deg");
  });
});

describe("Knob.Mark", () => {
  function renderMarks(props: Knob.Root.Props, values: number[]) {
    return render(
      <Knob.Root {...props}>
        <Knob.Control>
          <Knob.Thumb aria-label="Cutoff" />
        </Knob.Control>
        {values.map((value) => (
          <Knob.Mark data-testid={`mark-${value}`} key={value} value={value} />
        ))}
      </Knob.Root>
    );
  }

  test("turns to where its value sits on the 288° sweep from 216°", () => {
    const view = renderMarks({ value: 50 }, [0, 50, 100]);
    const angles = [0, 50, 100].map(
      (value) => view.getByTestId(`mark-${value}`).style.rotate
    );
    expect(angles).toEqual(["216deg", "360deg", "504deg"]);
    expect(
      view.getByTestId("mark-50").style.getPropertyValue("--knob-mark-angle")
    ).toBe("360deg");
  });

  test("follows the scale: on a log dial, 632 Hz sits at the top", () => {
    const view = renderMarks(
      { max: 20_000, min: 20, scale: "log", value: 1000 },
      [20, 632.4555, 20_000]
    );
    expect(
      Number.parseFloat(view.getByTestId("mark-632.4555").style.rotate)
    ).toBeCloseTo(360, 1);
  });

  test("is active while the value has reached it from the anchor", () => {
    const view = renderMarks(
      { anchor: 0, max: 1, min: -1, step: 0.1, value: 0.5 },
      [-1, 0, 0.5, 1]
    );
    const active = [-1, 0, 0.5, 1].map((value) =>
      view.getByTestId(`mark-${value}`).hasAttribute("data-active")
    );
    expect(active).toEqual([false, true, true, false]);
  });

  test("is decorative", () => {
    const view = renderMarks({ value: 50 }, [0]);
    expect(view.getByTestId("mark-0").getAttribute("aria-hidden")).toBe("true");
  });
});
