import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../test/helpers";
import { Transport } from "./transport";

/** Defaults: min 0, max 100, step 1 → midpoint default value 50, horizontal. */
function renderTransport(props: Transport.RootProps = {}) {
  const onValueChange = mock(() => undefined);
  const onValueCommit = mock(() => undefined);
  const view = render(
    <Transport.Root
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      {...props}
    >
      <Transport.Slider data-testid="slider">
        <Transport.Track data-testid="track">
          <Transport.BufferedRange data-testid="buffered" />
          <Transport.Range />
          <Transport.Thumb data-testid="thumb" />
        </Transport.Track>
      </Transport.Slider>
    </Transport.Root>
  );
  return {
    buffered: view.getByTestId("buffered"),
    onValueChange,
    onValueCommit,
    slider: view.getByTestId("slider"),
    thumb: view.getByTestId("thumb"),
    track: view.getByTestId("track"),
    view,
  };
}

describe("Transport value semantics", () => {
  test("defaults to the midpoint of min/max", () => {
    const { thumb } = renderTransport();
    expect(thumb.getAttribute("aria-valuemin")).toBe("0");
    expect(thumb.getAttribute("aria-valuemax")).toBe("100");
    expect(thumb.getAttribute("aria-valuenow")).toBe("50");
  });

  test("clamps an out-of-range controlled value", () => {
    const { thumb } = renderTransport({ value: 250 });
    expect(thumb.getAttribute("aria-valuenow")).toBe("100");
  });

  test("renders the buffered range as a scale transform", () => {
    const { buffered } = renderTransport({ bufferedValue: 40 });
    expect(buffered.style.transform).toBe("scaleX(0.4)");
  });
});

describe("Transport keyboard", () => {
  const cases: [string, number][] = [
    ["ArrowRight", 51],
    ["ArrowLeft", 49],
    ["Home", 0],
    ["End", 100],
    ["PageUp", 60],
    ["PageDown", 40],
  ];

  for (const [key, expected] of cases) {
    test(`${key} commits ${expected} from the default 50`, () => {
      const { thumb, onValueCommit } = renderTransport();
      fireEvent.keyDown(thumb, { key });
      expect(onValueCommit).toHaveBeenLastCalledWith(expected);
    });
  }
});

describe("Transport wheel", () => {
  test("wheel up commits +step", () => {
    const { slider, onValueCommit } = renderTransport();
    fireEvent.wheel(slider, { deltaY: -100 });
    expect(onValueCommit).toHaveBeenLastCalledWith(51);
  });
});

describe("Transport pointer capture", () => {
  test("captures on the element whose handlers drive the drag, not its parent", () => {
    // Capturing on the Slider retargets pointermove/pointerup away from the
    // Track's React handlers, so the drag never ends and freeze sticks.
    const { slider, track } = renderTransport();
    mockRect(slider, { height: 20, width: 200 });

    fireEvent.pointerDown(track, { clientX: 60, clientY: 10, pointerId: 9 });
    expect(track.hasPointerCapture(9)).toBe(true);
    expect(slider.hasPointerCapture(9)).toBe(false);

    fireEvent.pointerUp(track, { clientX: 60, clientY: 10, pointerId: 9 });
  });
});

describe("Transport drag (horizontal slider 200×20 at origin)", () => {
  test("pointer down jumps to the pointed value and release commits", () => {
    const { slider, track, onValueChange, onValueCommit } = renderTransport();
    mockRect(slider, { height: 20, width: 200 });

    fireEvent.pointerDown(track, { clientX: 60, clientY: 10, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith(30);

    fireEvent.pointerMove(track, { clientX: 100, clientY: 10, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith(50);

    fireEvent.pointerUp(track, { clientX: 100, clientY: 10, pointerId: 1 });
    expect(onValueCommit).toHaveBeenLastCalledWith(50);
  });

  test("freezeValuesWhileDragging keeps the thumb at the dragged position while controlled value lags", () => {
    const { slider, track, thumb, onValueChange, onValueCommit } =
      renderTransport({
        freezeValuesWhileDragging: true,
        value: 10,
      });
    mockRect(slider, { height: 20, width: 200 });

    fireEvent.pointerDown(track, { clientX: 60, clientY: 10, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith(30);
    // displayed position follows the drag (optimistic), aria stays on the raw controlled value
    expect(thumb.style.left).toBe("30%");
    expect(thumb.getAttribute("aria-valuenow")).toBe("10");

    fireEvent.pointerUp(track, { clientX: 60, clientY: 10, pointerId: 1 });
    expect(onValueCommit).toHaveBeenLastCalledWith(30);
    // optimistic value clears after the drag; controlled value still rules
    expect(thumb.style.left).toBe("10%");
  });

  test("without freeze, the thumb tracks the controlled value even mid-drag", () => {
    const { slider, track, thumb } = renderTransport({ value: 10 });
    mockRect(slider, { height: 20, width: 200 });

    fireEvent.pointerDown(track, { clientX: 60, clientY: 10, pointerId: 1 });
    expect(thumb.style.left).toBe("10%");
  });
});
