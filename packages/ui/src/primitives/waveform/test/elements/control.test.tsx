import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../../../../test/helpers";
import { Waveform } from "../../../../entries/waveform";
import { lastCall, renderWaveform } from "../helpers";

describe("Waveform.Control keyboard (from 50 of 100)", () => {
  const cases: [string, Partial<KeyboardEventInit>, number][] = [
    ["ArrowRight", {}, 51],
    ["ArrowLeft", {}, 49],
    ["ArrowRight", { shiftKey: true }, 60],
    ["PageUp", {}, 60],
    ["PageDown", {}, 40],
    ["Home", {}, 0],
    ["End", {}, 100],
  ];

  for (const [key, init, expected] of cases) {
    test(`${init.shiftKey ? "Shift+" : ""}${key} seeks to ${expected} and commits`, () => {
      const { input, onValueChange, onValueCommitted, position } =
        renderWaveform({ defaultValue: 50 });
      fireEvent.keyDown(input, { key, ...init });
      const [value, details] = lastCall(onValueChange);
      expect(value).toBe(expected);
      expect(details.reason).toBe("keyboard");
      expect(lastCall(onValueCommitted)[0]).toBe(expected);
      expect(position()).toBe(`${expected}%`);
    });
  }

  test("is ignored when disabled", () => {
    const { input, onValueChange } = renderWaveform({ disabled: true });
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.disabled).toBe(true);
  });
});

describe("Waveform.Control pointer (control 200×40, 100s)", () => {
  test("a press jumps to the pointer, a drag scrubs, release commits", () => {
    const { control, onValueChange, onValueCommitted, position } =
      renderWaveform();

    fireEvent.pointerDown(control, { clientX: 60, clientY: 20, pointerId: 1 });
    expect(lastCall(onValueChange)).toEqual([
      30,
      expect.objectContaining({ reason: "press" }),
    ]);
    expect(control.hasAttribute("data-dragging")).toBe(true);

    fireEvent.pointerMove(control, { clientX: 100, clientY: 20, pointerId: 1 });
    expect(lastCall(onValueChange)).toEqual([
      50,
      expect.objectContaining({ reason: "drag" }),
    ]);
    expect(position()).toBe("50%");

    fireEvent.pointerUp(control, { clientX: 100, clientY: 20, pointerId: 1 });
    expect(lastCall(onValueCommitted)).toEqual([
      50,
      expect.objectContaining({ reason: "drag" }),
    ]);
    expect(control.hasAttribute("data-dragging")).toBe(false);
  });

  test("a controlled position that lags behind doesn't pull the playhead back mid-scrub", () => {
    const { control, position } = renderWaveform({ value: 10 });
    fireEvent.pointerDown(control, { clientX: 100, clientY: 20, pointerId: 1 });
    expect(position()).toBe("50%");
    fireEvent.pointerUp(control, { clientX: 100, clientY: 20, pointerId: 1 });
    expect(position()).toBe("10%");
  });

  test("eventDetails.cancel() rejects the seek", () => {
    const { control, position } = renderWaveform({
      onValueChange: (_value, details) => details.cancel(),
    });
    fireEvent.pointerDown(control, { clientX: 100, clientY: 20, pointerId: 1 });
    expect(position()).toBe("0%");
  });

  test("ignores pointer input when disabled", () => {
    const { control, onValueChange } = renderWaveform({ disabled: true });
    fireEvent.pointerDown(control, { clientX: 100, clientY: 20, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("sets touch-action: none on the control", () => {
    expect(renderWaveform().control.style.touchAction).toBe("none");
  });
});

describe("Waveform.Control while loading", () => {
  function renderLoading() {
    const onValueChange = mock((_value: number) => undefined);
    const view = render(
      <Waveform.Root duration={100} loading onValueChange={onValueChange}>
        <Waveform.Control aria-label="Seek" data-testid="control">
          <Waveform.Hover data-testid="hover" />
        </Waveform.Control>
      </Waveform.Root>
    );
    const control = view.getByTestId("control");
    mockRect(control, { right: 200, width: 200 });
    return { control, onValueChange, view };
  }

  test("marks its parts with data-loading", () => {
    expect(renderLoading().control.hasAttribute("data-loading")).toBe(true);
  });

  test("waits before seeking: pointer, keyboard and hover are ignored", () => {
    const { control, onValueChange, view } = renderLoading();
    fireEvent.pointerDown(control, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(control, { clientX: 120, pointerId: 1 });
    fireEvent.keyDown(view.getByRole("slider"), { key: "ArrowRight" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(view.queryByTestId("hover")).toBeNull();
  });
});

describe("Waveform without a Control", () => {
  test("is shown only: nothing to focus, nothing to seek", () => {
    const view = render(
      <Waveform.Root peaks={[0.2, 0.8]} value={0.5}>
        <Waveform.Canvas data-testid="canvas" />
        <Waveform.Playhead data-testid="playhead" />
      </Waveform.Root>
    );
    expect(view.queryByRole("slider")).toBeNull();
    expect(view.getByTestId("canvas").getAttribute("aria-hidden")).toBe("true");
    expect(view.getByTestId("playhead").style.left).toBe(
      "var(--waveform-position)"
    );
  });
});
