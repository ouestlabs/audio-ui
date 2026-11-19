import { describe, expect, test } from "bun:test";
import type { MeterFrame } from "@/registry/primitives/meter/levels";
import { createSource } from "@/registry/primitives/primitive";

/**
 * One suite for the meter in every framework: it writes no markup of its own,
 * only drives the DOM a framework renders from the same `meter.ts`, and finds
 * each part by its `data-slot`.
 */

export interface MeterOptions {
  [option: string]: unknown;
}

/** What the suite asks a framework to render. */
export interface MeterTree {
  /** How many channels to write, for a framework that does not follow the state's count. */
  count: number;
  /** Whether each channel has a label part, and its text. */
  labels?: boolean;
  marks?: number[];
  options: MeterOptions;
}

/** A meter a framework rendered. */
export interface Mounted {
  act: (interact: () => void) => Promise<void>;
  container: HTMLElement;
  unmount: () => void;
}

export type MountMeter = (tree: MeterTree) => Promise<Mounted>;

/** What `getAriaValueText` gives each channel, as every mount passes it. */
export const decibels = (formatted: string) => `${formatted} dB`;

async function render(
  mount: MountMeter,
  options: MeterOptions = {},
  extra: Pick<MeterTree, "labels" | "marks"> = {}
) {
  const levels = (options.value as number[] | undefined)?.length;
  const source = options.source as
    | { getSnapshot: () => MeterFrame }
    | undefined;
  const mounted = await mount({
    count: levels ?? source?.getSnapshot().levels.length ?? 0,
    options,
    ...extra,
  });
  const all = (slot: string) => [
    ...mounted.container.querySelectorAll<HTMLElement>(
      `[data-slot="meter-${slot}"]`
    ),
  ];
  return {
    ...mounted,
    channels: all("channel"),
    indicators: all("indicator"),
    labels: all("label"),
    marks: all("mark"),
    peaks: all("peak"),
    root: mounted.container.querySelector('[data-slot="meter"]') as HTMLElement,
    values: all("value"),
  };
}

const styleOf = (element: HTMLElement) => element.getAttribute("style") ?? "";
const transformOf = (element: HTMLElement | undefined) =>
  element?.style.transform ?? "";

