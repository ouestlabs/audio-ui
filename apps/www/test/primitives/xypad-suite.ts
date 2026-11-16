import { describe, expect, test } from "bun:test";
import { key, mockRect, pointer } from "./helpers.ts";

/**
 * One suite for the XY pad in every framework: it writes no markup of its own,
 * only drives the DOM a framework renders from the same `xypad.ts`, and finds
 * each part by its `data-slot`.
 */

interface Point {
  x: number;
  y: number;
}

type Recorded = [value: Point, reason: string][];

interface ChangeDetails {
  cancel: () => void;
  reason: string;
}

export interface XYPadOptions {
  onValueChange?: (value: Point, details: ChangeDetails) => void;
  [option: string]: unknown;
}

/** What the suite asks a framework to render. */
export interface XYPadTree {
  label?: string;
  options: XYPadOptions & {
    onValueChange: (value: Point, details: ChangeDetails) => void;
    onValueCommitted: (value: Point, details: { reason: string }) => void;
  };
  thumbLabel?: string;
}

/** An XY pad a framework rendered. */
export interface Mounted {
  act: (interact: () => void) => Promise<void>;
  container: HTMLElement;
  unmount: () => void;
}

export type MountXYPad = (tree: XYPadTree) => Promise<Mounted>;

async function render(
  mount: MountXYPad,
  options: XYPadOptions = {},
  tree: Omit<XYPadTree, "options"> = { thumbLabel: "Cursor" }
) {
  const changes: Recorded = [];
  const commits: Recorded = [];
  const mounted = await mount({
    ...tree,
    options: {
      ...options,
      onValueChange: (value, details) => {
        changes.push([{ ...value }, details.reason]);
        options.onValueChange?.(value, details);
      },
      onValueCommitted: (value, details) => {
        commits.push([{ ...value }, details.reason]);
      },
    },
  });
  const part = (slot: string) =>
    mounted.container.querySelector(
      `[data-slot="${slot ? `xypad-${slot}` : "xypad"}"]`
    ) as HTMLElement;
  const control = part("control");
  // A 100×100 pad at the origin: x runs left to right, y from the bottom.
  mockRect(control, { bottom: 100, height: 100, right: 100, width: 100 });
  const inputs = [
    ...mounted.container.querySelectorAll<HTMLInputElement>(
      'input[type="range"]'
    ),
  ];
  return {
    ...mounted,
    changes,
    commits,
    control,
    inputX: inputs[0] as HTMLInputElement,
    inputY: inputs[1] as HTMLInputElement,
    label: part("label"),
    root: part(""),
    thumb: part("thumb"),
    value: part("value"),
  };
}

/** Waits for the frame a drag reports its moves on. */
const frame = () => new Promise((resolve) => setTimeout(resolve, 30));

const styleOf = (element: HTMLElement) => element.getAttribute("style") ?? "";

