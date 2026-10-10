import { describe, expect, test } from "bun:test";
import { act, render } from "@testing-library/react";
import { Meter } from "../../../entries/meter";

const decibels = (formatted: string) => `${formatted} dB`;

/** Integer dB domain (-60..6) so percentage assertions stay exact. */
function renderMeter(props: Meter.Root.Props, onChannelRender?: () => void) {
  const view = render(
    <Meter.Root aria-label="Output" locale="en-US" {...props}>
      <Meter.Channels>
        {(index) => {
          onChannelRender?.();
          return (
            <Meter.Channel
              aria-label={`Output ${index + 1}`}
              getAriaValueText={decibels}
              index={index}
              key={index}
            >
              <Meter.Indicator data-testid={`indicator-${index}`} />
              <Meter.Peak data-testid={`peak-${index}`} />
              <Meter.Value data-testid={`value-${index}`} />
            </Meter.Channel>
          );
        }}
      </Meter.Channels>
    </Meter.Root>
  );
  return {
    channels: () => view.getAllByRole("meter"),
    group: view.getByRole("group"),
    view,
  };
}

/** A hand-cranked live signal. */
function createSource(initial: Meter.Root.Frame) {
  let frame = initial;
  const listeners = new Set<() => void>();
  return {
    emit(next: Meter.Root.Frame) {
      frame = next;
      for (const listener of listeners) {
        listener();
      }
    },
    getSnapshot: () => frame,
    listenerCount: () => listeners.size,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

describe("Meter value semantics", () => {
  test("renders a named group with one meter per value entry", () => {
    const { group, channels } = renderMeter({ value: [-12, -6] });
    expect(group.getAttribute("aria-label")).toBe("Output");
    expect(channels()).toHaveLength(2);
    const [first] = channels();
    expect(first?.getAttribute("aria-valuenow")).toBe("-12");
    expect(first?.getAttribute("aria-valuemin")).toBe("-60");
    expect(first?.getAttribute("aria-valuemax")).toBe("6");
    expect(first?.getAttribute("aria-label")).toBe("Output 1");
  });

  test("announces the level as a number with its unit, not as a share of the range", () => {
    const { channels } = renderMeter({ value: [-12.345] });
    expect(channels()[0]?.getAttribute("aria-valuetext")).toBe("-12.3 dB");
  });

  test("channel count follows the value array length", () => {
    expect(renderMeter({ value: [-40, -20, 0] }).channels()).toHaveLength(3);
  });

  test("scales each indicator from its own channel level", () => {
    const { view } = renderMeter({ value: [-60, 6, -27] });
    expect(view.getByTestId("indicator-0").style.transform).toBe("scaleY(0)");
    expect(view.getByTestId("indicator-1").style.transform).toBe("scaleY(1)");
    expect(view.getByTestId("indicator-2").style.transform).toBe("scaleY(0.5)");
  });

  test("clamps the indicator for out-of-range levels", () => {
    const { view } = renderMeter({ value: [-120, 60] });
    expect(view.getByTestId("indicator-0").style.transform).toBe("scaleY(0)");
    expect(view.getByTestId("indicator-1").style.transform).toBe("scaleY(1)");
  });

  test("marks a channel and its indicator as clipping at or above the threshold", () => {
    const { channels, view } = renderMeter({
      clipThreshold: 0,
      value: [-3, 0, 3],
    });
    expect(channels().map((c) => c.hasAttribute("data-clipping"))).toEqual([
      false,
      true,
      true,
    ]);
    expect(view.getByTestId("indicator-0").hasAttribute("data-clipping")).toBe(
      false
    );
    expect(view.getByTestId("indicator-1").hasAttribute("data-clipping")).toBe(
      true
    );
  });

  test("respects a custom min/max range", () => {
    const { view } = renderMeter({ max: 0, min: -100, value: [-50] });
    expect(view.getByTestId("indicator-0").style.transform).toBe("scaleY(0.5)");
  });

  test("Value prints the formatted level", () => {
    const { view } = renderMeter({ value: [-12.345] });
    expect(view.getByTestId("value-0").textContent).toBe("-12.3");
  });
});

describe("Meter peak", () => {
  test("positions the peak mark from the peak array", () => {
    const { view } = renderMeter({
      max: 0,
      min: -60,
      peak: [0, -60],
      value: [-30, -30],
    });
    expect(view.getByTestId("peak-0").style.bottom).toBe("100%");
    expect(view.getByTestId("peak-1").style.bottom).toBe("0%");
  });

  test("hides the mark for a channel without a peak", () => {
    const { view } = renderMeter({ peak: [-10], value: [-30, -30] });
    expect(view.getByTestId("peak-0").hidden).toBe(false);
    expect(view.getByTestId("peak-1").hidden).toBe(true);
  });
});

describe("Meter orientation", () => {
  test("horizontal scales the indicator on the x axis and positions the peak from the left", () => {
    const { group, view } = renderMeter({
      max: 0,
      min: -60,
      orientation: "horizontal",
      peak: [-15],
      value: [-30],
    });
    expect(group.getAttribute("data-orientation")).toBe("horizontal");
    expect(view.getByTestId("indicator-0").style.transform).toBe("scaleX(0.5)");
    expect(view.getByTestId("peak-0").style.left).toBe("75%");
  });
});

describe("Meter live source", () => {
  test("paints each frame straight to the DOM without re-rendering React", () => {
    const source = createSource({ levels: [-60, -60] });
    let renders = 0;
    const { channels, view } = renderMeter({ max: 0, source }, () => {
      renders += 1;
    });
    const rendersAfterMount = renders;

    act(() => source.emit({ levels: [-30, 0], peaks: [-15, 0] }));

    expect(renders).toBe(rendersAfterMount);
    expect(view.getByTestId("indicator-0").style.transform).toBe("scaleY(0.5)");
    expect(view.getByTestId("indicator-1").style.transform).toBe("scaleY(1)");
    expect(view.getByTestId("peak-0").style.bottom).toBe("75%");
    expect(view.getByTestId("peak-0").hidden).toBe(false);
    expect(view.getByTestId("value-0").textContent).toBe("-30");
    const [left, right] = channels();
    expect(left?.getAttribute("aria-valuenow")).toBe("-30");
    expect(left?.getAttribute("aria-valuetext")).toBe("-30 dB");
    expect(left?.hasAttribute("data-clipping")).toBe(false);
    expect(right?.hasAttribute("data-clipping")).toBe(true);
  });

  test("re-renders only when the channel count changes", () => {
    const source = createSource({ levels: [-60] });
    const { channels } = renderMeter({ source });
    expect(channels()).toHaveLength(1);
    act(() => source.emit({ levels: [-20, -20] }));
    expect(channels()).toHaveLength(2);
  });

  test("unsubscribes on unmount", () => {
    const source = createSource({ levels: [-60] });
    const { view } = renderMeter({ source });
    expect(source.listenerCount()).toBe(1);
    view.unmount();
    expect(source.listenerCount()).toBe(0);
  });
});
