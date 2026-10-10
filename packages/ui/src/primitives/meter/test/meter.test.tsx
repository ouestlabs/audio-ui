import { describe, expect, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
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

describe("Meter scale and warning zone", () => {
  test("a mark sits along the length at its level, upward for a vertical meter", () => {
    const view = render(
      <Meter.Root aria-label="Out" max={0} min={-60} value={[-30]}>
        <Meter.Channels>
          {(index) => (
            <Meter.Channel aria-label="Out" index={index} key={index}>
              <Meter.Indicator />
            </Meter.Channel>
          )}
        </Meter.Channels>
        <Meter.Mark data-testid="mark" value={-15}>
          -15
        </Meter.Mark>
      </Meter.Root>
    );
    expect(view.getByTestId("mark").style.bottom).toBe("75%");
    expect(view.getByTestId("mark").getAttribute("data-orientation")).toBe(
      "vertical"
    );
  });

  test("a horizontal meter's marks run from the start", () => {
    const view = render(
      <Meter.Root
        aria-label="Out"
        max={0}
        min={-60}
        orientation="horizontal"
        value={[-30]}
      >
        <Meter.Mark data-testid="mark" value={-45}>
          -45
        </Meter.Mark>
      </Meter.Root>
    );
    expect(view.getByTestId("mark").style.insetInlineStart).toBe("25%");
  });

  test("a level in the warning zone carries data-warning, until it clips", () => {
    const source = createSource({ levels: [-60] });
    const { channels } = renderMeter({ max: 0, source, warnThreshold: -12 });
    act(() => source.emit({ levels: [-20] }));
    expect(channels()[0]?.hasAttribute("data-warning")).toBe(false);
    act(() => source.emit({ levels: [-6] }));
    expect(channels()[0]?.hasAttribute("data-warning")).toBe(true);
    expect(channels()[0]?.hasAttribute("data-clipping")).toBe(false);
    act(() => source.emit({ levels: [0] }));
    expect(channels()[0]?.hasAttribute("data-warning")).toBe(false);
    expect(channels()[0]?.hasAttribute("data-clipping")).toBe(true);
  });

  test("with no warning level there is no warning zone", () => {
    const { channels } = renderMeter({ max: 0, value: [-3] });
    expect(channels()[0]?.hasAttribute("data-warning")).toBe(false);
  });
});

const cubed = (level: number) => level ** 3;

describe("Meter level scale", () => {
  test("the IEC scale gives the top of the range more room than the bottom", () => {
    const view = render(
      <Meter.Root aria-label="Out" max={0} min={-60} scale="iec" value={[-20]}>
        <Meter.Channels>
          {(index) => (
            <Meter.Channel aria-label="Out" index={index} key={index}>
              <Meter.Indicator data-testid="indicator" />
            </Meter.Channel>
          )}
        </Meter.Channels>
        <Meter.Mark data-testid="mark-20" value={-20} />
        <Meter.Mark data-testid="mark-60" value={-60} />
        <Meter.Mark data-testid="mark-0" value={0} />
        <Meter.Mark data-testid="mark-40" value={-40} />
      </Meter.Root>
    );
    // 0 dB is the top, -60 the bottom, and -20 sits about halfway, not a third of the way up.
    expect(view.getByTestId("mark-0").style.bottom).toBe("100%");
    expect(view.getByTestId("mark-60").style.bottom).toBe("0%");
    const half = Number.parseFloat(view.getByTestId("mark-20").style.bottom);
    expect(half).toBeGreaterThan(45);
    expect(half).toBeLessThan(55);
    const lower = Number.parseFloat(view.getByTestId("mark-40").style.bottom);
    expect(lower).toBeLessThan(20);
    // The indicator uses the same curve as the marks.
    expect(view.getByTestId("indicator").style.transform).toContain(
      "scaleY(0.487"
    );
  });

  test("a custom curve and the linear default", () => {
    const linear = render(
      <Meter.Root aria-label="Out" max={0} min={-60} value={[-30]}>
        <Meter.Mark data-testid="mark" value={-30} />
      </Meter.Root>
    );
    expect(linear.getByTestId("mark").style.bottom).toBe("50%");
    linear.unmount();
    const squared = render(
      <Meter.Root
        aria-label="Out"
        max={0}
        min={-60}
        scale={cubed}
        value={[-30]}
      >
        <Meter.Mark data-testid="mark" value={-30} />
      </Meter.Root>
    );
    expect(
      Number.parseFloat(squared.getByTestId("mark").style.bottom)
    ).toBeGreaterThan(80);
  });
});

describe("Meter clip latch", () => {
  test("a live clip stays lit as data-clipped until a click on the meter clears it", () => {
    const source = createSource({ levels: [-60, -60] });
    const { channels, group, view } = renderMeter({ max: 0, source });
    act(() => source.emit({ levels: [-6, 0] }));
    expect(channels()[1]?.hasAttribute("data-clipped")).toBe(true);
    expect(view.getByTestId("indicator-1").hasAttribute("data-clipped")).toBe(
      true
    );
    expect(channels()[0]?.hasAttribute("data-clipped")).toBe(false);

    // The level falls back: the clip is still shown.
    act(() => source.emit({ levels: [-30, -30] }));
    expect(channels()[1]?.hasAttribute("data-clipping")).toBe(false);
    expect(channels()[1]?.hasAttribute("data-clipped")).toBe(true);

    fireEvent.click(group);
    expect(channels()[1]?.hasAttribute("data-clipped")).toBe(false);
    expect(view.getByTestId("indicator-1").hasAttribute("data-clipped")).toBe(
      false
    );
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