export function meterSuite(
  framework: string,
  mount: MountMeter,
  { dynamicCount = true }: { dynamicCount?: boolean } = {}
) {
  describe(`the meter in ${framework}`, () => {
    test("a group with one meter per level", async () => {
      const m = await render(mount, { value: [-6, -12] });
      expect(m.root.getAttribute("role")).toBe("group");
      expect(m.channels).toHaveLength(2);
      expect(m.channels.map((c) => c.getAttribute("role"))).toEqual([
        "meter",
        "meter",
      ]);
      m.unmount();
    });

    test("announces the level as a number with its unit, not as a share of the range", async () => {
      const m = await render(mount, { locale: "en-US", value: [-6] });
      const [channel] = m.channels;
      expect(channel?.getAttribute("aria-valuenow")).toBe("-6");
      expect(channel?.getAttribute("aria-valuemin")).toBe("-60");
      expect(channel?.getAttribute("aria-valuemax")).toBe("6");
      expect(channel?.getAttribute("aria-valuetext")).toBe("-6 dB");
      m.unmount();
    });

    test("scales each indicator from its own level, and clamps out-of-range ones", async () => {
      const m = await render(mount, {
        max: 0,
        min: -60,
        value: [-30, -100, 40],
      });
      expect(m.indicators.map((i) => transformOf(i))).toEqual([
        "scaleY(0.5)",
        "scaleY(0)",
        "scaleY(1)",
      ]);
      expect(m.channels[1]?.getAttribute("aria-valuenow")).toBe("-60");
      m.unmount();
    });

    test("respects a custom range", async () => {
      const m = await render(mount, { max: 100, min: 0, value: [25] });
      expect(transformOf(m.indicators[0])).toBe("scaleY(0.25)");
      m.unmount();
    });

    test("a level at or above the threshold is clipping, one in the warning zone warns", async () => {
      const m = await render(mount, {
        clipThreshold: 0,
        value: [-12, -4, 0, 3],
        warnThreshold: -6,
      });
      const flags = (parts: HTMLElement[]) =>
        parts.map((part) => [
          part.hasAttribute("data-warning"),
          part.hasAttribute("data-clipping"),
        ]);
      const expected = [
        [false, false],
        [true, false],
        [false, true],
        [false, true],
      ];
      expect(flags(m.channels)).toEqual(expected);
      expect(flags(m.indicators)).toEqual(expected);
      m.unmount();
    });

    test("with no warning level there is no warning zone", async () => {
      const m = await render(mount, { value: [-1] });
      expect(m.channels[0]?.hasAttribute("data-warning")).toBe(false);
      m.unmount();
    });

    test("the value part prints the formatted level", async () => {
      const m = await render(mount, { locale: "en-US", value: [-6.26] });
      expect(m.values[0]?.textContent?.trim()).toBe("-6.3");
      m.unmount();
    });

    test("the peak mark sits at its level, and is hidden for a channel without one", async () => {
      const m = await render(mount, {
        max: 0,
        min: -60,
        peak: [-30],
        value: [-40, -50],
      });
      expect(styleOf(m.peaks[0] as HTMLElement)).toContain("bottom: 50%");
      expect(m.peaks[0]?.hasAttribute("hidden")).toBe(false);
      expect(m.peaks[1]?.hasAttribute("hidden")).toBe(true);
      m.unmount();
    });

    test("a horizontal meter scales on x and places the peak from the left", async () => {
      const m = await render(mount, {
        max: 0,
        min: -60,
        orientation: "horizontal",
        peak: [-30],
        value: [-30],
      });
      expect(transformOf(m.indicators[0])).toBe("scaleX(0.5)");
      expect(styleOf(m.peaks[0] as HTMLElement)).toContain("left: 50%");
      expect(m.root.getAttribute("data-orientation")).toBe("horizontal");
      m.unmount();
    });

    test("a mark sits along the length at its level", async () => {
      const m = await render(
        mount,
        { max: 0, min: -60, value: [-6] },
        { marks: [-30, -6] }
      );
      expect(m.marks.map((mark) => styleOf(mark))).toEqual([
        expect.stringContaining("bottom: 50%"),
        expect.stringContaining("bottom: 90%"),
      ]);
      m.unmount();
      const horizontal = await render(
        mount,
        { max: 0, min: -60, orientation: "horizontal", value: [-6] },
        { marks: [-30] }
      );
      expect(styleOf(horizontal.marks[0] as HTMLElement)).toContain(
        "inset-inline-start: 50%"
      );
      horizontal.unmount();
    });

    test("the IEC scale gives the top of the range more room than the bottom", async () => {
      const iec = await render(mount, {
        max: 0,
        min: -60,
        scale: "iec",
        value: [-30],
      });
      const linear = await render(mount, { max: 0, min: -60, value: [-30] });
      const percent = (part: HTMLElement | undefined) =>
        Number(transformOf(part).replace("scaleY(", "").replace(")", ""));
      expect(percent(iec.indicators[0])).toBeLessThan(
        percent(linear.indicators[0])
      );
      iec.unmount();
      linear.unmount();
    });

    test("a label names its channel through aria-labelledby", async () => {
      const m = await render(mount, { value: [-6] }, { labels: true });
      expect(m.labels[0]?.id).not.toBe("");
      expect(m.channels[0]?.getAttribute("aria-labelledby")).toBe(
        m.labels[0]?.id
      );
      m.unmount();
    });

    test("each channel is named by its own label", async () => {
      const m = await render(mount, { value: [-6, -12] }, { labels: true });
      const ids = m.labels.map((label) => label.id);
      expect(new Set(ids).size).toBe(2);
      expect(
        m.channels.map((channel) => channel.getAttribute("aria-labelledby"))
      ).toEqual(ids);
      m.unmount();
    });

    test("a live source is painted to the DOM, frame by frame", async () => {
      const source = createSource<MeterFrame>({ levels: [-30], peaks: [-30] });
      const m = await render(mount, { max: 0, min: -60, source });
      expect(transformOf(m.indicators[0])).toBe("scaleY(0.5)");
      await m.act(() => source.set({ levels: [-15], peaks: [-6] }));
      expect(transformOf(m.indicators[0])).toBe("scaleY(0.75)");
      expect(styleOf(m.peaks[0] as HTMLElement)).toContain("bottom: 90%");
      expect(m.channels[0]?.getAttribute("aria-valuenow")).toBe("-15");
      expect(m.values[0]?.textContent?.trim()).toBe("-15");
      m.unmount();
    });

    test("a live clip stays lit as data-clipped until a click on the meter clears it", async () => {
      const source = createSource<MeterFrame>({ levels: [-12] });
      const m = await render(mount, {
        clipThreshold: 0,
        max: 6,
        min: -60,
        source,
      });
      await m.act(() => source.set({ levels: [3] }));
      expect(m.channels[0]?.hasAttribute("data-clipping")).toBe(true);
      expect(m.channels[0]?.hasAttribute("data-clipped")).toBe(true);
      await m.act(() => source.set({ levels: [-12] }));
      expect(m.channels[0]?.hasAttribute("data-clipping")).toBe(false);
      expect(m.channels[0]?.hasAttribute("data-clipped")).toBe(true);
      await m.act(() => m.root.click());
      expect(m.channels[0]?.hasAttribute("data-clipped")).toBe(false);
      m.unmount();
    });

    if (dynamicCount) {
      test("the channels follow a live source that changes its channel count", async () => {
        const source = createSource<MeterFrame>({ levels: [-30] });
        const m = await render(mount, { max: 0, min: -60, source });
        expect(
          m.root.querySelectorAll('[data-slot="meter-channel"]')
        ).toHaveLength(1);
        await m.act(() => source.set({ levels: [-30, -20, -10] }));
        const channels = m.root.querySelectorAll<HTMLElement>(
          '[data-slot="meter-channel"]'
        );
        expect(channels).toHaveLength(3);
        expect(channels[2]?.getAttribute("aria-valuenow")).toBe("-10");
        m.unmount();
      });
    }
  });
}
