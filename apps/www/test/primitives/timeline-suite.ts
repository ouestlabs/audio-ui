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

interface ClipValue {
  fadeIn: number;
  fadeInShape?: string;
  fadeOut: number;
  length: number;
  offset: number;
  start: number;
}

export interface TimelineOptions {
  [option: string]: unknown;
}

/** What the suite asks a framework to render, besides the timeline itself. */
export interface TimelineTree {
  clip?: { clip: string; defaultValue: ClipValue; label?: string };
  lane?: { seekable?: boolean };
  mark?: { movable?: boolean; value: number };
  navigator?: { label?: string };
  options: TimelineOptions & {
    onRangeChange: (
      value: number[],
      details: { edge: string; range: string; reason: string } & ChangeDetails
    ) => void;
    onClipChange: (
      value: ClipValue,
      details: { clip: string; reason: string; target?: string } & ChangeDetails
    ) => void;
    onClipRemove: (name: string) => void;
    onClipSelectedChange: (
      selected: boolean,
      details: { clip: string }
    ) => void;
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
  range?: {
    defaultValue: number[];
    drawable?: boolean;
    label?: string;
    range: string;
  };
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
  const clips: [ClipValue, string, string | undefined, string][] = [];
  const picked: [boolean, string][] = [];
  const removed: string[] = [];
  const ranges: [number[], string, string, string][] = [];
  const mounted = await mount({
    ruler: {},
    ...tree,
    options: {
      duration: 100,
      ...options,
      onClipChange: (value, details) => {
        clips.push([
          { ...value },
          details.clip,
          details.target,
          details.reason,
        ]);
      },
      onClipRemove: (name) => {
        removed.push(name);
      },
      onClipSelectedChange: (selected, details) => {
        picked.push([selected, details.clip]);
      },
      onRangeChange: (value, details) => {
        ranges.push([[...value], details.range, details.edge, details.reason]);
      },
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
  const part = (slot: string) => one(slot);
  const inputOf = (element: HTMLElement | null) =>
    element?.matches("input")
      ? (element as HTMLInputElement)
      : (element?.querySelector("input") as HTMLInputElement);
  return {
    ...mounted,
    part,
    inputOf,
    clip: one("clip"),
    clips,
    commits,
    heights,
    input: inputOf(one("rulerInput")),
    lane,
    mark: one("mark"),
    marks,
    picked,
    playhead: one("playhead"),
    positions,
    ranges,
    removed,
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
    test("a navigator shows the stretch the viewport shows, with a window and an edge to zoom by on each side", async () => {
      const p = await render(mount, { navigator: { label: "Visible" } });
      const window = p.part("navigatorWindow");
      expect(styleOf(window)).toContain("left: 0%");
      expect(styleOf(window)).toContain("width: 100%");
      expect(
        p.inputOf(p.part("navigatorWindowInput")).getAttribute("aria-label")
      ).toBe("Visible");
      expect(p.part("navigatorStart").getAttribute("data-edge")).toBe("start");
      expect(p.part("navigatorEnd").getAttribute("data-edge")).toBe("end");
      expect(
        p.inputOf(p.part("navigatorStartInput")).getAttribute("aria-label")
      ).toBe("Zoom start");
      expect(p.inputOf(p.part("navigatorEndInput")).value).toBe("100");
      p.unmount();
    });

    describe("a range", () => {
      test("is placed over the stretch it spans, and its body moves it, reporting its name and edge", async () => {
        const p = await render(mount, {
          lane: {},
          range: { defaultValue: [20, 50], range: "loop" },
        });
        const range = p.part("range");
        expect(styleOf(range)).toContain("--timeline-offset: 20");
        expect(styleOf(range)).toContain("--timeline-length: 30");
        await p.act(() => {
          pointer(range, "pointerdown", { clientX: 30, pointerId: 1 });
          pointer(range, "pointermove", { clientX: 40, pointerId: 1 });
        });
        expect(p.ranges.at(-1)).toEqual([[30, 60], "loop", "both", "drag"]);
        expect(p.positions).toHaveLength(0);
        expect(styleOf(range)).toContain("--timeline-offset: 30");
        await p.act(() => {
          pointer(range, "pointerup", { clientX: 40, pointerId: 1 });
        });
        p.unmount();
      });

      test("is resized by its edges, by dragging or from their own inputs", async () => {
        const p = await render(mount, {
          lane: {},
          range: { defaultValue: [20, 50], label: "Loop", range: "loop" },
        });
        const end = p.part("rangeEnd");
        await p.act(() => {
          pointer(end, "pointerdown", { clientX: 50, pointerId: 1 });
          pointer(end, "pointermove", { clientX: 80, pointerId: 1 });
          pointer(end, "pointerup", { clientX: 80, pointerId: 1 });
        });
        expect(p.ranges.at(-1)).toEqual([[20, 80], "loop", "end", "drag"]);
        const start = p.inputOf(p.part("rangeStartInput"));
        expect(start.getAttribute("aria-label")).toBe("Loop start");
        await p.act(() => key(start, "ArrowRight"));
        expect(p.ranges.at(-1)?.[2]).toBe("start");
        expect(p.ranges.at(-1)?.[3]).toBe("keyboard");
        const own = p.inputOf(p.part("rangeInput"));
        expect(own.getAttribute("aria-label")).toBe("Loop");
        p.unmount();
      });

      test("is drawn across the bare lane when it is drawable", async () => {
        const p = await render(mount, {
          lane: {},
          range: { defaultValue: [20, 50], drawable: true, range: "loop" },
        });
        await p.act(() => {
          pointer(p.lane, "pointerdown", { clientX: 60, pointerId: 1 });
          pointer(p.lane, "pointermove", { clientX: 75, pointerId: 1 });
        });
        expect(p.ranges.at(-1)?.[0]).toEqual([60, 75]);
        expect(p.ranges.at(-1)?.[3]).toBe("draw");
        await p.act(() => {
          pointer(p.lane, "pointerup", { clientX: 75, pointerId: 1 });
        });
        p.unmount();
      });
    });

    describe("a clip", () => {
      const value: ClipValue = {
        fadeIn: 0,
        fadeOut: 0,
        length: 20,
        offset: 0,
        start: 10,
      };

      test("is placed over the stretch it spans, with its fades and offset for what is inside", async () => {
        const p = await render(mount, {
          clip: { clip: "a", defaultValue: { ...value, fadeIn: 4, offset: 7 } },
          lane: {},
        });
        expect(styleOf(p.clip)).toContain("--timeline-offset: 10");
        expect(styleOf(p.clip)).toContain("--timeline-length: 20");
        expect(styleOf(p.clip)).toContain("--clip-fade-in: 4");
        expect(styleOf(p.clip)).toContain("--clip-fade-in-max: 20");
        expect(styleOf(p.clip)).toContain("--clip-offset: 7");
        expect(p.clip.getAttribute("data-clip")).toBe("a");
        p.unmount();
      });

      test("is moved by dragging its header, and the change names the clip and what moved", async () => {
        const p = await render(mount, {
          clip: { clip: "a", defaultValue: value },
          lane: {},
        });
        const header = p.part("clipHeader");
        await p.act(() => {
          pointer(header, "pointerdown", { clientX: 20, pointerId: 1 });
          pointer(header, "pointermove", { clientX: 35, pointerId: 1 });
        });
        expect(p.clips.at(-1)?.[0].start).toBe(25);
        expect(p.clips.at(-1)?.[1]).toBe("a");
        expect(p.clips.at(-1)?.[2]).toBe("move");
        expect(styleOf(p.clip)).toContain("--timeline-offset: 25");
        expect(p.positions).toHaveLength(0);
        await p.act(() => {
          pointer(header, "pointerup", { clientX: 35, pointerId: 1 });
        });
        p.unmount();
      });

      test("is selected by a press on its body, which moves the position there too", async () => {
        const p = await render(mount, {
          clip: { clip: "a", defaultValue: value },
          lane: {},
        });
        await p.act(() => {
          pointer(p.clip, "pointerdown", { clientX: 15, pointerId: 1 });
        });
        expect(p.picked.at(-1)).toEqual([true, "a"]);
        expect(p.positions.at(-1)?.[0]).toBe(15);
        expect(p.clip.hasAttribute("data-selected")).toBe(true);
        await p.act(() => {
          pointer(p.clip, "pointerup", { clientX: 15, pointerId: 1 });
        });
        p.unmount();
      });

      test("is trimmed by an edge: the end shortens it, the start moves where in the source it begins", async () => {
        const p = await render(mount, {
          clip: { clip: "a", defaultValue: value },
          lane: {},
        });
        const end = p.part("clipTrimEnd");
        await p.act(() => {
          pointer(end, "pointerdown", { clientX: 30, pointerId: 1 });
          pointer(end, "pointermove", { clientX: 25, pointerId: 1 });
          pointer(end, "pointerup", { clientX: 25, pointerId: 1 });
        });
        expect(p.clips.at(-1)?.[0].length).toBe(15);
        expect(p.clips.at(-1)?.[2]).toBe("trim-end");
        const start = p.part("clipTrimStart");
        await p.act(() => {
          pointer(start, "pointerdown", { clientX: 10, pointerId: 1 });
          pointer(start, "pointermove", { clientX: 14, pointerId: 1 });
          pointer(start, "pointerup", { clientX: 14, pointerId: 1 });
        });
        expect(p.clips.at(-1)?.[0].start).toBe(14);
        expect(p.clips.at(-1)?.[0].offset).toBe(4);
        p.unmount();
      });

      test("fades are set by their handles, shaded, and stepped through their shapes by Enter", async () => {
        const p = await render(mount, {
          clip: { clip: "a", defaultValue: value, label: "Clip" },
          lane: {},
        });
        const handle = p.part("clipFadeInHandle");
        await p.act(() => {
          pointer(handle, "pointerdown", { clientX: 10, pointerId: 1 });
          pointer(handle, "pointermove", { clientX: 16, pointerId: 1 });
          pointer(handle, "pointerup", { clientX: 16, pointerId: 1 });
        });
        expect(p.clips.at(-1)?.[0].fadeIn).toBe(6);
        expect(p.clips.at(-1)?.[2]).toBe("fade-in");
        expect(styleOf(p.clip)).toContain("--clip-fade-in: 6");
        const shade = p.part("clipFadeIn");
        expect(shade.querySelectorAll("path")).toHaveLength(2);
        const input = p.inputOf(p.part("clipFadeInInput"));
        await p.act(() => key(input, "Enter"));
        expect(p.clips.at(-1)?.[0].fadeInShape).toBe("fast");
        p.unmount();
      });

      test("has an input that names it and moves it from the keyboard, and Delete asks for its removal", async () => {
        const p = await render(mount, {
          clip: { clip: "a", defaultValue: value, label: "Take 1" },
          lane: {},
        });
        const input = p.inputOf(p.part("clipInput"));
        expect(input.getAttribute("aria-label")).toBe("Take 1");
        expect(input.getAttribute("aria-valuetext")).toBe("10 to 30");
        await p.act(() => key(input, "ArrowRight"));
        expect(p.clips.at(-1)?.[0].start).toBe(11);
        expect(p.clips.at(-1)?.[3]).toBe("keyboard");
        await p.act(() => key(input, "Delete"));
        expect(p.removed.at(-1)).toBe("a");
        p.unmount();
      });
    });
  });
}
