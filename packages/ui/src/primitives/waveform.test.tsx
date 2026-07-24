import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../test/helpers";
import { Waveform } from "./waveform";

const SAMPLE_BARS = [{ height: 10, width: 5, x: 0, y: 45 }];

/** Defaults: min 0, max 1, step 0.001 → midpoint default value 0.5. */
function renderWaveform(props: Waveform.RootProps = {}) {
  const onValueChange = mock(() => undefined);
  const onValueCommit = mock(() => undefined);
  const view = render(
    <Waveform.Root
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      {...props}
    >
      <Waveform.Track data-testid="track">
        <Waveform.Svg viewBox="0 0 100 100">
          <Waveform.Bars bars={SAMPLE_BARS} />
        </Waveform.Svg>
        <Waveform.Thumb data-testid="thumb" />
      </Waveform.Track>
    </Waveform.Root>
  );
  return {
    onValueChange,
    onValueCommit,
    thumb: view.getByTestId("thumb"),
    track: view.getByTestId("track"),
    view,
  };
}

describe("Waveform value semantics", () => {
  test("defaults to the midpoint of min/max", () => {
    const { thumb } = renderWaveform();
    expect(thumb.getAttribute("role")).toBe("slider");
    expect(thumb.getAttribute("aria-valuemin")).toBe("0");
    expect(thumb.getAttribute("aria-valuemax")).toBe("1");
    expect(thumb.getAttribute("aria-valuenow")).toBe("0.5");
  });

  test("clamps an out-of-range controlled value", () => {
    const { thumb } = renderWaveform({ value: 5 });
    expect(thumb.getAttribute("aria-valuenow")).toBe("1");
  });

  test("falls back to min for a NaN controlled value", () => {
    const { thumb } = renderWaveform({ value: Number.NaN });
    expect(thumb.getAttribute("aria-valuenow")).toBe("0");
  });

  test("respects defaultValue when uncontrolled", () => {
    const { thumb } = renderWaveform({ defaultValue: 0.2 });
    expect(thumb.getAttribute("aria-valuenow")).toBe("0.2");
  });

  test("respects a consumer-supplied max, e.g. a track duration in seconds", () => {
    const { thumb } = renderWaveform({ max: 180, min: 0, step: 1 });
    expect(thumb.getAttribute("aria-valuenow")).toBe("90");
  });
});

describe("Waveform keyboard (step 0.25)", () => {
  const cases: [string, number][] = [
    ["ArrowRight", 0.75],
    ["ArrowUp", 0.75],
    ["ArrowLeft", 0.25],
    ["ArrowDown", 0.25],
    ["Home", 0],
    ["End", 1],
  ];

  for (const [key, expected] of cases) {
    test(`${key} commits ${expected} from the default 0.5`, () => {
      const { thumb, onValueChange, onValueCommit } = renderWaveform({
        step: 0.25,
      });
      fireEvent.keyDown(thumb, { key });
      expect(onValueChange).toHaveBeenLastCalledWith(expected);
      expect(onValueCommit).toHaveBeenLastCalledWith(expected);
    });
  }

  test("clamps keyboard steps at max", () => {
    const { thumb, onValueCommit } = renderWaveform({ step: 0.25, value: 1 });
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(onValueCommit).toHaveBeenLastCalledWith(1);
  });

  test("ignores keys when disabled", () => {
    const { thumb, onValueChange, onValueCommit } = renderWaveform({
      disabled: true,
    });
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommit).not.toHaveBeenCalled();
    expect(thumb.tabIndex).toBe(-1);
  });
});

describe("Waveform pointer drag (track 200×40 at origin)", () => {
  test("pointer down jumps to the pointed value, drag updates, release commits", () => {
    const { track, onValueChange, onValueCommit } = renderWaveform();
    mockRect(track, { height: 40, width: 200 });

    fireEvent.pointerDown(track, { clientX: 100, clientY: 20, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith(0.5);

    fireEvent.pointerMove(track, { clientX: 150, clientY: 20, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith(0.75);

    fireEvent.pointerUp(track, { clientX: 150, clientY: 20, pointerId: 1 });
    expect(onValueCommit).toHaveBeenLastCalledWith(0.75);
  });

  test("dragging from the thumb itself works the same as dragging from the track", () => {
    const { thumb, track, onValueChange, onValueCommit } = renderWaveform({
      value: 0.5,
    });
    mockRect(track, { height: 40, width: 200 });

    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 20, pointerId: 2 });
    fireEvent.pointerMove(thumb, { clientX: 50, clientY: 20, pointerId: 2 });
    expect(onValueChange).toHaveBeenLastCalledWith(0.25);

    fireEvent.pointerUp(thumb, { clientX: 50, clientY: 20, pointerId: 2 });
    expect(onValueCommit).toHaveBeenLastCalledWith(0.25);
  });

  test("a pointerdown outside the waveform mid-drag commits the pending value", () => {
    const { thumb, track, onValueCommit } = renderWaveform();
    mockRect(track, { height: 40, width: 200 });

    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 20, pointerId: 7 });
    expect(onValueCommit).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body, { pointerId: 8 });
    expect(onValueCommit).toHaveBeenLastCalledWith(0.5);
  });

  test("ignores pointer input when disabled", () => {
    const { track, onValueChange, onValueCommit } = renderWaveform({
      disabled: true,
    });
    mockRect(track, { height: 40, width: 200 });

    fireEvent.pointerDown(track, { clientX: 100, clientY: 20, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommit).not.toHaveBeenCalled();
  });
});
