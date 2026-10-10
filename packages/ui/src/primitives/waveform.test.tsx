import { describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../test/helpers";
import { Waveform } from "../waveform";

const PEAKS = [0.2, 0.8, 0.5, 1];

const clock = (value: number, duration: number) =>
  `${Math.round(value)} of ${Math.round(duration)} seconds`;
const seconds = (value: number) => `${value}s`;

/** A 100-second track on a 200×40 control at the origin: 2px per second. */
function renderWaveform(
  props: Waveform.Root.Props = {},
  onRender?: () => void
) {
  const onValueChange = mock(
    (_value: number, _details: Waveform.Root.ChangeEventDetails) => undefined
  );
  const onValueCommitted = mock(
    (_value: number, _details: Waveform.Root.CommitEventDetails) => undefined
  );
  function Parts() {
    onRender?.();
    return (
      <Waveform.Control aria-label="Seek" data-testid="control">
        <Waveform.Canvas data-testid="canvas" />
        <Waveform.Playhead data-testid="playhead" />
        <Waveform.Thumb data-testid="thumb" />
        <Waveform.Hover data-testid="hover">{seconds}</Waveform.Hover>
      </Waveform.Control>
    );
  }
  const view = render(
    <Waveform.Root
      data-testid="root"
      duration={100}
      onValueChange={onValueChange}
      onValueCommitted={onValueCommitted}
      peaks={PEAKS}
      {...props}
    >
      <Parts />
    </Waveform.Root>
  );
  const control = view.getByTestId("control");
  mockRect(control, { bottom: 40, height: 40, right: 200, width: 200 });
  return {
    control,
    input: view.getByRole("slider") as HTMLInputElement,
    onValueChange,
    onValueCommitted,
    position: () =>
      view.getByTestId("root").style.getPropertyValue("--waveform-position"),
    view,
  };
}

/** A hand-cranked playback position. */
function createSource(initial: number) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    emit(next: number) {
      value = next;
      for (const listener of listeners) {
        listener();
      }
    },
    getSnapshot: () => value,
    listenerCount: () => listeners.size,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const lastCall = <T extends unknown[]>(fn: { mock: { calls: T[] } }) =>
  fn.mock.calls.at(-1) as T;

describe("Waveform value semantics", () => {
  test("starts at 0, with a named native range input spanning the duration", () => {
    const { input, position } = renderWaveform();
    expect(input.type).toBe("range");
    expect(input.value).toBe("0");
    expect(input.max).toBe("100");
    expect(input.getAttribute("aria-label")).toBe("Seek");
    expect(position()).toBe("0%");
  });

  test("exposes the position as a percentage CSS variable the playhead and thumb follow", () => {
    const { position, view } = renderWaveform({ value: 25 });
    expect(position()).toBe("25%");
    expect(view.getByTestId("playhead").style.left).toBe(
      "var(--waveform-position)"
    );
    expect(view.getByTestId("thumb").style.left).toBe(
      "var(--waveform-position)"
    );
  });

  test("clamps an out-of-range position", () => {
    expect(renderWaveform({ value: 400 }).position()).toBe("100%");
  });

  test("treats a NaN position as the start", () => {
    expect(renderWaveform({ value: Number.NaN }).position()).toBe("0%");
  });

  test("announces the played share by default", () => {
    expect(
      renderWaveform({ value: 30 }).input.getAttribute("aria-valuetext")
    ).toBe("30%");
  });

  test("getAriaValueText announces the position in real units", () => {
    const view = render(
      <Waveform.Root duration={100} value={12}>
        <Waveform.Control aria-label="Seek" getAriaValueText={clock} />
      </Waveform.Root>
    );
    expect(view.getByRole("slider").getAttribute("aria-valuetext")).toBe(
      "12 of 100 seconds"
    );
  });
});

describe("Waveform keyboard (from 50 of 100)", () => {
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

describe("Waveform pointer (control 200×40, 100s)", () => {
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

describe("Waveform.Hover", () => {
  test("appears at the hovered position while the pointer is over the control", () => {
    const { control, view } = renderWaveform();
    expect(view.queryByTestId("hover")).toBeNull();

    fireEvent.pointerMove(control, { clientX: 50, clientY: 20, pointerId: 1 });
    const hover = view.getByTestId("hover");
    expect(hover.style.left).toBe("25%");
    expect(hover.textContent).toBe("25s");

    fireEvent.pointerLeave(control);
    expect(view.queryByTestId("hover")).toBeNull();
  });
});

describe("Waveform live source", () => {
  test("follows the source in the DOM without re-rendering React", () => {
    const source = createSource(0);
    let renders = 0;
    const { input, position } = renderWaveform({ source }, () => {
      renders += 1;
    });
    const rendersAfterMount = renders;

    act(() => source.emit(42));

    expect(renders).toBe(rendersAfterMount);
    expect(position()).toBe("42%");
    expect(input.value).toBe("42");
    expect(input.getAttribute("aria-valuetext")).toBe("42%");
  });

  test("a scrub wins over the source until the pointer is released", () => {
    const source = createSource(10);
    const { control, position } = renderWaveform({ source });

    fireEvent.pointerDown(control, { clientX: 100, clientY: 20, pointerId: 1 });
    act(() => source.emit(11));
    expect(position()).toBe("50%");

    fireEvent.pointerUp(control, { clientX: 100, clientY: 20, pointerId: 1 });
    expect(position()).toBe("11%");
  });

  test("unsubscribes on unmount", () => {
    const source = createSource(0);
    const { view } = renderWaveform({ source });
    expect(source.listenerCount()).toBe(1);
    view.unmount();
    expect(source.listenerCount()).toBe(0);
  });
});
