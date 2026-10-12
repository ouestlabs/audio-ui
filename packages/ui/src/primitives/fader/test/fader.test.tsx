import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { mockRect } from "../../../../test/helpers.js";
import { Fader } from "../../../entries/fader.js";

/** Defaults: min -60, max 6, step 1, vertical → midpoint default value -27. */
function renderFader(
  props: Fader.Root.Props = {},
  thumbProps: Fader.Thumb.Props = {}
) {
  const onValueChange = mock(
    (_value: number, _details: Fader.Root.ChangeEventDetails) => undefined
  );
  const onValueCommitted = mock(
    (_value: number, _details: Fader.Root.CommitEventDetails) => undefined
  );
  const view = render(
    <Fader.Root
      onValueChange={onValueChange}
      onValueCommitted={onValueCommitted}
      {...props}
    >
      <Fader.Control data-testid="control">
        <Fader.Track>
          <Fader.Indicator data-testid="indicator" />
        </Fader.Track>
        <Fader.Thumb aria-label="Volume" data-testid="thumb" {...thumbProps} />
      </Fader.Control>
    </Fader.Root>
  );
  return {
    control: view.getByTestId("control"),
    indicator: view.getByTestId("indicator"),
    input: view.getByRole("slider") as HTMLInputElement,
    onValueChange,
    onValueCommitted,
    thumb: view.getByTestId("thumb"),
    view,
  };
}

const lastCall = <T extends unknown[]>(fn: { mock: { calls: T[] } }) =>
  fn.mock.calls.at(-1) as T;

