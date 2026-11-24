import { describe, expect, test } from "bun:test";
import { key, mockRect, pointer } from "./helpers.ts";

/**
 * One suite for the fader in every framework: it writes no markup of its own,
 * only drives the DOM a framework renders from the same `fader.ts`, and finds
 * each part by its `data-slot`.
 */

type Recorded = [value: number, reason: string][];

interface ChangeDetails {
  cancel: () => void;
  reason: string;
}

export interface FaderOptions {
  onValueChange?: (value: number, details: ChangeDetails) => void;
  [option: string]: unknown;
}

/** What the suite asks a framework to render. */
export interface FaderTree {
  label?: string;
  /** Where the graduations along the track sit. */
  marks?: number[];
  options: FaderOptions & {
    onValueChange: (value: number, details: ChangeDetails) => void;
    onValueCommitted: (value: number, details: { reason: string }) => void;
  };
  thumbLabel?: string;
}

/** A fader a framework rendered. */
export interface Mounted {
  act: (interact: () => void) => Promise<void>;
  container: HTMLElement;
  unmount: () => void;
}

export type MountFader = (tree: FaderTree) => Promise<Mounted>;

/** A 0 to 100 fader, so a value reads as the share of the travel. */
const RANGE = { max: 100, min: 0 };

async function render(
  mount: MountFader,
  options: FaderOptions = {},
  tree: Omit<FaderTree, "options"> = { thumbLabel: "Level" }
) {
  const changes: Recorded = [];
  const commits: Recorded = [];
  const mounted = await mount({
    ...tree,
    options: {
      ...RANGE,
      ...options,
      onValueChange: (value, details) => {
        changes.push([value, details.reason]);
        options.onValueChange?.(value, details);
      },
      onValueCommitted: (value, details) => {
        commits.push([value, details.reason]);
      },
    },
  });
  const part = (slot: string) =>
    mounted.container.querySelector(
      `[data-slot="${slot ? `fader-${slot}` : "fader"}"]`
    ) as HTMLElement;
  const control = part("control");
  const thumb = part("thumb");
  // A 100×100 track at the origin, and a thumb 10 px square on it, at 50.
  mockRect(control, { bottom: 100, height: 100, right: 100, width: 100 });
  mockRect(thumb, {
    bottom: 55,
    height: 10,
    left: 45,
    right: 55,
    top: 45,
    width: 10,
    x: 45,
    y: 45,
  });
  return {
    ...mounted,
    changes,
    commits,
    control,
    indicator: part("indicator"),
    input: mounted.container.querySelector(
      'input[type="range"]'
    ) as HTMLInputElement,
    label: part("label"),
    marks: [
      ...mounted.container.querySelectorAll<HTMLElement>(
        '[data-slot="fader-mark"]'
      ),
    ],
    root: part(""),
    thumb,
    track: part("track"),
    value: part("value"),
  };
}

const styleOf = (element: HTMLElement) => element.getAttribute("style") ?? "";

/** Waits for the frame a drag reports its moves on. */
const frame = () => new Promise((resolve) => setTimeout(resolve, 30));