export function xypadSuite(framework: string, mount: MountXYPad) {
  describe(`the XY pad in ${framework}`, () => {
    test("two native range inputs, one per axis, named by the thumb", async () => {
      const p = await render(mount);
      expect(p.inputX.type).toBe("range");
      expect(p.inputY.type).toBe("range");
      expect([p.inputX.value, p.inputY.value]).toEqual(["50", "50"]);
      expect(p.inputX.getAttribute("aria-label")).toBe("Cursor X");
      expect(p.inputY.getAttribute("aria-label")).toBe("Cursor Y");
      expect(p.inputX.getAttribute("aria-orientation")).toBe("horizontal");
      expect(p.inputY.getAttribute("aria-orientation")).toBe("vertical");
      expect(p.thumb.hasAttribute("aria-label")).toBe(false);
      // Only the X input is in the tab order.
      expect(p.inputY.getAttribute("tabindex")).toBe("-1");
      expect(p.inputX.hasAttribute("tabindex")).toBe(false);
      p.unmount();
    });

    test("starts at defaultValue, and clamps a value", async () => {
      const start = await render(mount, { defaultValue: { x: 10, y: 90 } });
      expect([start.inputX.value, start.inputY.value]).toEqual(["10", "90"]);
      start.unmount();
      const clamped = await render(mount, { value: { x: 400, y: -5 } });
      expect([clamped.inputX.value, clamped.inputY.value]).toEqual([
        "100",
        "0",
      ]);
      clamped.unmount();
    });

    test("writes each axis and the pair, for the value part and aria-valuetext", async () => {
      const p = await render(mount, {
        locale: "en-US",
        value: { x: 25, y: 75 },
      });
      expect(p.value.textContent).toContain("25");
      expect(p.value.textContent).toContain("75");
      expect(p.inputX.getAttribute("aria-valuetext")).toBe("25");
      expect(p.inputY.getAttribute("aria-valuetext")).toBe("75");
      p.unmount();
    });

    test("a label part names the inputs when the thumb has no name", async () => {
      const p = await render(mount, {}, { label: "Filter" });
      expect(p.label.id).not.toBe("");
      expect(p.inputX.getAttribute("aria-labelledby")).toBe(p.label.id);
      expect(p.inputY.getAttribute("aria-labelledby")).toBe(p.label.id);
      p.unmount();
    });

    test("the form names are the pad's name and the axis", async () => {
      const p = await render(mount, { name: "pad" });
      expect(p.inputX.getAttribute("name")).toBe("pad.x");
      expect(p.inputY.getAttribute("name")).toBe("pad.y");
      p.unmount();
    });

    test("the thumb sits at the point, y from the bottom, and the root carries its place", async () => {
      const p = await render(mount, { value: { x: 25, y: 75 } });
      expect(styleOf(p.thumb)).toContain("left: 25%");
      expect(styleOf(p.thumb)).toContain("top: 25%");
      expect(styleOf(p.root)).toContain("--xy-pad-x: 25%");
      expect(styleOf(p.root)).toContain("--xy-pad-y: 25%");
      p.unmount();
    });

    test("arrows move one axis a step, Shift ten, and report a keyboard reason", async () => {
      const p = await render(mount);
      let event: KeyboardEvent | undefined;
      await p.act(() => {
        event = key(p.inputX, "ArrowRight");
      });
      expect(event?.defaultPrevented).toBe(true);
      expect(p.inputX.value).toBe("51");
      expect(p.changes.at(-1)).toEqual([{ x: 51, y: 50 }, "keyboard"]);
      expect(p.commits.at(-1)).toEqual([{ x: 51, y: 50 }, "keyboard"]);
      await p.act(() => key(p.inputX, "ArrowUp", { shiftKey: true }));
      expect(p.inputY.value).toBe("60");
      p.unmount();
    });

    test("Page Up moves y by ten steps, Home and End go to the ends of x", async () => {
      const p = await render(mount);
      await p.act(() => key(p.inputX, "PageUp"));
      expect(p.inputY.value).toBe("60");
      await p.act(() => key(p.inputX, "End"));
      expect(p.inputX.value).toBe("100");
      await p.act(() => key(p.inputX, "Home"));
      expect(p.inputX.value).toBe("0");
      p.unmount();
    });

    test("the wheel moves the point, with a wheel reason", async () => {
      const p = await render(mount);
      await p.act(() =>
        p.control.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: -100,
          })
        )
      );
      expect(p.changes.at(-1)?.[1]).toBe("wheel");
      p.unmount();
    });

    test("cancel() in onValueChange refuses the point", async () => {
      const p = await render(mount, {
        onValueChange: (_value, details) => details.cancel(),
      });
      await p.act(() => key(p.inputX, "ArrowRight"));
      expect([p.inputX.value, p.inputY.value]).toEqual(["50", "50"]);
      expect(p.commits).toEqual([]);
      p.unmount();
    });

    test("a press moves the point under the pointer, committed on release", async () => {
      const p = await render(mount);
      await p.act(() =>
        pointer(p.control, "pointerdown", {
          clientX: 25,
          clientY: 25,
          pointerId: 1,
        })
      );
      expect(p.changes.at(-1)).toEqual([{ x: 25, y: 75 }, "press"]);
      await p.act(() =>
        pointer(p.control, "pointerup", {
          clientX: 25,
          clientY: 25,
          pointerId: 1,
        })
      );
      expect(p.commits.at(-1)).toEqual([{ x: 25, y: 75 }, "press"]);
      p.unmount();
    });

    test("a drag follows the pointer on both axes, and every part carries data-dragging", async () => {
      const p = await render(mount);
      await p.act(() => {
        pointer(p.control, "pointerdown", {
          clientX: 50,
          clientY: 50,
          pointerId: 1,
        });
        pointer(p.control, "pointermove", {
          clientX: 80,
          clientY: 20,
          pointerId: 1,
        });
      });
      await frame();
      await p.act(() => undefined);
      expect(p.changes.at(-1)).toEqual([{ x: 80, y: 80 }, "drag"]);
      for (const part of [p.root, p.control, p.thumb]) {
        expect(part.hasAttribute("data-dragging")).toBe(true);
      }
      await p.act(() =>
        pointer(p.control, "pointerup", {
          clientX: 80,
          clientY: 20,
          pointerId: 1,
        })
      );
      expect(p.commits.at(-1)).toEqual([{ x: 80, y: 80 }, "drag"]);
      expect(p.thumb.hasAttribute("data-dragging")).toBe(false);
      p.unmount();
    });

    test("a double click, Alt + press and Delete return to defaultValue", async () => {
      const p = await render(mount, { defaultValue: { x: 30, y: 70 } });
      await p.act(() => key(p.inputX, "End"));
      await p.act(() =>
        p.control.dispatchEvent(
          new MouseEvent("dblclick", { bubbles: true, cancelable: true })
        )
      );
      expect([p.inputX.value, p.inputY.value]).toEqual(["30", "70"]);
      expect(p.commits.at(-1)).toEqual([{ x: 30, y: 70 }, "reset"]);
      await p.act(() => key(p.inputX, "End"));
      await p.act(() => key(p.inputX, "Delete"));
      expect([p.inputX.value, p.inputY.value]).toEqual(["30", "70"]);
      await p.act(() => key(p.inputX, "End"));
      await p.act(() =>
        pointer(p.control, "pointerdown", {
          altKey: true,
          clientX: 10,
          clientY: 10,
          pointerId: 3,
        })
      );
      expect([p.inputX.value, p.inputY.value]).toEqual(["30", "70"]);
      p.unmount();
    });

    test("a disabled pad takes no key, wheel or press, and says so", async () => {
      const p = await render(mount, { disabled: true });
      await p.act(() => {
        key(p.inputX, "ArrowRight");
        p.control.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: -100,
          })
        );
        pointer(p.control, "pointerdown", {
          clientX: 25,
          clientY: 25,
          pointerId: 1,
        });
      });
      expect(p.changes).toEqual([]);
      expect(p.inputX.disabled).toBe(true);
      expect(p.thumb.hasAttribute("data-disabled")).toBe(true);
      p.unmount();
    });
  });
}
