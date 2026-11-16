import { describe, expect, test } from "bun:test";
import { createSource } from "@audio-ui/core";
import { key, mockRect, pointer } from "./helpers.ts";

/**
 * One suite for the waveform in every framework: it writes no markup of its
 * own, only drives the DOM a framework renders from the same `waveform.ts`,
 * and finds each part by its `data-slot`.
 */

interface ChangeDetails {
  cancel: () => void;
  reason: string;
  source?: string;
}

interface RegionDetails extends ChangeDetails {
  edge: string;
  region: string;
}

export interface WaveformOptions {
  [option: string]: unknown;
}

/** What the suite asks a framework to render, besides the waveform itself. */
export interface WaveformTree {
  bars?: { count?: number };
  canvas?: boolean;
  control?: { label?: string };
  hover?: { format: (value: number) => string };
  marker?: { value: number };
  options: WaveformOptions & {
    onRegionChange: (value: number[], details: RegionDetails) => void;
    onSelectionChange: (value: number[], details: ChangeDetails) => void;
    onValueChange: (value: number, details: ChangeDetails) => void;
    onValueCommitted: (value: number, details: { reason: string }) => void;
  };
  playhead?: boolean;
  region?: {
    defaultValue?: number[];
    label?: string;
    region: string;
    value?: number[];
  };
  thumb?: boolean;
}

/** A waveform a framework rendered. */
export interface Mounted {
  act: (interact: () => void) => Promise<void>;
  container: HTMLElement;
  unmount: () => void;
}

export type MountWaveform = (tree: WaveformTree) => Promise<Mounted>;

async function render(
  mount: MountWaveform,
  tree: Omit<WaveformTree, "options"> = {},
  options: WaveformOptions = {}
) {
  const changes: [number, string, string | undefined][] = [];
  const commits: [number, string][] = [];
  const regions: [number[], string, string, string][] = [];
  const selections: number[][] = [];
  const mounted = await mount({
    control: {},
    ...tree,
    options: {
      duration: 100,
      ...options,
      onRegionChange: (value, details) => {
        regions.push([
          [...value],
          details.region,
          details.edge,
          details.reason,
        ]);
      },
      onSelectionChange: (value) => {
        selections.push([...value]);
      },
      onValueChange: (value, details) => {
        changes.push([value, details.reason, details.source]);
        (
          options.onValueChange as
            | ((v: number, d: ChangeDetails) => void)
            | undefined
        )?.(value, details);
      },
      onValueCommitted: (value, details) => {
        commits.push([value, details.reason]);
      },
    },
  });
  const one = (slot: string) =>
    mounted.container.querySelector(
      `[data-slot="waveform-${slot}"]`
    ) as HTMLElement;
  const root = mounted.container.querySelector(
    '[data-slot="waveform"]'
  ) as HTMLElement;
  const control = one("control");
  const box = { bottom: 20, height: 20, right: 100, width: 100 };
  mockRect(root, box);
  if (control) {
    mockRect(control, box);
  }
  return {
    ...mounted,
    bars: one("bars"),
    canvas: one("canvas"),
    changes,
    commits,
    control,
    hover: one("hover"),
    input: one("input")?.matches("input")
      ? (one("input") as HTMLInputElement)
      : (one("input")?.querySelector("input") as HTMLInputElement),
    marker: one("marker"),
    playhead: one("playhead"),
    region: one("region"),
    regions,
    root,
    selections,
    thumb: one("thumb"),
  };
}

const styleOf = (element: HTMLElement | undefined) =>
  element?.getAttribute("style") ?? "";

