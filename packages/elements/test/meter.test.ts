import { describe, expect, test } from "bun:test";
import "../src/meter/index.ts";
import type { MeterElement, MeterSource } from "../src/meter/index.ts";

/** A meter whose channels are made from a template: an indicator, a peak and a value each. -60 to 6 dB by default. */
async function renderMeter(attributes: string, source?: MeterSource) {
  document.body.innerHTML = `
    <audio-ui-meter aria-label="Output" locale="en-US" unit="dB" ${attributes}>
      <audio-ui-meter-channels label="Output {n}">
        <template>
          <audio-ui-meter-indicator></audio-ui-meter-indicator>
          <audio-ui-meter-peak></audio-ui-meter-peak>
          <audio-ui-meter-value></audio-ui-meter-value>
        </template>
      </audio-ui-meter-channels>
    </audio-ui-meter>`;
  const meter = document.querySelector("audio-ui-meter") as MeterElement;
  if (source) {
    meter.source = source;
  }
  // The channels take their template once the markup is in.
  await Promise.resolve();
  const channels = () => [
    ...meter.querySelectorAll<HTMLElement>("audio-ui-meter-channel"),
  ];
  const part = (index: number, name: string) =>
    channels()[index]?.querySelector(`audio-ui-meter-${name}`) as HTMLElement;
  return { channels, meter, part };
}

