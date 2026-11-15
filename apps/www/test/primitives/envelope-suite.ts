import { describe, expect, test } from "bun:test";
import { polylinePoints } from "@audio-ui/core/envelope";
import { key, mockRect, pointer } from "./helpers.ts";

/**
 * One suite for the envelope in every framework: it writes no markup of its
 * own, only drives the DOM a framework renders from the same `envelope.ts`,
 * and finds each part by its `data-slot`.
 */

interface Breakpoint {
  curve?: number;
  x: number;
  y: number;
}

type Recorded = [value: Breakpoint[], reason: string, index?: number][];

interface ChangeDetails {
  cancel: () => void;
  index?: number;
  reason: string;
}

export interface EnvelopeOptions {
  onValueChange?: (value: Breakpoint[], details: ChangeDetails) => void;
  [option: string]: unknown;
}

/** What the suite asks a framework to render. */
export interface EnvelopeTree {
  options: EnvelopeOptions & {
    onValueChange: (value: Breakpoint[], details: ChangeDetails) => void;
    onValueCommitted: (
      value: Breakpoint[],
      details: { index?: number; reason: string }
    ) => void;
  };
}

/** An envelope a framework rendered. */
export interface Mounted {
  act: (interact: () => void) => Promise<void>;
  container: HTMLElement;
  unmount: () => void;
}

export type MountEnvelope = (tree: EnvelopeTree) => Promise<Mounted>;

/** A rise to a peak and a fall, three points. */
const TRIANGLE: Breakpoint[] = [
  { x: 0, y: 0 },
  { x: 0.5, y: 1 },
  { x: 1, y: 0 },
];

async function render(mount: MountEnvelope, options: EnvelopeOptions = {}) {
  const changes: Recorded = [];
  const commits: Recorded = [];
  const mounted = await mount({
    options: {
      defaultValue: TRIANGLE,
      locale: "en-US",
      ...options,
      onValueChange: (value, details) => {
        changes.push([value, details.reason, details.index]);
        options.onValueChange?.(value, details);
      },
      onValueCommitted: (value, details) => {
        commits.push([value, details.reason, details.index]);
      },
    },
  });
  const all = (slot: string) => [
    ...mounted.container.querySelectorAll<HTMLElement>(
      `[data-slot="envelope-${slot}"]`
    ),
  ];
  const graph = all("graph")[0] as HTMLElement;
  // A 100×100 graph at the origin: x runs left to right, y from the bottom.
  mockRect(graph, { bottom: 100, height: 100, right: 100, width: 100 });
  const view = {
    ...mounted,
    changes,
    commits,
    fills: all("fill"),
    graph,
    lines: all("line"),
    points: () => all("point"),
    root: mounted.container.querySelector(
      '[data-slot="envelope"]'
    ) as HTMLElement,
    segments: () => all("segment"),
  };
  return view;
}

