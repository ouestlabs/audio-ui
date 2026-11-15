import { describe, expect, test } from "bun:test";
import { key, mockRect, pointer } from "./helpers.ts";

/**
 * One suite for the knob in every framework: it writes no markup of its own,
 * only drives the DOM a framework renders from the same `knob.ts`, and
 * finds each part by its `data-slot`.
 */

type Recorded = [value: number, reason: string][];

interface ChangeDetails {
  cancel: () => void;
  reason: string;
}

export interface KnobOptions {
  onValueChange?: (value: number, details: ChangeDetails) => void;
  [option: string]: unknown;
}

/** What the suite asks a framework to render. */
export interface KnobTree {
  /** A label part's text, which names the knob when the thumb has no name. */
  label?: string;
  options: KnobOptions & {
    onValueChange: (value: number, details: ChangeDetails) => void;
    onValueCommitted: (value: number, details: { reason: string }) => void;
  };
  /** What a provider around the knob gives it, when there is one. */
  provider?: { dragMode: "circular" | "revolution" | "vertical" };
  thumbLabel?: string;
}

/** A knob a framework rendered. */
export interface Mounted {
  /** Runs `interact`, then lets the framework render what it changed. */
  act: (interact: () => void) => Promise<void>;
  container: HTMLElement;
  unmount: () => void;
}

export type MountKnob = (tree: KnobTree) => Promise<Mounted>;

