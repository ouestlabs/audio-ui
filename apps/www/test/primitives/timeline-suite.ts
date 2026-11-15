import { describe, expect, test } from "bun:test";
import { createSource } from "@audio-ui/core";
import { key, mockRect, pointer } from "./helpers.ts";

/**
 * One suite for the timeline in every framework: it writes no markup of its
 * own, only drives the DOM a framework renders from the same `timeline.ts`,
 * and finds each part by its `data-slot`.
 */

interface ChangeDetails {
  cancel: () => void;
  reason: string;
  source?: string;
}

export interface TimelineOptions {
  [option: string]: unknown;
}

/** What the suite asks a framework to render, besides the timeline itself. */
export interface TimelineTree {
  lane?: { seekable?: boolean };
  mark?: { movable?: boolean; value: number };
  options: TimelineOptions & {
    onMarkChange: (
      value: number,
      details: { mark: string } & ChangeDetails
    ) => void;
    onPositionChange: (value: number, details: ChangeDetails) => void;
    onPositionCommitted: (value: number, details: { reason: string }) => void;
    onSelectionChange: (range: number[], details: ChangeDetails) => void;
    onTrackHeightChange: (
      height: number | undefined,
      details: { track: string } & ChangeDetails
    ) => void;
    onZoomChange: (zoom: number, details: ChangeDetails) => void;
  };
  playhead?: boolean;
  ruler?: { label?: string };
  track?: { height?: number; label?: string; track: string };
}

/** A timeline a framework rendered. */
export interface Mounted {
  act: (interact: () => void) => Promise<void>;
  container: HTMLElement;
  unmount: () => void;
}

export type MountTimeline = (tree: TimelineTree) => Promise<Mounted>;

async function render(
  mount: MountTimeline,
  tree: Omit<TimelineTree, "options"> = {},
  options: TimelineOptions = {}
) {
  const positions: [number, string, string | undefined][] = [];
  const commits: [number, string][] = [];
  const zooms: number[] = [];
  const heights: [number | undefined, string, string][] = [];
  const marks: [number, string, string][] = [];
  const selections: number[][] = [];
  const mounted = await mount({
    ruler: {},
    ...tree,
    options: {
      duration: 100,
      ...options,
      onMarkChange: (value, details) => {
        marks.push([value, details.mark, details.reason]);
      },
      onPositionChange: (value, details) => {
        positions.push([value, details.reason, details.source]);
        (
          options.onPositionChange as
            | ((v: number, d: ChangeDetails) => void)
            | undefined
        )?.(value, details);
      },
      onPositionCommitted: (value, details) => {
        commits.push([value, details.reason]);
      },
      onSelectionChange: (range) => {
        selections.push([...range]);
      },
      onTrackHeightChange: (height, details) => {
        heights.push([height, details.track, details.reason]);
      },
      onZoomChange: (zoom) => {
        zooms.push(zoom);
      },
    },
  });
  const one = (slot: string) =>
    mounted.container.querySelector(
      `[data-slot="timeline-${slot}"]`
    ) as HTMLElement;
  const root = mounted.container.querySelector(
    '[data-slot="timeline"]'
  ) as HTMLElement;
  const box = { bottom: 20, height: 20, right: 100, width: 100 };
  const ruler = one("ruler");
  const lane = one("lane");
  for (const element of [ruler, lane]) {
    if (element) {
      mockRect(element, box);
    }
  }
  const inputOf = (part: HTMLElement | null) =>
    part?.matches("input")
      ? (part as HTMLInputElement)
      : (part?.querySelector("input") as HTMLInputElement);
  return {
    ...mounted,
    commits,
    heights,
    input: inputOf(one("rulerInput")),
    lane,
    mark: one("mark"),
    marks,
    playhead: one("playhead"),
    positions,
    resize: one("trackResizeHandle"),
    resizeInput: inputOf(one("trackResizeInput")),
    root,
    ruler,
    selections,
    track: one("track"),
    viewport: one("viewport"),
    zooms,
  };
}

const styleOf = (element: HTMLElement | undefined) =>
  element?.getAttribute("style") ?? "";