describe("Fader reset", () => {
  test("a double click returns to the default, with a reset reason", () => {
    const { control, onValueChange, onValueCommitted } = renderFader({
      defaultValue: -12,
    });
    fireEvent.doubleClick(control);
    // Already at the default: nothing to report.
    expect(onValueChange).not.toHaveBeenCalled();
    mockRect(control, { bottom: 200, height: 200, right: 20, width: 20 });
    fireEvent.pointerDown(control, { clientX: 10, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(document, { pointerId: 1 });
    fireEvent.doubleClick(control);
    expect(lastCall(onValueChange)).toEqual([
      -12,
      expect.objectContaining({ reason: "reset" }),
    ]);
    expect(lastCall(onValueCommitted)[1].reason).toBe("reset");
  });

  test("Alt + click and the Delete key do the same", () => {
    const { control, input, onValueChange } = renderFader({
      defaultValue: -12,
    });
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.pointerDown(control, {
      altKey: true,
      button: 0,
      clientX: 10,
      clientY: 50,
      pointerId: 1,
    });
    expect(lastCall(onValueChange)[1].reason).toBe("reset");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.keyDown(control, { key: "Delete" });
    expect(lastCall(onValueChange)[0]).toBe(-12);
  });
});

describe("Fader value semantics", () => {
  test("defaults to the midpoint, vertical, with an accessible native input", () => {
    const { input } = renderFader();
    expect(input.type).toBe("range");
    expect(input.value).toBe("-27");
    expect(input.getAttribute("aria-label")).toBe("Volume");
    expect(input.getAttribute("aria-orientation")).toBe("vertical");
  });

  test("respects defaultValue when uncontrolled", () => {
    const { input } = renderFader({ defaultValue: -6 });
    expect(input.value).toBe("-6");
  });

  test("formats aria-valuetext with Intl options", () => {
    const { input } = renderFader({
      format: { maximumFractionDigits: 1, minimumFractionDigits: 1 },
      value: -6,
    });
    expect(input.getAttribute("aria-valuetext")).toBe("-6.0");
  });
});

describe("Fader keyboard", () => {
  test("ArrowUp changes and commits +step with a keyboard reason", () => {
    const { input, onValueChange, onValueCommitted } = renderFader();
    fireEvent.keyDown(input, { key: "ArrowUp" });
    const [value, details] = lastCall(onValueChange);
    expect(value).toBe(-26);
    expect(details.reason).toBe("keyboard");
    expect(lastCall(onValueCommitted)[0]).toBe(-26);
    expect(input.value).toBe("-26");
  });

  test("a consumer onKeyDown on the thumb does not replace keyboard control", () => {
    const onKeyDown = mock(() => undefined);
    const { input, onValueChange } = renderFader({}, { onKeyDown });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onKeyDown).toHaveBeenCalled();
    expect(lastCall(onValueChange)[0]).toBe(-26);
  });
});

describe("Fader wheel", () => {
  test("wheel up changes and commits +step with a wheel reason", () => {
    const { control, input, onValueChange, onValueCommitted } = renderFader();
    fireEvent.wheel(control, { deltaY: -100 });
    const [value, details] = lastCall(onValueChange);
    expect(value).toBe(-26);
    expect(details.reason).toBe("wheel");
    expect(lastCall(onValueCommitted)).toEqual([
      -26,
      expect.objectContaining({ reason: "wheel" }),
    ]);
    expect(input.value).toBe("-26");
  });

  test("wheel down changes -step and snaps decimal steps without float noise", () => {
    const { control, onValueChange } = renderFader({
      defaultValue: 0.3,
      max: 1,
      min: 0,
      step: 0.1,
    });
    fireEvent.wheel(control, { deltaY: 100 });
    expect(lastCall(onValueChange)[0]).toBe(0.2);
  });

  test("ignores sub-threshold deltas and clamps at max", () => {
    const { control, onValueChange } = renderFader({ defaultValue: 6 });
    fireEvent.wheel(control, { deltaY: -0.01 });
    fireEvent.wheel(control, { deltaY: -100 });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("eventDetails.cancel() keeps the uncontrolled value", () => {
    const { control, input, onValueCommitted } = renderFader({
      onValueChange: (_value, details) => details.cancel(),
    });
    fireEvent.wheel(control, { deltaY: -100 });
    expect(input.value).toBe("-27");
    expect(onValueCommitted).not.toHaveBeenCalled();
  });

  test("is ignored when disabled", () => {
    const { control, onValueChange } = renderFader({ disabled: true });
    fireEvent.wheel(control, { deltaY: -100 });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("Fader pointer (vertical control 20×200 at origin)", () => {
  test("track press jumps to the pointed value, drag updates, release commits", () => {
    const { control, onValueChange, onValueCommitted } = renderFader();
    mockRect(control, { bottom: 200, height: 200, right: 20, width: 20 });

    fireEvent.pointerDown(control, { clientX: 10, clientY: 0, pointerId: 1 });
    expect(lastCall(onValueChange)).toEqual([
      6,
      expect.objectContaining({ reason: "track-press" }),
    ]);

    fireEvent.pointerMove(document, {
      buttons: 1,
      clientX: 10,
      clientY: 100,
      pointerId: 1,
    });
    expect(lastCall(onValueChange)).toEqual([
      -27,
      expect.objectContaining({ reason: "drag" }),
    ]);

    fireEvent.pointerUp(document, { clientX: 10, clientY: 100, pointerId: 1 });
    expect(lastCall(onValueCommitted)[0]).toBe(-27);
  });
});

describe("Fader drag with a lagging controlled value (horizontal control 200×20 at origin)", () => {
  const seekProps: Fader.Root.Props = {
    max: 100,
    min: 0,
    orientation: "horizontal",
    value: 10,
  };

  test("the thumb follows the pointer until release, then the controlled value rules again", () => {
    const { control, thumb, onValueChange } = renderFader(seekProps);
    mockRect(control, { bottom: 20, height: 20, right: 200, width: 200 });

    fireEvent.pointerDown(control, { clientX: 60, clientY: 10, pointerId: 1 });
    expect(lastCall(onValueChange)[0]).toBe(30);
    expect(thumb.style.insetInlineStart).toBe("30%");

    fireEvent.pointerUp(document, { clientX: 60, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(window, { pointerId: 1 });
    expect(thumb.style.insetInlineStart).toBe("10%");
  });

  test("eventDetails.cancel() keeps the thumb on the controlled value mid-drag", () => {
    const { control, thumb } = renderFader({
      ...seekProps,
      onValueChange: (_value, details) => details.cancel(),
    });
    mockRect(control, { bottom: 20, height: 20, right: 200, width: 200 });

    fireEvent.pointerDown(control, { clientX: 60, clientY: 10, pointerId: 1 });
    expect(thumb.style.insetInlineStart).toBe("10%");
  });
});

describe("Fader.Control", () => {
  test("sets touch-action: none and merges the consumer's style and ref", () => {
    const ref = createRef<HTMLDivElement>();
    const view = render(
      <Fader.Root>
        <Fader.Control data-testid="control" ref={ref} style={{ opacity: 0.5 }}>
          <Fader.Thumb aria-label="Volume" />
        </Fader.Control>
      </Fader.Root>
    );
    const control = view.getByTestId("control");
    expect(control.style.touchAction).toBe("none");
    expect(control.style.opacity).toBe("0.5");
    expect(ref.current).toBe(control as HTMLDivElement);
  });
});

describe("Fader anchor", () => {
  const pan = {
    anchor: 0,
    max: 1,
    min: -1,
    orientation: "horizontal" as const,
    step: 0.01,
  };

  test("fills from the anchor towards a value above it", () => {
    const { indicator } = renderFader({ ...pan, value: 0.5 });
    expect(indicator.style.insetInlineStart).toBe("50%");
    expect(indicator.style.width).toBe("25%");
  });

  test("fills from the anchor towards a value below it", () => {
    const { indicator } = renderFader({ ...pan, value: -0.5 });
    expect(indicator.style.insetInlineStart).toBe("25%");
    expect(indicator.style.width).toBe("25%");
  });

  test("draws nothing on the anchor", () => {
    expect(renderFader({ ...pan, value: 0 }).indicator.style.width).toBe("0%");
  });

  test("fills upwards from the anchor when vertical", () => {
    const { indicator } = renderFader({
      anchor: 0,
      max: 6,
      min: -60,
      value: 6,
    });
    expect(Number.parseFloat(indicator.style.bottom)).toBeCloseTo(
      (60 / 66) * 100
    );
    expect(Number.parseFloat(indicator.style.height)).toBeCloseTo(
      (6 / 66) * 100
    );
  });

  test("keeps the consumer's own render and style", () => {
    const view = render(
      <Fader.Root
        anchor={0}
        max={1}
        min={-1}
        orientation="horizontal"
        value={0.5}
      >
        <Fader.Control>
          <Fader.Track>
            <Fader.Indicator
              data-testid="indicator"
              render={<span />}
              style={{ opacity: 0.5 }}
            />
          </Fader.Track>
          <Fader.Thumb aria-label="Pan" />
        </Fader.Control>
      </Fader.Root>
    );
    const indicator = view.getByTestId("indicator");
    expect(indicator.tagName).toBe("SPAN");
    expect(indicator.style.opacity).toBe("0.5");
    expect(indicator.style.width).toBe("25%");
  });
});

describe("Fader.Mark", () => {
  function renderMarks(props: Fader.Root.Props) {
    return render(
      <Fader.Root {...props}>
        <Fader.Control>
          <Fader.Track />
          <Fader.Thumb aria-label="Volume" />
        </Fader.Control>
        {[-60, -24, 0, 6].map((value) => (
          <Fader.Mark data-testid={`mark-${value}`} key={value} value={value}>
            {value}
          </Fader.Mark>
        ))}
      </Fader.Root>
    );
  }

  test("sits along the travel at its value, from the bottom when vertical", () => {
    const view = renderMarks({ value: -12 });
    const mark = view.getByTestId("mark-0");
    expect(Number.parseFloat(mark.style.bottom)).toBeCloseTo((60 / 66) * 100);
    expect(mark.style.position).toBe("absolute");
    expect(mark.getAttribute("aria-hidden")).toBe("true");
    expect(mark.textContent).toBe("0");
  });

  test("sits from the start when horizontal", () => {
    const view = renderMarks({ orientation: "horizontal", value: -12 });
    const mark = view.getByTestId("mark--60");
    expect(mark.style.insetInlineStart).toBe("0%");
    expect(mark.getAttribute("data-orientation")).toBe("horizontal");
  });

  test("is active while the value has reached it", () => {
    const view = renderMarks({ value: -12 });
    const active = [-60, -24, 0, 6].map((value) =>
      view.getByTestId(`mark-${value}`).hasAttribute("data-active")
    );
    expect(active).toEqual([true, true, false, false]);
  });

  test("counts from the anchor, on either side of it", () => {
    const view = renderMarks({ anchor: 0, value: -30 });
    const active = [-60, -24, 0, 6].map((value) =>
      view.getByTestId(`mark-${value}`).hasAttribute("data-active")
    );
    expect(active).toEqual([false, true, true, false]);
  });
});

describe("Fader keys, thumb press and label", () => {
  test("Page, Home, End and Shift + arrow move by the large step or to the ends", () => {
    const { input } = renderFader({ largeStep: 5 });
    fireEvent.keyDown(input, { key: "PageUp" });
    expect(input.value).toBe("-22");
    fireEvent.keyDown(input, { key: "ArrowDown", shiftKey: true });
    expect(input.value).toBe("-27");
    fireEvent.keyDown(input, { key: "End" });
    expect(input.value).toBe("6");
    fireEvent.keyDown(input, { key: "Home" });
    expect(input.value).toBe("-60");
  });

  test("a press on the thumb drags from where it was taken, without a jump", () => {
    const { control, thumb, onValueChange } = renderFader();
    mockRect(control, { bottom: 200, height: 200, right: 20, width: 20 });
    // The thumb at -27 sits at the middle of the travel.
    mockRect(thumb, { bottom: 110, height: 20, right: 20, top: 90, width: 20 });

    fireEvent.pointerDown(thumb, { clientX: 10, clientY: 95, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.pointerMove(document, {
      buttons: 1,
      clientX: 10,
      clientY: 75,
      pointerId: 1,
    });
    // 20px up from where the thumb was taken: a tenth of the travel, +6.6, on the grid.
    expect(lastCall(onValueChange)[0]).toBe(-20);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });

  test("a Label names the input when the thumb has no name of its own", () => {
    const view = render(
      <Fader.Root>
        <Fader.Label>Gain</Fader.Label>
        <Fader.Control>
          <Fader.Thumb />
        </Fader.Control>
      </Fader.Root>
    );
    const input = view.getByRole("slider");
    const label = view.getByText("Gain");
    expect(input.getAttribute("aria-labelledby")).toBe(label.id);
  });
});