/** Waits for a signal the controller raises a frame after the change, so an animation can replay. */
async function until(check: () => boolean, tick: () => Promise<void>) {
  for (let attempt = 0; attempt < 30 && !check(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    await tick();
  }
}

const styleOf = (element: HTMLElement | undefined) =>
  element?.getAttribute("style") ?? "";
const nowOf = (element: HTMLElement | undefined) =>
  Number(element?.getAttribute("aria-valuenow"));

export function envelopeSuite(framework: string, mount: MountEnvelope) {
  describe(`the envelope in ${framework}`, () => {
    test("a slider for each point, with its level and its coordinates", async () => {
      const e = await render(mount);
      const points = e.points();
      expect(points).toHaveLength(3);
      expect(points.map((point) => point.getAttribute("role"))).toEqual([
        "slider",
        "slider",
        "slider",
      ]);
      expect(points.map((point) => nowOf(point))).toEqual([0, 1, 0]);
      expect(points[1]?.getAttribute("aria-valuetext")).toBe("0.5, 1");
      e.unmount();
    });

    test("a point sits at its x and y, as percentages of the graph", async () => {
      const e = await render(mount);
      const [, peak] = e.points();
      expect(styleOf(peak)).toContain("left: 50%");
      expect(styleOf(peak)).toContain("bottom: 100%");
      e.unmount();
    });

    test("the line and the fill are drawn through the points", async () => {
      const e = await render(mount);
      const points = polylinePoints(TRIANGLE);
      expect(
        e.lines[0]?.querySelector("polyline")?.getAttribute("points")
      ).toBe(points);
      expect(
        e.fills[0]?.querySelector("polyline")?.getAttribute("points")
      ).toBe(`${points} 100,100 0,100`);
      e.unmount();
    });

    test("a segment handle sits on the middle of each stretch, flat ones say so", async () => {
      const e = await render(mount, {
        defaultValue: [
          { x: 0, y: 0 },
          { x: 0.5, y: 1 },
          { x: 1, y: 1 },
        ],
      });
      const segments = e.segments();
      expect(segments).toHaveLength(2);
      expect(styleOf(segments[0])).toContain("left: 25%");
      expect(segments[0]?.hasAttribute("data-flat")).toBe(false);
      expect(segments[1]?.hasAttribute("data-flat")).toBe(true);
      expect(segments[1]?.getAttribute("aria-disabled")).toBe("true");
      e.unmount();
    });

    test("one point is the tab stop, and Page Up, Page Down, Home and End move between them", async () => {
      const e = await render(mount);
      expect(e.points().map((point) => point.getAttribute("tabindex"))).toEqual(
        ["0", "-1", "-1"]
      );
      await e.act(() => key(e.points()[0] as HTMLElement, "PageUp"));
      expect(document.activeElement).toBe(e.points()[1]);
      await e.act(() => key(e.points()[1] as HTMLElement, "End"));
      expect(document.activeElement).toBe(e.points()[2]);
      expect(e.points().map((point) => point.getAttribute("tabindex"))).toEqual(
        ["-1", "-1", "0"]
      );
      await e.act(() => key(e.points()[2] as HTMLElement, "Home"));
      expect(document.activeElement).toBe(e.points()[0]);
      e.unmount();
    });

    test("arrows nudge a point by a step, reporting a keyboard change with the point's index", async () => {
      const e = await render(mount);
      let event: KeyboardEvent | undefined;
      await e.act(() => {
        event = key(e.points()[1] as HTMLElement, "ArrowLeft");
      });
      expect(event?.defaultPrevented).toBe(true);
      const [value, reason, index] = e.changes.at(-1) ?? [];
      expect(reason).toBe("keyboard");
      expect(index).toBe(1);
      expect(value?.[1]?.x).toBeCloseTo(0.49, 5);
      expect(e.commits.at(-1)?.[1]).toBe("keyboard");
      e.unmount();
    });

    test("Delete and a double click remove a point, but not below the least number", async () => {
      const e = await render(mount, { minPoints: 2 });
      await e.act(() => key(e.points()[1] as HTMLElement, "Delete"));
      expect(e.points()).toHaveLength(2);
      expect(e.changes.at(-1)?.[1]).toBe("remove");
      expect(e.points()[0]?.hasAttribute("data-removable")).toBe(false);
      await e.act(() =>
        e
          .points()[0]
          ?.dispatchEvent(
            new MouseEvent("dblclick", { bubbles: true, cancelable: true })
          )
      );
      expect(e.points()).toHaveLength(2);
      await until(
        () => Boolean(e.points()[0]?.hasAttribute("data-blocked")),
        () => e.act(() => undefined)
      );
      expect(e.points()[0]?.hasAttribute("data-blocked")).toBe(true);
      e.unmount();
    });

    test("an Alt + press on a point removes it", async () => {
      const e = await render(mount);
      await e.act(() =>
        pointer(e.points()[1] as HTMLElement, "pointerdown", {
          altKey: true,
          clientX: 50,
          clientY: 0,
          pointerId: 1,
        })
      );
      expect(e.points()).toHaveLength(2);
      expect(e.changes.at(-1)?.[1]).toBe("remove");
      e.unmount();
    });

    test("a double click on the graph adds a point where it is, and moves the tab stop to it", async () => {
      const e = await render(mount);
      await e.act(() =>
        e.graph.dispatchEvent(
          new MouseEvent("dblclick", {
            bubbles: true,
            cancelable: true,
            clientX: 25,
            clientY: 50,
          })
        )
      );
      expect(e.points()).toHaveLength(4);
      const [value, reason, index] = e.changes.at(-1) ?? [];
      expect(reason).toBe("add");
      expect(index).toBe(1);
      expect(value?.[1]).toMatchObject({ x: 0.25, y: 0.5 });
      expect(e.points()[1]?.getAttribute("tabindex")).toBe("0");
      e.unmount();
    });

    test("adding is refused at the most points, and the graph says so", async () => {
      const e = await render(mount, { maxPoints: 3 });
      await e.act(() =>
        e.graph.dispatchEvent(
          new MouseEvent("dblclick", {
            bubbles: true,
            cancelable: true,
            clientX: 25,
            clientY: 50,
          })
        )
      );
      expect(e.points()).toHaveLength(3);
      await until(
        () => e.graph.hasAttribute("data-blocked"),
        () => e.act(() => undefined)
      );
      expect(e.graph.hasAttribute("data-blocked")).toBe(true);
      e.unmount();
    });

    test("a drag moves a point between its neighbors, committed on release", async () => {
      const e = await render(mount);
      const peak = e.points()[1] as HTMLElement;
      await e.act(() => {
        pointer(peak, "pointerdown", { clientX: 50, clientY: 0, pointerId: 1 });
        pointer(peak, "pointermove", {
          clientX: 30,
          clientY: 40,
          pointerId: 1,
        });
      });
      const [value, reason, index] = e.changes.at(-1) ?? [];
      expect(reason).toBe("drag");
      expect(index).toBe(1);
      expect(value?.[1]?.x).toBeCloseTo(0.3, 2);
      expect(value?.[1]?.y).toBeCloseTo(0.6, 2);
      expect(e.root.hasAttribute("data-dragging")).toBe(true);
      expect(peak.hasAttribute("data-dragging")).toBe(true);
      await e.act(() =>
        pointer(peak, "pointerup", { clientX: 30, clientY: 40, pointerId: 1 })
      );
      expect(e.commits.at(-1)?.[1]).toBe("drag");
      expect(e.root.hasAttribute("data-dragging")).toBe(false);
      e.unmount();
    });

    test("a point stops at its neighbor", async () => {
      const e = await render(mount);
      const peak = e.points()[1] as HTMLElement;
      await e.act(() => {
        pointer(peak, "pointerdown", { clientX: 50, clientY: 0, pointerId: 1 });
        pointer(peak, "pointermove", {
          clientX: 120,
          clientY: 0,
          pointerId: 1,
        });
      });
      expect(e.changes.at(-1)?.[0][1]?.x).toBeLessThanOrEqual(1);
      e.unmount();
    });

    test("a drag snaps to the grid", async () => {
      const e = await render(mount, { snap: 0.25 });
      const peak = e.points()[1] as HTMLElement;
      await e.act(() => {
        pointer(peak, "pointerdown", { clientX: 50, clientY: 0, pointerId: 1 });
        pointer(peak, "pointermove", {
          clientX: 30,
          clientY: 40,
          pointerId: 1,
        });
      });
      expect(e.changes.at(-1)?.[0][1]).toMatchObject({ x: 0.25, y: 0.5 });
      e.unmount();
    });

    test("up and down bend a segment, a double click straightens it", async () => {
      const e = await render(mount);
      const segment = e.segments()[0] as HTMLElement;
      await e.act(() => key(segment, "ArrowUp"));
      const [, reason, index] = e.changes.at(-1) ?? [];
      expect(reason).toBe("curve");
      expect(index).toBe(0);
      expect(Math.abs(nowOf(e.segments()[0]))).toBeGreaterThan(0);
      await e.act(() =>
        e
          .segments()[0]
          ?.dispatchEvent(
            new MouseEvent("dblclick", { bubbles: true, cancelable: true })
          )
      );
      expect(nowOf(e.segments()[0])).toBe(0);
      e.unmount();
    });

    test("an Alt drag on the graph bends the segment under the pointer", async () => {
      const e = await render(mount);
      await e.act(() => {
        pointer(e.graph, "pointerdown", {
          altKey: true,
          clientX: 25,
          clientY: 50,
          pointerId: 1,
        });
        pointer(e.graph, "pointermove", {
          altKey: true,
          clientX: 25,
          clientY: 80,
          pointerId: 1,
        });
      });
      expect(e.changes.at(-1)?.[1]).toBe("curve");
      e.unmount();
    });

    test("cancel() in onValueChange refuses the change", async () => {
      const e = await render(mount, {
        onValueChange: (_value, details) => details.cancel(),
      });
      await e.act(() => key(e.points()[1] as HTMLElement, "Delete"));
      expect(e.points()).toHaveLength(3);
      expect(e.commits).toEqual([]);
      e.unmount();
    });

    test("a disabled envelope takes no key, press or double click, and says so", async () => {
      const e = await render(mount, { disabled: true });
      await e.act(() => {
        key(e.points()[1] as HTMLElement, "ArrowUp");
        pointer(e.points()[1] as HTMLElement, "pointerdown", {
          clientX: 50,
          clientY: 0,
          pointerId: 1,
        });
        e.graph.dispatchEvent(
          new MouseEvent("dblclick", {
            bubbles: true,
            cancelable: true,
            clientX: 25,
            clientY: 50,
          })
        );
      });
      expect(e.changes).toEqual([]);
      expect(e.root.hasAttribute("data-disabled")).toBe(true);
      expect(e.points().map((point) => point.getAttribute("tabindex"))).toEqual(
        ["-1", "-1", "-1"]
      );
      e.unmount();
    });

    test("controlled points are the ones drawn", async () => {
      const e = await render(mount, {
        defaultValue: undefined,
        value: [
          { x: 0, y: 0.2 },
          { x: 1, y: 0.8 },
        ],
      });
      expect(e.points()).toHaveLength(2);
      expect(e.points().map((point) => nowOf(point))).toEqual([0.2, 0.8]);
      e.unmount();
    });
  });
}