export function waveformSuite(framework: string, mount: MountWaveform) {
  describe(`the waveform in ${framework}`, () => {
    test("the position is a CSS variable the playhead and thumb follow", async () => {
      const p = await render(
        mount,
        { playhead: true, thumb: true },
        { value: 25 }
      );
      expect(styleOf(p.root)).toContain("--waveform-position: 25%");
      expect(styleOf(p.playhead)).toContain("left: var(--waveform-position)");
      expect(styleOf(p.thumb)).toContain("translateX(-50%)");
      p.unmount();
    });

    test("a live source moves the position in the DOM", async () => {
      const source = createSource(10);
      const p = await render(mount, {}, { source });
      expect(styleOf(p.root)).toContain("--waveform-position: 10%");
      await p.act(() => source.set(60));
      expect(styleOf(p.root)).toContain("--waveform-position: 60%");
      p.unmount();
    });

    test("a press seeks to the pointer, a drag scrubs, and the end commits", async () => {
      const p = await render(mount);
      await p.act(() => {
        pointer(p.control, "pointerdown", { clientX: 40, pointerId: 1 });
      });
      expect(p.changes.at(-1)).toEqual([40, "press", "mouse"]);
      expect(p.control.hasAttribute("data-dragging")).toBe(true);
      await p.act(() => {
        pointer(p.control, "pointermove", { clientX: 70, pointerId: 1 });
      });
      expect(p.changes.at(-1)).toEqual([70, "drag", "mouse"]);
      expect(styleOf(p.root)).toContain("--waveform-position: 70%");
      await p.act(() => {
        pointer(p.control, "pointerup", { clientX: 70, pointerId: 1 });
      });
      expect(p.commits.at(-1)?.[0]).toBe(70);
      expect(p.control.hasAttribute("data-dragging")).toBe(false);
      p.unmount();
    });

    test("the input names the control, reads the position, and takes the keys", async () => {
      const p = await render(mount, { control: { label: "Position" } });
      expect(p.input.getAttribute("aria-label")).toBe("Position");
      expect(p.input.type).toBe("range");
      expect(p.input.getAttribute("aria-valuetext")).toBe("0%");
      await p.act(() => key(p.input, "ArrowRight"));
      expect(p.changes.at(-1)).toEqual([1, "keyboard", "keyboard"]);
      await p.act(() => key(p.input, "End"));
      expect(p.changes.at(-1)?.[0]).toBe(100);
      expect(p.input.getAttribute("aria-valuetext")).toBe("100%");
      p.unmount();
    });

    test("a change can be refused", async () => {
      const p = await render(
        mount,
        {},
        {
          onValueChange: (_value: number, details: ChangeDetails) =>
            details.cancel(),
        }
      );
      await p.act(() => key(p.input, "ArrowRight"));
      expect(p.changes).toHaveLength(1);
      expect(styleOf(p.root)).toContain("--waveform-position: 0%");
      p.unmount();
    });

    test("a disabled waveform takes no seek and no key", async () => {
      const p = await render(mount, {}, { disabled: true });
      await p.act(() => {
        pointer(p.control, "pointerdown", { clientX: 40, pointerId: 1 });
      });
      await p.act(() => key(p.input, "ArrowRight"));
      expect(p.changes).toHaveLength(0);
      expect(p.root.hasAttribute("data-disabled")).toBe(true);
      p.unmount();
    });

    test("a waveform still loading waits: nothing to seek yet", async () => {
      const p = await render(mount, {}, { loading: true });
      await p.act(() => {
        pointer(p.control, "pointerdown", { clientX: 40, pointerId: 1 });
      });
      expect(p.changes).toHaveLength(0);
      expect(p.root.hasAttribute("data-loading")).toBe(true);
      p.unmount();
    });

    test("a range shows a stretch: the position and a marker follow it, outside it a playhead is marked", async () => {
      const p = await render(
        mount,
        { marker: { value: 25 } },
        { range: [0, 50], value: 25 }
      );
      expect(styleOf(p.root)).toContain("--waveform-position: 50%");
      expect(styleOf(p.marker)).toContain("left: 50%");
      expect(p.root.hasAttribute("data-outside")).toBe(false);
      p.unmount();
      const outside = await render(mount, {}, { range: [0, 50], value: 75 });
      expect(outside.root.hasAttribute("data-outside")).toBe(true);
      expect(styleOf(outside.root)).toContain("--waveform-position: 100%");
      outside.unmount();
    });

    test("a hover shows where the pointer is, and goes when it leaves", async () => {
      const p = await render(mount, {
        hover: { format: (value) => `${Math.round(value)}s` },
      });
      expect(p.hover.hasAttribute("hidden")).toBe(true);
      await p.act(() => {
        pointer(p.control, "pointermove", { clientX: 30, pointerId: 1 });
      });
      expect(p.hover.hasAttribute("hidden")).toBe(false);
      expect(p.hover.textContent).toBe("30s");
      expect(styleOf(p.hover)).toContain("left: 30%");
      await p.act(() => {
        p.control.dispatchEvent(new PointerEvent("pointerleave"));
      });
      expect(p.hover.hasAttribute("hidden")).toBe(true);
      p.unmount();
    });

    test("a Shift drag selects a stretch, reported to whoever listens", async () => {
      const p = await render(mount);
      await p.act(() => {
        pointer(p.control, "pointerdown", {
          clientX: 20,
          pointerId: 1,
          shiftKey: true,
        });
        pointer(p.control, "pointermove", { clientX: 60, pointerId: 1 });
      });
      expect(p.selections.at(-1)).toEqual([20, 60]);
      expect(p.changes).toHaveLength(0);
      await p.act(() => {
        pointer(p.control, "pointerup", { clientX: 60, pointerId: 1 });
      });
      p.unmount();
    });

    test("a region is placed over the stretch it spans, and its body moves it", async () => {
      const p = await render(mount, {
        region: { defaultValue: [20, 50], region: "loop" },
      });
      expect(styleOf(p.region)).toContain("left: 20%");
      expect(styleOf(p.region)).toContain("width: 30%");
      await p.act(() => {
        pointer(p.region, "pointerdown", { clientX: 30, pointerId: 1 });
        pointer(p.region, "pointermove", { clientX: 40, pointerId: 1 });
      });
      expect(p.regions.at(-1)).toEqual([[30, 60], "loop", "both", "drag"]);
      expect(p.changes).toHaveLength(0);
      expect(styleOf(p.region)).toContain("left: 30%");
      await p.act(() => {
        pointer(p.region, "pointerup", { clientX: 40, pointerId: 1 });
      });
      p.unmount();
    });

    test("a region's edges resize it by dragging or from their own inputs", async () => {
      const p = await render(mount, {
        region: { defaultValue: [20, 50], label: "Loop", region: "loop" },
      });
      const start = p.root.querySelector(
        '[data-slot="waveform-regionStart"]'
      ) as HTMLElement;
      const end = p.root.querySelector(
        '[data-slot="waveform-regionEnd"]'
      ) as HTMLElement;
      expect(start.getAttribute("data-edge")).toBe("start");
      expect(end.getAttribute("data-edge")).toBe("end");
      await p.act(() => {
        pointer(end, "pointerdown", { clientX: 50, pointerId: 1 });
        pointer(end, "pointermove", { clientX: 80, pointerId: 1 });
        pointer(end, "pointerup", { clientX: 80, pointerId: 1 });
      });
      expect(p.regions.at(-1)).toEqual([[20, 80], "loop", "end", "drag"]);
      const input = start.querySelector("input") as HTMLInputElement;
      expect(input.getAttribute("aria-label")).toBe("Loop start");
      await p.act(() => key(input, "ArrowRight"));
      expect(p.regions.at(-1)?.[2]).toBe("start");
      expect(p.regions.at(-1)?.[3]).toBe("keyboard");
      p.unmount();
    });

    test("bars are made one for each of the count", async () => {
      const p = await render(mount, { bars: { count: 6 } });
      expect(
        p.bars.querySelectorAll('[data-slot="waveform-bar"]')
      ).toHaveLength(6);
      expect(
        (
          p.bars.querySelector('[data-slot="waveform-bar"]') as HTMLElement
        ).getAttribute("data-index")
      ).toBe("0");
      p.unmount();
    });

    test("a canvas is drawn on, and a live signal that is audible marks the root", async () => {
      const levels = createSource<ArrayLike<number>>([0, 0]);
      const p = await render(mount, { canvas: true }, { levels });
      expect(
        p.canvas.matches("canvas") || p.canvas.querySelector("canvas")
      ).toBeTruthy();
      expect(p.root.hasAttribute("data-active")).toBe(false);
      await p.act(() => levels.set([0.8, 0.4]));
      expect(p.root.hasAttribute("data-active")).toBe(true);
      p.unmount();
    });
  });
}