export function timelineSuite(framework: string, mount: MountTimeline) {
  describe(`the timeline in ${framework}`, () => {
    test("the playhead sits at the position, placed by the lane's unit", async () => {
      const p = await render(mount, { playhead: true }, { position: 25 });
      expect(styleOf(p.playhead)).toContain("--timeline-offset: 25");
      expect(styleOf(p.playhead)).toContain(
        "left: calc(var(--timeline-unit) * var(--timeline-offset))"
      );
      p.unmount();
    });

    test("a live source moves the playhead in the DOM", async () => {
      const source = createSource(10);
      const p = await render(mount, { playhead: true }, { source });
      expect(styleOf(p.playhead)).toContain("--timeline-offset: 10");
      await p.act(() => source.set(60));
      expect(styleOf(p.playhead)).toContain("--timeline-offset: 60");
      p.unmount();
    });

    test("a lane sets the width of a unit: a share when fitted, px when zoomed", async () => {
      const fitted = await render(mount);
      expect(styleOf(fitted.ruler)).toContain(
        "--timeline-unit: calc(100% / 100)"
      );
      expect(fitted.root.hasAttribute("data-fitted")).toBe(true);
      fitted.unmount();
      const zoomed = await render(mount, {}, { zoom: 20 });
      expect(styleOf(zoomed.ruler)).toContain("--timeline-unit: 20px");
      expect(styleOf(zoomed.ruler)).toContain("min-width: 2000px");
      expect(zoomed.root.hasAttribute("data-fitted")).toBe(false);
      zoomed.unmount();
    });

    test("a press on the ruler seeks, a drag scrubs, and the end commits", async () => {
      const p = await render(mount);
      await p.act(() => {
        pointer(p.ruler, "pointerdown", { clientX: 30, pointerId: 1 });
      });
      expect(p.positions.at(-1)).toEqual([30, "press", "mouse"]);
      expect(p.root.hasAttribute("data-scrubbing")).toBe(true);
      await p.act(() => {
        pointer(p.ruler, "pointermove", { clientX: 60, pointerId: 1 });
      });
      expect(p.positions.at(-1)?.[0]).toBe(60);
      await p.act(() => {
        pointer(p.ruler, "pointerup", { clientX: 60, pointerId: 1 });
      });
      expect(p.commits.at(-1)?.[0]).toBe(60);
      expect(p.root.hasAttribute("data-scrubbing")).toBe(false);
      p.unmount();
    });

    test("the ruler's input names it, reads the position, and takes the keys", async () => {
      const p = await render(mount, { ruler: { label: "Position" } });
      expect(p.input.getAttribute("aria-label")).toBe("Position");
      expect(p.input.type).toBe("range");
      await p.act(() => key(p.input, "ArrowRight"));
      expect(p.positions.at(-1)).toEqual([1, "keyboard", "keyboard"]);
      await p.act(() => key(p.input, "End"));
      expect(p.positions.at(-1)?.[0]).toBe(100);
      expect(p.input.value).toBe("100");
      p.unmount();
    });

    test("a change can be refused", async () => {
      const p = await render(
        mount,
        { playhead: true },
        { onPositionChange: (_v: number, d: ChangeDetails) => d.cancel() }
      );
      await p.act(() => key(p.input, "ArrowRight"));
      expect(p.positions).toHaveLength(1);
      expect(styleOf(p.playhead)).toContain("--timeline-offset: 0");
      p.unmount();
    });

    test("a disabled timeline takes no seek and no key", async () => {
      const p = await render(mount, {}, { disabled: true });
      await p.act(() => {
        pointer(p.ruler, "pointerdown", { clientX: 30, pointerId: 1 });
      });
      await p.act(() => key(p.input, "ArrowRight"));
      expect(p.positions).toHaveLength(0);
      expect(p.root.hasAttribute("data-disabled")).toBe(true);
      p.unmount();
    });

    test("a seekable lane moves the position from its bare area, a plain one does not", async () => {
      const plain = await render(mount, { lane: {} });
      await plain.act(() => {
        pointer(plain.lane, "pointerdown", { clientX: 40, pointerId: 1 });
      });
      expect(plain.positions).toHaveLength(0);
      plain.unmount();
      const seekable = await render(mount, { lane: { seekable: true } });
      await seekable.act(() => {
        pointer(seekable.lane, "pointerdown", { clientX: 40, pointerId: 1 });
      });
      expect(seekable.positions.at(-1)?.[0]).toBe(40);
      await seekable.act(() => {
        pointer(seekable.lane, "pointerup", { clientX: 40, pointerId: 1 });
      });
      seekable.unmount();
    });

    test("a Shift drag on the ruler selects a stretch, reported to whoever listens", async () => {
      const p = await render(mount);
      await p.act(() => {
        pointer(p.ruler, "pointerdown", {
          clientX: 20,
          pointerId: 1,
          shiftKey: true,
        });
        pointer(p.ruler, "pointermove", { clientX: 60, pointerId: 1 });
      });
      expect(p.selections.at(-1)).toEqual([20, 60]);
      await p.act(() => {
        pointer(p.ruler, "pointerup", { clientX: 60, pointerId: 1 });
      });
      p.unmount();
    });

    test("a track keeps the height it is given, and its handle asks for another", async () => {
      const p = await render(mount, {
        track: { height: 80, label: "Resize", track: "drums" },
      });
      expect(styleOf(p.track)).toContain("height: 80px");
      expect(p.track.getAttribute("data-track")).toBe("drums");
      expect(p.resizeInput.getAttribute("aria-label")).toBe("Resize");
      await p.act(() => key(p.resizeInput, "ArrowDown"));
      expect(p.heights.at(-1)).toEqual([88, "drums", "keyboard"]);
      await p.act(() => {
        p.resize.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      });
      expect(p.heights.at(-1)?.[0]).toBeUndefined();
      p.unmount();
    });

    test("a mark is placed at its value, and a movable one is dragged or nudged", async () => {
      const still = await render(mount, { mark: { value: 25 } });
      expect(styleOf(still.mark)).toContain("--timeline-offset: 25");
      expect(styleOf(still.mark)).not.toContain("data-dragging");
      still.unmount();
      const p = await render(mount, {
        lane: {},
        mark: { movable: true, value: 25 },
      });
      await p.act(() => {
        pointer(p.mark, "pointerdown", { clientX: 25, pointerId: 1 });
        pointer(p.mark, "pointermove", { clientX: 40, pointerId: 1 });
      });
      expect(p.marks.at(-1)?.[0]).toBe(40);
      expect(p.marks.at(-1)?.[1]).toBe("25");
      expect(p.positions).toHaveLength(0);
      await p.act(() => {
        pointer(p.mark, "pointerup", { clientX: 40, pointerId: 1 });
      });
      p.unmount();
    });
  });
}
