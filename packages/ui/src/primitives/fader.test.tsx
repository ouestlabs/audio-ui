import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { mockRect } from "../../test/helpers";
import { Fader } from "../fader";

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
          <Fader.Indicator />
        </Fader.Track>
        <Fader.Thumb aria-label="Volume" data-testid="thumb" {...thumbProps} />
      </Fader.Control>
    </Fader.Root>
  );
  return {
    control: view.getByTestId("control"),
    input: view.getByRole("slider") as HTMLInputElement,
    onValueChange,
    onValueCommitted,
    thumb: view.getByTestId("thumb"),
    view,
  };
}

const lastCall = <T extends unknown[]>(fn: { mock: { calls: T[] } }) =>
  fn.mock.calls.at(-1) as T;

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