async function render(
  mount: MountKnob,
  options: KnobOptions = {},
  tree: Omit<KnobTree, "options"> = { thumbLabel: "Cutoff" }
) {
  const changes: Recorded = [];
  const commits: Recorded = [];
  const mounted = await mount({
    ...tree,
    options: {
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
      `[data-slot="${slot ? `knob-${slot}` : "knob"}"]`
    ) as HTMLElement;
  const control = part("control");
  // A 100×100 knob at the origin: its center is (50, 50).
  mockRect(control, { bottom: 100, height: 100, right: 100, width: 100 });
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
    root: part(""),
    thumb: part("thumb"),
    track: part("track"),
    value: part("value"),
  };
}

function tap(control: Element, pointerId: number) {
  pointer(control, "pointerdown", { clientX: 50, clientY: 10, pointerId });
  pointer(control, "pointerup", { clientX: 50, clientY: 10, pointerId });
}

const rotation = (thumb: HTMLElement) => Number.parseFloat(thumb.style.rotate);

export function knobSuite(
  framework: string,
  mount: MountKnob,
  { provider = true }: { provider?: boolean } = {}
) {
  describe(`the knob in ${framework}`, () => {
    // A framework without a provider, as custom elements, has no such test.
    if (provider) {
      test("a provider gives every knob below it its drag mode", async () => {
        const k = await render(
          mount,
          {},
          { provider: { dragMode: "vertical" }, thumbLabel: "Cutoff" }
        );
        expect(k.control.getAttribute("data-drag-mode")).toBe("vertical");
        await k.act(() => {
          pointer(k.control, "pointerdown", {
            clientX: 50,
            clientY: 90,
            pointerId: 1,
          });
          pointer(k.control, "pointermove", {
            clientX: 50,
            clientY: 75,
            pointerId: 1,
          });
        });
        expect(k.changes.at(-1)?.[0]).toBe(60);
        k.unmount();
      });
    }

    test("a native range input, named by the thumb", async () => {
      const k = await render(mount);
      expect(k.input.type).toBe("range");
      expect(k.input.value).toBe("50");
      expect(k.input.min).toBe("0");
      expect(k.input.max).toBe("100");
      expect(k.input.getAttribute("aria-label")).toBe("Cutoff");
      expect(k.thumb.hasAttribute("aria-label")).toBe(false);
      k.unmount();
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
      const k = await render(mount, {
        format: { style: "percent" },
        locale: "en-US",
        max: 1,
        min: 0,
        step: 0.01,
        value: 0.25,
      });
      expect(k.value.textContent?.trim()).toBe("25%");
      expect(k.input.getAttribute("aria-valuetext")).toBe("25%");
      k.unmount();
    });

    test("a label part names the input when the thumb has no name", async () => {
      const k = await render(mount, {}, { label: "Resonance" });
      expect(k.label.id).not.toBe("");
      expect(k.input.getAttribute("aria-labelledby")).toBe(k.label.id);
      k.unmount();
    });

    test("the thumb turns over a 288° sweep from 216°", async () => {
      const low = await render(mount, { value: 0 });
      expect(rotation(low.thumb)).toBe(216);
      low.unmount();
      const high = await render(mount, { value: 100 });
      expect(rotation(high.thumb)).toBe(504);
      high.unmount();
    });

    test("the track draws the whole arc, the indicator from the anchor", async () => {
      const k = await render(mount, { value: 0 });
      expect(k.track.querySelector("path")).not.toBeNull();
      expect(k.indicator.querySelector("path")).toBeNull();
      k.unmount();
      const pan = await render(mount, {
        anchor: 0,
        max: 1,
        min: -1,
        step: 0.1,
        value: 0.5,
      });
      expect(pan.indicator.querySelector("path")).not.toBeNull();
      pan.unmount();
    });

    test("a log scale puts the geometric middle at the middle of the dial", async () => {
      const k = await render(mount, {
        max: 20_000,
        min: 20,
        scale: "log",
        value: 632,
      });
      expect(rotation(k.thumb)).toBeCloseTo(360, 0);
      k.unmount();
    });

    test("ArrowUp reports a change and a commit, with a keyboard reason", async () => {
      const k = await render(mount);
      let event: KeyboardEvent | undefined;
      await k.act(() => {
        event = key(k.input, "ArrowUp");
      });
      expect(event?.defaultPrevented).toBe(true);
      expect(k.input.value).toBe("51");
      expect(k.changes).toEqual([[51, "keyboard"]]);
      expect(k.commits).toEqual([[51, "keyboard"]]);
      k.unmount();
    });

    test("Page, Home, End and Shift + arrow move by the large step or to the ends", async () => {
      const k = await render(mount);
      const read = async (name: string, init?: KeyboardEventInit) => {
        await k.act(() => key(k.input, name, init));
        return k.input.value;
      };
      expect(await read("PageUp")).toBe("60");
      expect(await read("ArrowDown", { shiftKey: true })).toBe("50");
      expect(await read("End")).toBe("100");
      expect(await read("Home")).toBe("0");
      k.unmount();
    });

    test("the wheel steps, with a wheel reason", async () => {
      const k = await render(mount);
      await k.act(() =>
        k.control.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: -100,
          })
        )
      );
      expect(k.changes).toEqual([[51, "wheel"]]);
      k.unmount();
    });

    test("cancel() in onValueChange refuses the value", async () => {
      const k = await render(mount, {
        onValueChange: (_value, details) => details.cancel(),
      });
      await k.act(() => key(k.input, "ArrowUp"));
      expect(k.input.value).toBe("50");
      expect(k.commits).toEqual([]);
      k.unmount();
    });

    test("circular: a quarter turn adds a quarter of the sweep, committed on release", async () => {
      const k = await render(mount);
      await k.act(() => {
        pointer(k.control, "pointerdown", {
          clientX: 50,
          clientY: 0,
          pointerId: 1,
        });
        pointer(k.control, "pointermove", {
          clientX: 100,
          clientY: 50,
          pointerId: 1,
        });
      });
      // 90° / 288° × 100 = 31.25, from 50: 81 once on the step.
      expect(k.changes.at(-1)).toEqual([81, "drag"]);
      expect(k.commits).toEqual([]);
      await k.act(() =>
        pointer(k.control, "pointerup", {
          clientX: 100,
          clientY: 50,
          pointerId: 1,
        })
      );
      expect(k.commits).toEqual([[81, "drag"]]);
      k.unmount();
    });

    test("vertical: 150 px of upward travel spans the whole range", async () => {
      const k = await render(mount, { dragMode: "vertical" });
      await k.act(() => {
        pointer(k.control, "pointerdown", {
          clientX: 50,
          clientY: 90,
          pointerId: 1,
        });
        pointer(k.control, "pointermove", {
          clientX: 50,
          clientY: 75,
          pointerId: 1,
        });
      });
      expect(k.changes.at(-1)?.[0]).toBe(60);
      k.unmount();
    });

    test("every part carries data-dragging while a pointer drags, and data-drag-mode", async () => {
      const k = await render(mount);
      expect(k.control.getAttribute("data-drag-mode")).toBe("circular");
      await k.act(() =>
        pointer(k.control, "pointerdown", {
          clientX: 50,
          clientY: 0,
          pointerId: 1,
        })
      );
      for (const part of [k.root, k.control, k.thumb, k.track]) {
        expect(part.hasAttribute("data-dragging")).toBe(true);
      }
      await k.act(() =>
        pointer(k.control, "pointerup", {
          clientX: 50,
          clientY: 0,
          pointerId: 1,
        })
      );
      expect(k.thumb.hasAttribute("data-dragging")).toBe(false);
      k.unmount();
    });

    test("two quick taps, Delete and Alt + click return to defaultValue", async () => {
      const k = await render(mount, { defaultValue: 30 });
      await k.act(() => key(k.input, "End"));
      await k.act(() => {
        tap(k.control, 1);
        tap(k.control, 2);
      });
      expect(k.input.value).toBe("30");
      expect(k.commits.at(-1)).toEqual([30, "reset"]);
      await k.act(() => key(k.input, "End"));
      await k.act(() => key(k.input, "Delete"));
      expect(k.input.value).toBe("30");
      await k.act(() => key(k.input, "End"));
      await k.act(() =>
        pointer(k.control, "pointerdown", {
          altKey: true,
          clientX: 50,
          clientY: 10,
          pointerId: 3,
        })
      );
      expect(k.input.value).toBe("30");
      k.unmount();
    });

    test("a disabled knob takes no key, wheel or drag, and says so", async () => {
      const k = await render(mount, { disabled: true });
      await k.act(() => {
        key(k.input, "ArrowUp");
        k.control.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: -100,
          })
        );
        pointer(k.control, "pointerdown", {
          clientX: 50,
          clientY: 0,
          pointerId: 1,
        });
        pointer(k.control, "pointermove", {
          clientX: 100,
          clientY: 50,
          pointerId: 1,
        });
      });
      expect(k.changes).toEqual([]);
      expect(k.input.disabled).toBe(true);
      expect(k.thumb.hasAttribute("data-disabled")).toBe(true);
      k.unmount();
    });
  });
}
