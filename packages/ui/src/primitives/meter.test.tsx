import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { Meter } from "./meter";

/** Integer dB domain (-60..6) so percentage assertions stay exact. */
function renderMeter(props: Partial<Meter.RootProps> & { value: number[] }) {
  const view = render(
    <Meter.Root {...props}>
      <Meter.Channels>
        {(_value, index) => (
          <Meter.Channel index={index} key={index}>
            <Meter.Fill data-testid={`fill-${index}`} />
            <Meter.Peak data-testid={`peak-${index}`} />
            <Meter.ValueDisplay data-testid={`display-${index}`} />
          </Meter.Channel>
        )}
      </Meter.Channels>
    </Meter.Root>
  );
  return {
    channels: view.getAllByRole("meter"),
    group: view.getByRole("group"),
    view,
  };
}

describe("Meter value semantics", () => {
  test("renders one channel per value entry with group and meter semantics", () => {
    const { group, channels } = renderMeter({ value: [-12, -6] });
    expect(group.getAttribute("aria-label")).toBe("Meter");
    expect(channels).toHaveLength(2);
    expect(channels[0]?.getAttribute("aria-valuenow")).toBe("-12");
    expect(channels[0]?.getAttribute("aria-valuemin")).toBe("-60");
    expect(channels[0]?.getAttribute("aria-valuemax")).toBe("6");
    expect(channels[0]?.getAttribute("aria-label")).toBe("Channel 1");
  });

  test("channel count follows the value array length", () => {
    const { channels } = renderMeter({ value: [-40, -20, 0] });
    expect(channels).toHaveLength(3);
  });

  test("scales each fill from its own channel value", () => {
    const { view } = renderMeter({ value: [-60, 6, -27] });
    expect(view.getByTestId("fill-0").style.transform).toBe("scaleY(0)");
    expect(view.getByTestId("fill-1").style.transform).toBe("scaleY(1)");
    expect(view.getByTestId("fill-2").style.transform).toBe("scaleY(0.5)");
  });

  test("clamps out-of-range values and marks aria-valuenow with the clamped percentage only visually (value itself is not clamped)", () => {
    const { view } = renderMeter({ value: [-120, 60] });
    expect(view.getByTestId("fill-0").style.transform).toBe("scaleY(0)");
    expect(view.getByTestId("fill-1").style.transform).toBe("scaleY(1)");
  });

  test("marks a channel as clipping at or above the clip threshold", () => {
    const { channels } = renderMeter({ clipThreshold: 0, value: [-3, 0, 3] });
    expect(channels[0]?.getAttribute("data-clip")).toBe("false");
    expect(channels[1]?.getAttribute("data-clip")).toBe("true");
    expect(channels[2]?.getAttribute("data-clip")).toBe("true");
  });

  test("marks the fill itself as clipping, matching the channel", () => {
    const { view } = renderMeter({ clipThreshold: 0, value: [-3, 0] });
    expect(view.getByTestId("fill-0").getAttribute("data-clip")).toBe("false");
    expect(view.getByTestId("fill-1").getAttribute("data-clip")).toBe("true");
  });

  test("respects custom min/max range", () => {
    const { view } = renderMeter({ max: 0, min: -100, value: [-50] });
    expect(view.getByTestId("fill-0").style.transform).toBe("scaleY(0.5)");
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

  test("renders nothing when no peak prop is given", () => {
    const { view } = renderMeter({ value: [-30] });
    expect(view.queryByTestId("peak-0")).toBeNull();
  });

  test("renders nothing for a channel missing from a shorter peak array", () => {
    const { view } = renderMeter({ peak: [-10], value: [-30, -30] });
    expect(view.getByTestId("peak-0")).toBeDefined();
    expect(view.queryByTestId("peak-1")).toBeNull();
  });
});

describe("Meter value display", () => {
  test("formats the channel value to one decimal by default", () => {
    const { view } = renderMeter({ value: [-12.345] });
    expect(view.getByTestId("display-0").textContent).toBe("-12.3");
  });

  test("supports a custom formatter", () => {
    const view = render(
      <Meter.Root value={[-6]}>
        <Meter.Channels>
          {(_value, index) => (
            <Meter.Channel index={index} key={index}>
              <Meter.ValueDisplay
                data-testid="display"
                formatValue={(v) => `${v.toFixed(0)} dB`}
              />
            </Meter.Channel>
          )}
        </Meter.Channels>
      </Meter.Root>
    );
    expect(view.getByTestId("display").textContent).toBe("-6 dB");
  });
});

describe("Meter orientation", () => {
  test("horizontal orientation scales fill on the x axis and positions peak on left", () => {
    const view = render(
      <Meter.Root max={0} min={-60} orientation="horizontal" value={[-30]}>
        <Meter.Channels>
          {(_value, index) => (
            <Meter.Channel index={index} key={index}>
              <Meter.Fill data-testid="fill" />
              <Meter.Peak data-testid="peak" />
            </Meter.Channel>
          )}
        </Meter.Channels>
      </Meter.Root>
    );
    expect(view.getByTestId("fill").style.transform).toBe("scaleX(0.5)");
  });
});
