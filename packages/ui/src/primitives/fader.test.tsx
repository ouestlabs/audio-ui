import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { Fader } from "./fader";
import { mockRect } from "../../test/helpers";

/** Defaults: min -60, max 6, step 1 → midpoint default value -27. */
function renderFader(props: Fader.RootProps = {}) {
  const onValueChange = mock(() => {});
  const onValueCommit = mock(() => {});
  const view = render(
    <Fader.Root
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      {...props}
    >
      <Fader.Slider data-testid="slider">
        <Fader.Track data-testid="track">
          <Fader.Range />
          <Fader.Thumb data-testid="thumb" />
        </Fader.Track>
      </Fader.Slider>
    </Fader.Root>
  );
  return {
    onValueChange,
    onValueCommit,
    slider: view.getByTestId("slider"),
    thumb: view.getByTestId("thumb"),
    track: view.getByTestId("track"),
    view,
  };
}

describe("Fader value semantics", () => {
  test("defaults to the midpoint of min/max", () => {
    const { thumb } = renderFader();
    expect(thumb.getAttribute("role")).toBe("slider");
    expect(thumb.getAttribute("aria-valuemin")).toBe("-60");
    expect(thumb.getAttribute("aria-valuemax")).toBe("6");
    expect(thumb.getAttribute("aria-valuenow")).toBe("-27");
  });

  test("clamps an out-of-range controlled value", () => {
    const { thumb } = renderFader({ value: 100 });
    expect(thumb.getAttribute("aria-valuenow")).toBe("6");
  });

  test("falls back to min for a NaN controlled value", () => {
    const { thumb } = renderFader({ value: Number.NaN });
    expect(thumb.getAttribute("aria-valuenow")).toBe("-60");
  });

  test("uses the first entry of an array value", () => {
    const { thumb } = renderFader({ value: [3] });
    expect(thumb.getAttribute("aria-valuenow")).toBe("3");
  });

  test("respects defaultValue when uncontrolled", () => {
    const { thumb } = renderFader({ defaultValue: -10 });
    expect(thumb.getAttribute("aria-valuenow")).toBe("-10");
  });
});

describe("Fader keyboard", () => {
  const cases: [string, number][] = [
    ["ArrowUp", -26],
    ["ArrowRight", -26],
    ["ArrowDown", -28],
    ["ArrowLeft", -28],
    ["Home", -60],
    ["End", 6],
    ["PageUp", -17],
    ["PageDown", -37],
  ];

  for (const [key, expected] of cases) {
    test(`${key} commits ${expected} from the default -27`, () => {
      const { thumb, onValueChange, onValueCommit } = renderFader();
      fireEvent.keyDown(thumb, { key });
      expect(onValueChange).toHaveBeenLastCalledWith(expected);
      expect(onValueCommit).toHaveBeenLastCalledWith(expected);
      expect(thumb.getAttribute("aria-valuenow")).toBe(String(expected));
    });
  }

  test("clamps keyboard steps at max", () => {
    const { thumb, onValueCommit } = renderFader({ value: 6 });
    fireEvent.keyDown(thumb, { key: "ArrowUp" });
    expect(onValueCommit).toHaveBeenLastCalledWith(6);
  });

  test("ignores keys when disabled", () => {
    const { thumb, onValueChange, onValueCommit } = renderFader({
      disabled: true,
    });
    fireEvent.keyDown(thumb, { key: "ArrowUp" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommit).not.toHaveBeenCalled();
    expect(thumb.tabIndex).toBe(-1);
  });
});

describe("Fader wheel", () => {
  test("wheel up commits +step", () => {
    const { slider, onValueCommit } = renderFader();
    fireEvent.wheel(slider, { deltaY: -100 });
    expect(onValueCommit).toHaveBeenLastCalledWith(-26);
  });

  test("wheel down commits -step", () => {
    const { slider, onValueCommit } = renderFader();
    fireEvent.wheel(slider, { deltaY: 100 });
    expect(onValueCommit).toHaveBeenLastCalledWith(-28);
  });

  test("ignores sub-threshold wheel deltas", () => {
    const { slider, onValueCommit } = renderFader();
    fireEvent.wheel(slider, { deltaY: 0.05 });
    expect(onValueCommit).not.toHaveBeenCalled();
  });
});

describe("Fader drag (vertical slider 20×200 at origin)", () => {
  test("pointer down jumps to the pointed value, drag updates, release commits", () => {
    const { slider, track, onValueChange, onValueCommit } = renderFader();
    mockRect(slider, { height: 200, width: 20 });

    fireEvent.pointerDown(track, { clientX: 10, clientY: 0, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith(6);

    fireEvent.pointerMove(track, { clientX: 10, clientY: 100, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith(-27);

    fireEvent.pointerUp(track, { clientX: 10, clientY: 100, pointerId: 1 });
    expect(onValueCommit).toHaveBeenLastCalledWith(-27);
  });

  test("a pointerdown outside the fader mid-drag commits the pending value", () => {
    const { slider, thumb, onValueCommit } = renderFader();
    mockRect(slider, { height: 200, width: 20 });

    fireEvent.pointerDown(thumb, { clientX: 10, clientY: 100, pointerId: 7 });
    expect(onValueCommit).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body, { pointerId: 8 });
    expect(onValueCommit).toHaveBeenLastCalledWith(-27);
  });
});
