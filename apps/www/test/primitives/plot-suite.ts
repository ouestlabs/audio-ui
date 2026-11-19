import { describe, expect, test } from "bun:test";
import { createSource } from "@/registry/primitives/primitive";
import { key, mockRect, pointer } from "./helpers.ts";

const MARK_LEFT = /left: (49\.9|50|50\.0)/;
const HANDLE_TOP = /top: (20|19\.9\d*)%/;

/**
 * One suite for the plot in every framework: it writes no markup of its own,
 * only drives the DOM a framework renders from the same `plot.ts`, and finds
 * each part by its `data-slot`.
 */

interface Point {
  x: number;
  y: number;
}

interface ChangeDetails {
  cancel: () => void;
  handle: string;
  reason: string;
  source?: string;
}

export interface PlotOptions {
  onValueChange?: (value: Point, details: ChangeDetails) => void;
  [option: string]: unknown;
}

interface GridAxis {
  format?: (value: number) => string;
  ticks?: readonly number[];
}

/** What the suite asks a framework to render, besides the plot itself. */
export interface PlotTree {
  band?: { axis: "x" | "y"; from: number; to: number };
  cursor?: { format: (value: Point) => string };
  curve?: { fillTo?: number; fn: (x: number) => number };
  dot?: { source?: unknown; value?: Point };
  grid?: { x?: GridAxis; y?: GridAxis };
  handle?: {
    axis?: "both" | "x" | "y";
    defaultValue?: Point;
    handle: string;
    label?: string;
    value?: Point;
  };
  line?: { axis: "x" | "y"; value: number };
  mark?: { axis: "x" | "y"; value: number };
  options: PlotOptions & {
    onValueChange: (value: Point, details: ChangeDetails) => void;
    onValueCommitted: (value: Point, details: { reason: string }) => void;
  };
  trace?: { fillTo?: number; source: unknown };
}

/** A plot a framework rendered. */
export interface Mounted {
  act: (interact: () => void) => Promise<void>;
  container: HTMLElement;
  unmount: () => void;
}

export type MountPlot = (tree: PlotTree) => Promise<Mounted>;

/** A 100 by 100 plot at the origin, over 0 to 100 on both axes, so a pixel is a unit. */
const SQUARE = { maxX: 100, maxY: 100, minX: 0, minY: 0 };

async function render(
  mount: MountPlot,
  tree: Omit<PlotTree, "options"> = {},
  options: PlotOptions = {}
) {
  const changes: [Point, string, string][] = [];
  const commits: [Point, string][] = [];
  const mounted = await mount({
    ...tree,
    options: {
      ...SQUARE,
      ...options,
      onValueChange: (value, details) => {
        changes.push([{ ...value }, details.handle, details.reason]);
        options.onValueChange?.(value, details);
      },
      onValueCommitted: (value, details) => {
        commits.push([{ ...value }, details.reason]);
      },
    },
  });
  const one = (slot: string) =>
    mounted.container.querySelector(
      `[data-slot="plot-${slot}"]`
    ) as HTMLElement;
  const root = mounted.container.querySelector(
    '[data-slot="plot"]'
  ) as HTMLElement;
  mockRect(root, { bottom: 100, height: 100, right: 100, width: 100 });
  return {
    ...mounted,
    band: one("band"),
    changes,
    commits,
    curve: one("curve"),
    cursor: one("cursor"),
    dot: one("dot"),
    grid: one("grid"),
    handle: one("handle"),
    inputs: () => [
      ...mounted.container.querySelectorAll<HTMLInputElement>(
        '[data-slot="plot-handle"] input[type="range"]'
      ),
    ],
    line: one("line"),
    mark: one("mark"),
    readout: one("cursorReadout") ?? one("cursor-readout"),
    root,
    trace: one("trace"),
  };
}

const styleOf = (element: HTMLElement | undefined) =>
  element?.getAttribute("style") ?? "";