/** A hand-cranked live signal. */
function createSource(initial: { levels: number[]; peaks?: number[] }) {
  let frame = initial;
  const listeners = new Set<() => void>();
  return {
    emit(next: { levels: number[]; peaks?: number[] }) {
      frame = next;
      for (const listener of listeners) {
        listener();
      }
    },
    getSnapshot: () => frame,
    listeners,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

describe("the meter", () => {
  test("is a named group with one meter per level", async () => {
    const { channels, meter } = await renderMeter('value="-12 -6"');
    expect(meter.getAttribute("role")).toBe("group");
    expect(channels()).toHaveLength(2);
    const [first] = channels();
    expect(first?.getAttribute("role")).toBe("meter");
    expect(first?.getAttribute("aria-valuenow")).toBe("-12");
    expect(first?.getAttribute("aria-valuemin")).toBe("-60");
    expect(first?.getAttribute("aria-valuemax")).toBe("6");
    expect(first?.getAttribute("aria-label")).toBe("Output 1");
  });

  test("says the level as a number with its unit, not as a share of the range", async () => {
    const { channels, part } = await renderMeter('value="-12.345"');
    expect(channels()[0]?.getAttribute("aria-valuetext")).toBe("-12.3 dB");
    expect(part(0, "value").textContent).toBe("-12.3");
  });

  test("scales each indicator from its own level, clamped to the range", async () => {
    const { part } = await renderMeter('value="-60 6 -27 -120 60"');
    expect(part(0, "indicator").style.transform).toBe("scaleY(0)");
    expect(part(1, "indicator").style.transform).toBe("scaleY(1)");
    expect(part(2, "indicator").style.transform).toBe("scaleY(0.5)");
    expect(part(3, "indicator").style.transform).toBe("scaleY(0)");
    expect(part(4, "indicator").style.transform).toBe("scaleY(1)");
  });

  test("a channel and its indicator are clipping at or above the threshold", async () => {
    const { channels, part } = await renderMeter(
      'clip-threshold="0" value="-3 0 3"'
    );
    expect(channels().map((c) => c.hasAttribute("data-clipping"))).toEqual([
      false,
      true,
      true,
    ]);
    expect(part(0, "indicator").hasAttribute("data-clipping")).toBe(false);
    expect(part(1, "indicator").hasAttribute("data-clipping")).toBe(true);
  });

  test("places the peak from the peak list, and hides it for a channel without one", async () => {
    const placed = await renderMeter('max="0" peak="0 -60" value="-30 -30"');
    expect(placed.part(0, "peak").style.bottom).toBe("100%");
    expect(placed.part(1, "peak").style.bottom).toBe("0%");
    const partial = await renderMeter('peak="-10" value="-30 -30"');
    expect(partial.part(0, "peak").hidden).toBe(false);
    expect(partial.part(1, "peak").hidden).toBe(true);
  });

  test("horizontal, it scales on the x axis and places the peak from the left", async () => {
    const { meter, part } = await renderMeter(
      'max="0" orientation="horizontal" peak="-15" value="-30"'
    );
    expect(meter.getAttribute("data-orientation")).toBe("horizontal");
    expect(part(0, "indicator").style.transform).toBe("scaleX(0.5)");
    expect(part(0, "peak").style.left).toBe("75%");
  });

  test("a mark sits along the length at its level; the IEC scale gives the top more room", () => {
    document.body.innerHTML = `
      <audio-ui-meter aria-label="Out" max="0" scale="iec" value="-20">
        <audio-ui-meter-mark value="0"></audio-ui-meter-mark>
        <audio-ui-meter-mark value="-20"></audio-ui-meter-mark>
        <audio-ui-meter-mark value="-60"></audio-ui-meter-mark>
      </audio-ui-meter>`;
    const marks = [
      ...document.querySelectorAll<HTMLElement>("audio-ui-meter-mark"),
    ];
    expect(marks[0]?.style.bottom).toBe("100%");
    expect(marks[2]?.style.bottom).toBe("0%");
    const half = Number.parseFloat(marks[1]?.style.bottom ?? "");
    expect(half).toBeGreaterThan(45);
    expect(half).toBeLessThan(55);
    const meter = document.querySelector("audio-ui-meter") as MeterElement;
    meter.scale = (level: number) => level ** 3;
    expect(Number.parseFloat(marks[1]?.style.bottom ?? "")).toBeGreaterThan(80);
  });

  test("the channel count follows the levels", async () => {
    const { channels, meter } = await renderMeter('value="-40 -20 0"');
    expect(channels()).toHaveLength(3);
    meter.value = [-10];
    expect(channels()).toHaveLength(1);
  });
});

describe("a live source", () => {
  test("paints each frame, and a level in the warning zone carries data-warning until it clips", async () => {
    const source = createSource({ levels: [-60] });
    const { channels, part } = await renderMeter(
      'max="0" warn-threshold="-12"',
      source
    );
    source.emit({ levels: [-20] });
    expect(channels()[0]?.hasAttribute("data-warning")).toBe(false);
    expect(
      Number.parseFloat(
        part(0, "indicator").style.transform.slice("scaleY(".length)
      )
    ).toBeCloseTo(2 / 3);
    source.emit({ levels: [-6] });
    expect(channels()[0]?.hasAttribute("data-warning")).toBe(true);
    expect(channels()[0]?.hasAttribute("data-clipping")).toBe(false);
    source.emit({ levels: [0] });
    expect(channels()[0]?.hasAttribute("data-warning")).toBe(false);
    expect(channels()[0]?.hasAttribute("data-clipping")).toBe(true);
  });

  test("a clip stays lit as data-clipped until a click on the meter clears it", async () => {
    const source = createSource({ levels: [-60, -60] });
    const { channels, meter, part } = await renderMeter('max="0"', source);
    source.emit({ levels: [-6, 0] });
    source.emit({ levels: [-6, -30] });
    expect(channels()[1]?.hasAttribute("data-clipped")).toBe(true);
    expect(part(1, "indicator").hasAttribute("data-clipped")).toBe(true);
    meter.click();
    expect(channels()[1]?.hasAttribute("data-clipped")).toBe(false);
  });

  test("lets go of the source when the meter leaves the page", async () => {
    const source = createSource({ levels: [-60] });
    const { meter } = await renderMeter("", source);
    expect(source.listeners.size).toBe(1);
    meter.remove();
    expect(source.listeners.size).toBe(0);
  });

  test("a source given before the meter is in the page, or a meter moved, is listened to once it connects", () => {
    const source = createSource({ levels: [-60] });
    const meter = document.createElement("audio-ui-meter");
    meter.source = source;
    expect(source.listeners.size).toBe(0);
    document.body.append(meter);
    expect(source.listeners.size).toBe(1);
    const other = document.createElement("div");
    document.body.append(other);
    other.append(meter);
    expect(source.listeners.size).toBe(1);
  });

  test("a label part names its channel", () => {
    document.body.innerHTML = `
      <audio-ui-meter value="-6">
        <audio-ui-meter-channel index="0">
          <audio-ui-meter-label>Left</audio-ui-meter-label>
        </audio-ui-meter-channel>
      </audio-ui-meter>`;
    const channel = document.querySelector(
      "audio-ui-meter-channel"
    ) as HTMLElement;
    const label = document.querySelector("audio-ui-meter-label") as HTMLElement;
    expect(channel.getAttribute("aria-labelledby")).toBe(label.id);
  });
});