export function faderSuite(framework: string, mount: MountFader) {
  describe(`the fader in ${framework}`, () => {
    test("a native range input, named by the thumb", async () => {
      const f = await render(mount);
      expect(f.input.type).toBe("range");
      expect(f.input.value).toBe("50");
      expect(f.input.min).toBe("0");
      expect(f.input.max).toBe("100");
      expect(f.input.getAttribute("aria-label")).toBe("Level");
      expect(f.input.getAttribute("aria-orientation")).toBe("vertical");
      expect(f.root.getAttribute("role")).toBe("group");
      f.unmount();
    });

    test("starts at the midpoint of -60 to +6 when no range is given", async () => {
      const f = await render(mount, { max: 6, min: -60 });
      expect(f.input.value).toBe("-27");
      f.unmount();
    });

    test("starts at defaultValue, and clamps a value", async () => {
      const start = await render(mount, { defaultValue: 12 });
      expect(start.input.value).toBe("12");
      start.unmount();
      const clamped = await render(mount, { value: 400 });
      expect(clamped.input.value).toBe("100");
      clamped.unmount();
    });

    test("formats the value for the value part and aria-valuetext", async () => {
      const f = await render(mount, {
        format: { style: "percent" },
        locale: "en-US",
        max: 1,
        min: 0,
        step: 0.01,
        value: 0.25,
      });
      expect(f.value.textContent?.trim()).toBe("25%");
      expect(f.input.getAttribute("aria-valuetext")).toBe("25%");
      f.unmount();
    });

    test("a label part names the input when the thumb has no name", async () => {
      const f = await render(mount, {}, { label: "Master" });
      expect(f.label.id).not.toBe("");
      expect(f.input.getAttribute("aria-labelledby")).toBe(f.label.id);
      expect(f.root.getAttribute("aria-labelledby")).toBe(f.label.id);
      f.unmount();
    });

    test("the thumb sits at the share of the travel, from the bottom", async () => {
      const f = await render(mount, { value: 25 });
      expect(styleOf(f.thumb)).toContain("bottom: 25%");
      f.unmount();
    });

    test("a horizontal fader runs from the start edge", async () => {
      const f = await render(mount, { orientation: "horizontal", value: 25 });
      expect(styleOf(f.thumb)).toContain("inset-inline-start: 25%");
      expect(f.input.getAttribute("aria-orientation")).toBe("horizontal");
      expect(f.control.getAttribute("data-orientation")).toBe("horizontal");
      f.unmount();
    });

    test("the indicator fills from the minimum, or from the anchor", async () => {
      const filled = await render(mount, { value: 30 });
      expect(styleOf(filled.indicator)).toContain("bottom: 0%");
      expect(styleOf(filled.indicator)).toContain("height: 30%");
      filled.unmount();
      const pan = await render(mount, {
        anchor: 50,
        max: 100,
        min: 0,
        value: 20,
      });
      expect(styleOf(pan.indicator)).toContain("bottom: 20%");
      expect(styleOf(pan.indicator)).toContain("height: 30%");
      pan.unmount();
    });

    test("a mark sits at its value, and is active once the value has reached it", async () => {
      const f = await render(mount, { value: 60 }, { marks: [25, 75] });
      expect(f.marks.map((mark) => styleOf(mark))).toEqual([
        expect.stringContaining("bottom: 25%"),
        expect.stringContaining("bottom: 75%"),
      ]);
      expect(f.marks[0]?.hasAttribute("data-active")).toBe(true);
      expect(f.marks[1]?.hasAttribute("data-active")).toBe(false);
      f.unmount();
    });

    test("ArrowUp reports a change and a commit, with a keyboard reason", async () => {
      const f = await render(mount);
      let event: KeyboardEvent | undefined;
      await f.act(() => {
        event = key(f.input, "ArrowUp");
      });
      expect(event?.defaultPrevented).toBe(true);
      expect(f.input.value).toBe("51");
      expect(f.changes).toEqual([[51, "keyboard"]]);
      expect(f.commits).toEqual([[51, "keyboard"]]);
      f.unmount();
    });

    test("Page, Home, End and Shift + arrow move by the large step or to the ends", async () => {
      const f = await render(mount);
      const read = async (name: string, init?: KeyboardEventInit) => {
        await f.act(() => key(f.input, name, init));
        return f.input.value;
      };
      expect(await read("PageUp")).toBe("60");
      expect(await read("ArrowDown", { shiftKey: true })).toBe("50");
      expect(await read("End")).toBe("100");
      expect(await read("Home")).toBe("0");
      f.unmount();
    });

    test("the wheel steps, with a wheel reason", async () => {
      const f = await render(mount);
      await f.act(() =>
        f.control.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: -100,
          })
        )
      );
      expect(f.changes).toEqual([[51, "wheel"]]);
      f.unmount();
    });

    test("cancel() in onValueChange refuses the value", async () => {
      const f = await render(mount, {
        onValueChange: (_value, details) => details.cancel(),
      });
      await f.act(() => key(f.input, "ArrowUp"));
      expect(f.input.value).toBe("50");
      expect(f.commits).toEqual([]);
      f.unmount();
    });

    test("a press on the track jumps to the value under it, committed on release", async () => {
      const f = await render(mount);
      await f.act(() =>
        pointer(f.control, "pointerdown", {
          clientX: 50,
          clientY: 25,
          pointerId: 1,
        })
      );
      expect(f.changes.at(-1)).toEqual([75, "track-press"]);
      await f.act(() =>
        pointer(f.control, "pointerup", {
          clientX: 50,
          clientY: 25,
          pointerId: 1,
        })
      );
      expect(f.commits.at(-1)).toEqual([75, "track-press"]);
      f.unmount();
    });

    test("a press on a horizontal track reads the x of the pointer", async () => {
      const f = await render(mount, { orientation: "horizontal" });
      await f.act(() =>
        pointer(f.control, "pointerdown", {
          clientX: 20,
          clientY: 50,
          pointerId: 1,
        })
      );
      expect(f.changes.at(-1)).toEqual([20, "track-press"]);
      f.unmount();
    });

    test("a drag from the thumb follows the pointer, and every part carries data-dragging", async () => {
      const f = await render(mount);
      await f.act(() => {
        pointer(f.thumb, "pointerdown", {
          clientX: 50,
          clientY: 50,
          pointerId: 1,
        });
        pointer(f.thumb, "pointermove", {
          clientX: 50,
          clientY: 20,
          pointerId: 1,
        });
      });
      await frame();
      expect(f.changes.at(-1)).toEqual([80, "drag"]);
      for (const part of [f.root, f.control, f.thumb, f.track]) {
        expect(part.hasAttribute("data-dragging")).toBe(true);
      }
      await f.act(() =>
        pointer(f.thumb, "pointerup", {
          clientX: 50,
          clientY: 20,
          pointerId: 1,
        })
      );
      expect(f.commits.at(-1)).toEqual([80, "drag"]);
      expect(f.thumb.hasAttribute("data-dragging")).toBe(false);
      f.unmount();
    });

    test("a drag measures the control once, at the press, not on each move", async () => {
      const f = await render(mount);
      const measure = f.control.getBoundingClientRect.bind(f.control);
      let reads = 0;
      f.control.getBoundingClientRect = () => {
        reads += 1;
        return measure();
      };
      await f.act(() =>
        pointer(f.track, "pointerdown", {
          clientX: 50,
          clientY: 50,
          pointerId: 1,
        })
      );
      const atPress = reads;
      await f.act(() => {
        for (const clientY of [40, 30, 20, 10]) {
          pointer(f.track, "pointermove", {
            clientX: 50,
            clientY,
            pointerId: 1,
          });
        }
      });
      await frame();
      expect(f.changes.at(-1)).toEqual([90, "drag"]);
      expect(reads).toBe(atPress);
      await f.act(() =>
        pointer(f.track, "pointerup", {
          clientX: 50,
          clientY: 10,
          pointerId: 1,
        })
      );
      f.unmount();
    });

    test("a double click, Alt + click and Delete return to defaultValue", async () => {
      const f = await render(mount, { defaultValue: 30 });
      await f.act(() => key(f.input, "End"));
      await f.act(() =>
        f.control.dispatchEvent(
          new MouseEvent("dblclick", { bubbles: true, cancelable: true })
        )
      );
      expect(f.input.value).toBe("30");
      expect(f.commits.at(-1)).toEqual([30, "reset"]);
      await f.act(() => key(f.input, "End"));
      await f.act(() => key(f.input, "Delete"));
      expect(f.input.value).toBe("30");
      await f.act(() => key(f.input, "End"));
      await f.act(() =>
        pointer(f.control, "pointerdown", {
          altKey: true,
          clientX: 50,
          clientY: 10,
          pointerId: 3,
        })
      );
      expect(f.input.value).toBe("30");
      f.unmount();
    });

    test("a disabled fader takes no key, wheel or press, and says so", async () => {
      const f = await render(mount, { disabled: true });
      await f.act(() => {
        key(f.input, "ArrowUp");
        f.control.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: -100,
          })
        );
        pointer(f.control, "pointerdown", {
          clientX: 50,
          clientY: 25,
          pointerId: 1,
        });
      });
      expect(f.changes).toEqual([]);
      expect(f.input.disabled).toBe(true);
      expect(f.thumb.hasAttribute("data-disabled")).toBe(true);
      f.unmount();
    });
  });
}