const pathOf = (part: HTMLElement | undefined) =>
  part?.querySelector("path")?.getAttribute("d") ?? "";

/** Waits for the frame a drag reports its moves on. */
const frame = () => new Promise((resolve) => setTimeout(resolve, 30));

export function plotSuite(framework: string, mount: MountPlot) {
  describe(`the plot in ${framework}`, () => {
    test("a surface that is positioned and contained", async () => {
      const p = await render(mount);
      expect(styleOf(p.root)).toContain("position: relative");
      expect(styleOf(p.root)).toContain("contain: layout style");
      p.unmount();
    });

    test("a curve draws y = fn(x) in the axes' units, and closes to a value to be filled", async () => {
      const p = await render(mount, { curve: { fn: (x) => x } });
      const d = pathOf(p.curve);
      expect(d.startsWith("M 0 1")).toBe(true);
      expect(d.endsWith("1 0")).toBe(true);
      expect(p.curve.tagName.toLowerCase()).not.toBe("path");
      p.unmount();
      const filled = await render(mount, {
        curve: { fillTo: 0, fn: (x) => x },
      });
      expect(pathOf(filled.curve).endsWith("Z")).toBe(true);
      filled.unmount();
    });

    test("a vertical line sits at an x value, a horizontal one at a y value", async () => {
      const vertical = await render(mount, { line: { axis: "x", value: 25 } });
      const stroke = vertical.line.querySelector("line");
      expect(stroke?.getAttribute("x1")).toBe("0.25");
      expect(stroke?.getAttribute("y2")).toBe("1");
      vertical.unmount();
      const horizontal = await render(mount, {
        line: { axis: "y", value: 25 },
      });
      expect(horizontal.line.querySelector("line")?.getAttribute("y1")).toBe(
        "0.75"
      );
      horizontal.unmount();
    });

    test("a band covers a stretch of one axis and the whole of the other", async () => {
      const p = await render(mount, { band: { axis: "x", from: 20, to: 60 } });
      const rect = p.band.querySelector("rect");
      expect(rect?.getAttribute("x")).toBe("0.2");
      expect(rect?.getAttribute("width")).toBe("0.4");
      expect(rect?.getAttribute("height")).toBe("1");
      p.unmount();
    });

    test("a mark sits at its value along an axis", async () => {
      const across = await render(mount, { mark: { axis: "x", value: 25 } });
      expect(styleOf(across.mark)).toContain("left: 25%");
      across.unmount();
      const down = await render(mount, { mark: { axis: "y", value: 25 } });
      expect(styleOf(down.mark)).toContain("top: 75%");
      down.unmount();
    });

    test("a logarithmic axis puts the geometric middle at the middle", async () => {
      const p = await render(
        mount,
        { mark: { axis: "x", value: 632.456 } },
        { maxX: 20_000, minX: 20, scaleX: "log" }
      );
      expect(styleOf(p.mark)).toMatch(MARK_LEFT);
      p.unmount();
    });

    test("a grid draws a line and a label for each tick, and marks the zero", async () => {
      const p = await render(
        mount,
        { grid: { y: { ticks: [-12, 0, 12] } } },
        { maxY: 12, minY: -12 }
      );
      const lines = p.grid.querySelectorAll('[data-part="line"]');
      expect(lines).toHaveLength(3);
      expect([
        ...p.grid.querySelectorAll('[data-part="line"][data-zero]'),
      ]).toHaveLength(1);
      expect(
        [...p.grid.querySelectorAll('[data-part="label"]')].map(
          (label) => label.textContent
        )
      ).toEqual(["-12", "0", "12"]);
      p.unmount();
    });

    test("a live trace is drawn straight in the DOM, frame by frame", async () => {
      const source = createSource<ArrayLike<number>>([0, 100]);
      const p = await render(mount, { trace: { source } });
      expect(pathOf(p.trace)).toBe("M 0 1 L 1 0");
      await p.act(() => source.set([100, 0]));
      expect(pathOf(p.trace)).toBe("M 0 0 L 1 1");
      p.unmount();
    });

    test("a dot sits at a point, and a live one moves with its source", async () => {
      const still = await render(mount, { dot: { value: { x: 25, y: 75 } } });
      expect(styleOf(still.dot)).toContain("left: 25%");
      expect(styleOf(still.dot)).toContain("top: 25%");
      still.unmount();
      const source = createSource<Point>({ x: 10, y: 10 });
      const live = await render(mount, { dot: { source } });
      expect(styleOf(live.dot)).toContain("left: 10%");
      await live.act(() => source.set({ x: 60, y: 40 }));
      expect(styleOf(live.dot)).toContain("left: 60%");
      expect(styleOf(live.dot)).toContain("top: 60%");
      live.unmount();
    });

    test("a handle holds a native range input for each axis it moves along, named by its label", async () => {
      const both = await render(mount, {
        handle: { handle: "band", label: "Band" },
      });
      expect(both.inputs()).toHaveLength(2);
      expect(
        both.inputs().map((input) => input.getAttribute("aria-label"))
      ).toEqual(["Band X", "Band Y"]);
      expect(both.handle.getAttribute("data-handle")).toBe("band");
      both.unmount();
      const across = await render(mount, {
        handle: { axis: "x", handle: "cutoff", label: "Cutoff" },
      });
      expect(across.inputs()).toHaveLength(1);
      expect(across.inputs()[0]?.getAttribute("aria-label")).toBe("Cutoff");
      across.unmount();
    });

    test("a handle starts in the middle, or at its default, and sits there", async () => {
      const middle = await render(mount, { handle: { handle: "a" } });
      expect(styleOf(middle.handle)).toContain("left: 50%");
      expect(styleOf(middle.handle)).toContain("top: 50%");
      middle.unmount();
      const set = await render(mount, {
        handle: { defaultValue: { x: 25, y: 75 }, handle: "a" },
      });
      expect(styleOf(set.handle)).toContain("left: 25%");
      expect(styleOf(set.handle)).toContain("top: 25%");
      set.unmount();
    });

    test("an arrow key nudges a handle, reporting its name and a keyboard reason", async () => {
      const p = await render(mount, {
        handle: { handle: "band", label: "Band" },
      });
      let event: KeyboardEvent | undefined;
      await p.act(() => {
        event = key(p.inputs()[0] as HTMLInputElement, "ArrowRight");
      });
      expect(event?.defaultPrevented).toBe(true);
      const [value, name, reason] = p.changes.at(-1) ?? [];
      expect(name).toBe("band");
      expect(reason).toBe("keyboard");
      expect(value?.x).toBeCloseTo(51, 1);
      expect(p.commits.at(-1)?.[1]).toBe("keyboard");
      p.unmount();
    });

    test("a drag moves a handle from where it is, committed on release", async () => {
      const p = await render(mount, { handle: { handle: "a" } });
      await p.act(() => {
        pointer(p.handle, "pointerdown", {
          clientX: 50,
          clientY: 50,
          pointerId: 1,
        });
        pointer(p.handle, "pointermove", {
          clientX: 70,
          clientY: 30,
          pointerId: 1,
        });
      });
      await frame();
      await p.act(() => undefined);
      const [value, , reason] = p.changes.at(-1) ?? [];
      expect(reason).toBe("drag");
      expect(value?.x).toBeCloseTo(70, 0);
      expect(value?.y).toBeCloseTo(70, 0);
      expect(p.handle.hasAttribute("data-dragging")).toBe(true);
      await p.act(() =>
        pointer(p.handle, "pointerup", {
          clientX: 70,
          clientY: 30,
          pointerId: 1,
        })
      );
      expect(p.commits.at(-1)?.[1]).toBe("drag");
      expect(p.handle.hasAttribute("data-dragging")).toBe(false);
      p.unmount();
    });

    test("a double click and Delete return a handle to its default", async () => {
      const p = await render(mount, {
        handle: { defaultValue: { x: 30, y: 30 }, handle: "a" },
      });
      await p.act(() => key(p.inputs()[0] as HTMLInputElement, "ArrowRight"));
      await p.act(() =>
        p.handle.dispatchEvent(
          new MouseEvent("dblclick", { bubbles: true, cancelable: true })
        )
      );
      expect(p.commits.at(-1)?.[1]).toBe("reset");
      expect(styleOf(p.handle)).toContain("left: 30%");
      await p.act(() => key(p.inputs()[0] as HTMLInputElement, "ArrowRight"));
      await p.act(() => key(p.inputs()[0] as HTMLInputElement, "Delete"));
      expect(styleOf(p.handle)).toContain("left: 30%");
      p.unmount();
    });

    test("a controlled handle is the one drawn", async () => {
      const p = await render(mount, {
        handle: { handle: "a", value: { x: 20, y: 80 } },
      });
      expect(styleOf(p.handle)).toContain("left: 20%");
      expect(styleOf(p.handle)).toMatch(HANDLE_TOP);
      p.unmount();
    });

    test("a key on a controlled handle commits the value it reported", async () => {
      // The app has not given the new value back yet when the commit is made.
      const p = await render(mount, {
        handle: { handle: "a", label: "A", value: { x: 20, y: 80 } },
      });
      await p.act(() => key(p.inputs()[0] as HTMLInputElement, "ArrowRight"));
      const [changed] = p.changes.at(-1) ?? [];
      const [committed] = p.commits.at(-1) ?? [];
      expect(changed?.x).toBeCloseTo(21, 1);
      expect(committed?.x).toBeCloseTo(21, 1);
      p.unmount();
    });

    test("cancel() in onValueChange keeps the handle where it was", async () => {
      const p = await render(
        mount,
        { handle: { handle: "a" } },
        { onValueChange: (_value, details) => details.cancel() }
      );
      await p.act(() => key(p.inputs()[0] as HTMLInputElement, "ArrowRight"));
      expect(styleOf(p.handle)).toContain("left: 50%");
      expect(p.commits).toEqual([]);
      p.unmount();
    });

    test("a disabled plot moves no handle, and says so", async () => {
      const p = await render(
        mount,
        { handle: { handle: "a" } },
        { disabled: true }
      );
      await p.act(() => {
        key(p.inputs()[0] as HTMLInputElement, "ArrowRight");
        pointer(p.handle, "pointerdown", {
          clientX: 50,
          clientY: 50,
          pointerId: 1,
        });
      });
      expect(p.changes).toEqual([]);
      expect(p.root.hasAttribute("data-disabled")).toBe(true);
      expect(p.inputs().every((input) => input.disabled)).toBe(true);
      p.unmount();
    });

    test("a cursor follows the pointer over the plot, and its readout says the value under it", async () => {
      const p = await render(mount, {
        cursor: {
          format: (value) => `${Math.round(value.x)}, ${Math.round(value.y)}`,
        },
      });
      await p.act(() =>
        pointer(p.root, "pointermove" as never, {
          clientX: 25,
          clientY: 25,
          pointerId: 1,
          pointerType: "mouse",
        })
      );
      expect(p.cursor.style.getPropertyValue("--plot-cursor-x")).toBe("25%");
      expect(p.cursor.style.getPropertyValue("--plot-cursor-y")).toBe("25%");
      expect(p.cursor.hasAttribute("data-active")).toBe(true);
      expect(p.readout?.textContent).toBe("25, 75");
      await p.act(() => {
        p.root.dispatchEvent(new PointerEvent("pointerleave"));
      });
      expect(p.cursor.hasAttribute("data-active")).toBe(false);
      expect(p.readout?.textContent).toBe("");
      p.unmount();
    });
  });
}
